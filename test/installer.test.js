import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_SOURCE,
  PACKAGE_NAME,
  inspectProfile,
  parseArguments,
  resolveProfileDirectory,
  updateProfile,
} from '../lib/installer.js'

async function fixture(manifest = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dsh-open-in-editor-'))
  const profileDirectory = path.join(directory, 'profiles', 'web')
  await mkdir(profileDirectory, { recursive: true })
  const manifestPath = path.join(profileDirectory, 'package.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return {
    directory,
    profileDirectory,
    manifestPath,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  }
}

async function readManifest(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

test('install safely adds the pinned package source and enables the bundle', async (t) => {
  const target = await fixture({
    name: 'dsh-profile-web',
    private: true,
    dependencies: { existing: '1.0.0' },
    dsh: { profile: { bundles: ['existing'] } },
  })
  t.after(target.cleanup)
  const installs = []

  const result = await updateProfile({
    command: 'install',
    profileDirectory: target.profileDirectory,
    source: DEFAULT_SOURCE,
    installDependencies: async (directory) => installs.push(directory),
  })

  const manifest = await readManifest(target.manifestPath)
  assert.equal(manifest.dependencies[PACKAGE_NAME], DEFAULT_SOURCE)
  assert.deepEqual(manifest.dsh.profile.bundles, ['existing', PACKAGE_NAME])
  assert.deepEqual(installs, [target.profileDirectory])
  assert.equal(result.changed, true)
  assert.equal(result.restartRequired, true)
  assert.deepEqual(await readManifest(`${target.manifestPath}.dsh-open-in-editor.bak`), {
    name: 'dsh-profile-web',
    private: true,
    dependencies: { existing: '1.0.0' },
    dsh: { profile: { bundles: ['existing'] } },
  })
})

test('install is idempotent and repairs dependencies without duplicating the bundle', async (t) => {
  const target = await fixture({
    dependencies: { [PACKAGE_NAME]: DEFAULT_SOURCE },
    dsh: { profile: { bundles: [PACKAGE_NAME] } },
  })
  t.after(target.cleanup)
  let installs = 0

  const result = await updateProfile({
    command: 'install',
    profileDirectory: target.profileDirectory,
    source: DEFAULT_SOURCE,
    installDependencies: async () => { installs += 1 },
  })

  assert.equal(result.changed, false)
  assert.equal(installs, 1)
  assert.deepEqual((await readManifest(target.manifestPath)).dsh.profile.bundles, [PACKAGE_NAME])
})

test('uninstall removes only this dependency and bundle', async (t) => {
  const target = await fixture({
    dependencies: { existing: '1.0.0', [PACKAGE_NAME]: DEFAULT_SOURCE },
    dsh: { profile: { bundles: ['existing', PACKAGE_NAME, PACKAGE_NAME] } },
  })
  t.after(target.cleanup)

  const result = await updateProfile({
    command: 'uninstall',
    profileDirectory: target.profileDirectory,
    source: DEFAULT_SOURCE,
    installDependencies: async () => {},
  })

  const manifest = await readManifest(target.manifestPath)
  assert.deepEqual(manifest.dependencies, { existing: '1.0.0' })
  assert.deepEqual(manifest.dsh.profile.bundles, ['existing'])
  assert.equal(result.changed, true)
  assert.equal(result.restartRequired, true)
})

test('failed dependency installation restores package.json', async (t) => {
  const original = {
    dependencies: { existing: '1.0.0' },
    dsh: { profile: { bundles: ['existing'] } },
  }
  const target = await fixture(original)
  t.after(target.cleanup)

  await assert.rejects(updateProfile({
    command: 'install',
    profileDirectory: target.profileDirectory,
    source: DEFAULT_SOURCE,
    installDependencies: async () => { throw new Error('pnpm failed') },
  }), /package\.json was restored/)
  assert.deepEqual(await readManifest(target.manifestPath), original)
})

test('invalid profile manifests fail without being rewritten', async (t) => {
  const target = await fixture()
  t.after(target.cleanup)
  await writeFile(target.manifestPath, '{ invalid json\n')

  await assert.rejects(updateProfile({
    command: 'install',
    profileDirectory: target.profileDirectory,
    source: DEFAULT_SOURCE,
    installDependencies: async () => {},
  }), /Invalid DSH profile manifest/)
  assert.equal(await readFile(target.manifestPath, 'utf8'), '{ invalid json\n')
})

test('the executable completes a no-argument install, status, and uninstall cycle', async (t) => {
  const target = await fixture({ name: 'dsh-profile-web', private: true })
  t.after(target.cleanup)
  const fakeBin = path.join(target.directory, 'bin')
  await mkdir(fakeBin)
  const fakePnpm = path.join(fakeBin, 'pnpm')
  await writeFile(fakePnpm, '#!/bin/sh\nexit 0\n')
  await chmod(fakePnpm, 0o755)
  const executable = fileURLToPath(new URL('../bin/dsh-open-in-editor.js', import.meta.url))
  const environment = { ...process.env, DSH_HOME: target.directory, PATH: `${fakeBin}:${process.env.PATH}` }
  const run = (...args) => spawnSync(process.execPath, [executable, ...args], { env: environment, encoding: 'utf8' })

  const install = run()
  assert.equal(install.status, 0, install.stderr)
  assert.match(install.stdout, /Installed dsh-open-in-editor/)
  assert.equal((await readManifest(target.manifestPath)).dependencies[PACKAGE_NAME], DEFAULT_SOURCE)

  const status = run('status')
  assert.equal(status.status, 0, status.stderr)
  assert.match(status.stdout, /dsh-open-in-editor: installed/)

  const uninstall = run('uninstall')
  assert.equal(uninstall.status, 0, uninstall.stderr)
  assert.match(uninstall.stdout, /Uninstalled dsh-open-in-editor/)
  assert.equal(inspectProfile(await readManifest(target.manifestPath)).state, 'not-installed')
})

test('status reports installed, partial, and absent profile states', () => {
  assert.deepEqual(inspectProfile({
    dependencies: { [PACKAGE_NAME]: DEFAULT_SOURCE },
    dsh: { profile: { bundles: [PACKAGE_NAME] } },
  }), { state: 'installed', dependency: DEFAULT_SOURCE, enabled: true })
  assert.equal(inspectProfile({ dependencies: { [PACKAGE_NAME]: DEFAULT_SOURCE } }).state, 'partial')
  assert.equal(inspectProfile({}).state, 'not-installed')
})

test('argument parsing keeps a small command interface and defaults to install', () => {
  const base = { profile: 'web', source: DEFAULT_SOURCE }
  assert.deepEqual(parseArguments([], {}), { command: 'install', ...base })
  assert.deepEqual(parseArguments(['install'], {}), { command: 'install', ...base })
  assert.deepEqual(parseArguments(['status', '--profile', 'desktop'], {}), { command: 'status', profile: 'desktop', source: DEFAULT_SOURCE })
  assert.deepEqual(parseArguments(['uninstall', '--profile', '/tmp/profile'], {}), { command: 'uninstall', profile: '/tmp/profile', source: DEFAULT_SOURCE })
  assert.deepEqual(parseArguments(['--source', 'link:/tmp/plugin'], {}), { command: 'install', profile: 'web', source: 'link:/tmp/plugin' })
  assert.deepEqual(parseArguments([], { DSH_OPEN_IN_EDITOR_SOURCE: 'link:/env/plugin' }), { command: 'install', profile: 'web', source: 'link:/env/plugin' })
  assert.deepEqual(parseArguments(['--help'], {}), { command: 'help', ...base })
  assert.throws(() => parseArguments(['upgrade'], {}), /Unknown command/)
  assert.throws(() => parseArguments(['install', '--profile'], {}), /requires a value/)
})

test('profile names resolve under DSH_HOME while absolute paths stay absolute', () => {
  assert.equal(resolveProfileDirectory('web', { DSH_HOME: '/tmp/dsh-home' }), '/tmp/dsh-home/profiles/web')
  assert.equal(resolveProfileDirectory('/tmp/custom-profile', { DSH_HOME: '/ignored' }), '/tmp/custom-profile')
  assert.throws(() => resolveProfileDirectory('..', { DSH_HOME: '/tmp/dsh-home' }), /cannot escape/)
})
