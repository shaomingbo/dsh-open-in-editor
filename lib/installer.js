import { spawnSync } from 'node:child_process'
import { copyFile, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const PACKAGE_NAME = 'dsh-open-in-editor'
export const DEFAULT_PROFILE = 'web'
export const DEFAULT_SOURCE = 'github:shaomingbo/dsh-open-in-editor#v0.2.1'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`)
  return value
}

function formatManifest(manifest, original) {
  const indent = original.match(/\n([\t ]+)"/)?.[1] ?? '  '
  const newline = original.endsWith('\n') ? '\n' : ''
  return `${JSON.stringify(manifest, null, indent)}${newline}`
}

async function atomicWrite(file, content) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  const mode = (await stat(file)).mode
  await writeFile(temporary, content, { mode })
  try {
    await rename(temporary, file)
  } catch (cause) {
    await unlink(temporary).catch(() => {})
    throw cause
  }
}

function installManifest(manifest, source) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('A package source is required for installation.')
  }
  const dependencies = manifest.dependencies === undefined
    ? (manifest.dependencies = {})
    : requireRecord(manifest.dependencies, 'dependencies')
  const dsh = manifest.dsh === undefined
    ? (manifest.dsh = {})
    : requireRecord(manifest.dsh, 'dsh')
  const profile = dsh.profile === undefined
    ? (dsh.profile = {})
    : requireRecord(dsh.profile, 'dsh.profile')
  const bundles = profile.bundles === undefined
    ? (profile.bundles = [])
    : profile.bundles
  if (!Array.isArray(bundles)) throw new Error('dsh.profile.bundles must be an array.')

  dependencies[PACKAGE_NAME] = source
  profile.bundles = [...new Set([...bundles, PACKAGE_NAME])]
}

function uninstallManifest(manifest) {
  if (manifest.dependencies !== undefined) {
    const dependencies = requireRecord(manifest.dependencies, 'dependencies')
    delete dependencies[PACKAGE_NAME]
  }
  if (manifest.dsh !== undefined) {
    const dsh = requireRecord(manifest.dsh, 'dsh')
    if (dsh.profile !== undefined) {
      const profile = requireRecord(dsh.profile, 'dsh.profile')
      if (profile.bundles !== undefined) {
        if (!Array.isArray(profile.bundles)) throw new Error('dsh.profile.bundles must be an array.')
        profile.bundles = profile.bundles.filter((bundle) => bundle !== PACKAGE_NAME)
      }
    }
  }
}

export function inspectProfile(manifest) {
  const dependency = isRecord(manifest?.dependencies) ? manifest.dependencies[PACKAGE_NAME] : undefined
  const bundles = isRecord(manifest?.dsh) && isRecord(manifest.dsh.profile) && Array.isArray(manifest.dsh.profile.bundles)
    ? manifest.dsh.profile.bundles
    : []
  const enabled = bundles.includes(PACKAGE_NAME)
  return {
    state: dependency !== undefined && enabled
      ? 'installed'
      : dependency !== undefined || enabled
        ? 'partial'
        : 'not-installed',
    dependency,
    enabled,
  }
}

export function parseArguments(args, environment = process.env) {
  let command
  let profile = DEFAULT_PROFILE
  let source = environment.DSH_OPEN_IN_EDITOR_SOURCE || DEFAULT_SOURCE
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') command = 'help'
    else if (argument === '--version' || argument === '-v') command = 'version'
    else if (argument === '--profile' || argument === '--source') {
      const value = args[index + 1]
      if (value === undefined || value.startsWith('-')) throw new Error(`${argument} requires a value.`)
      if (argument === '--profile') profile = value
      else source = value
      index += 1
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    } else if (command === undefined) {
      command = argument
    } else {
      throw new Error(`Unexpected argument: ${argument}`)
    }
  }
  command ??= 'install'
  if (!['install', 'status', 'uninstall', 'help', 'version'].includes(command)) {
    throw new Error(`Unknown command: ${command}`)
  }
  return { command, profile, source }
}

export function resolveProfileDirectory(profile, environment = process.env) {
  if (path.isAbsolute(profile)) return path.normalize(profile)
  if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
    throw new Error('Profile must be a profile name or an absolute directory path.')
  }
  const dshHome = environment.DSH_HOME || path.join(os.homedir(), '.dsh')
  const profilesDirectory = path.resolve(dshHome, 'profiles')
  const profileDirectory = path.resolve(profilesDirectory, profile)
  if (path.dirname(profileDirectory) !== profilesDirectory) {
    throw new Error('Profile names cannot escape the DSH profiles directory.')
  }
  return profileDirectory
}

export function installWithPnpm(profileDirectory) {
  const attempts = [
    ['pnpm', ['install', '--ignore-scripts']],
    ['corepack', ['pnpm', 'install', '--ignore-scripts']],
  ]
  for (const [command, args] of attempts) {
    const result = spawnSync(command, args, { cwd: profileDirectory, stdio: 'inherit' })
    if (!result.error && result.status === 0) return
    if (result.error?.code !== 'ENOENT') {
      throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`)
    }
  }
  throw new Error('pnpm is unavailable; install pnpm or enable it with corepack.')
}

export async function updateProfile({
  command,
  profileDirectory,
  source = DEFAULT_SOURCE,
  installDependencies = installWithPnpm,
}) {
  if (!['install', 'uninstall'].includes(command)) throw new Error(`Unsupported update command: ${command}`)
  const manifestPath = path.join(profileDirectory, 'package.json')
  let original
  try {
    original = await readFile(manifestPath, 'utf8')
  } catch (cause) {
    throw new Error(`Could not read DSH profile manifest at ${manifestPath}: ${cause.message}`)
  }

  let manifest
  try {
    manifest = requireRecord(JSON.parse(original), 'profile package.json')
  } catch (cause) {
    throw new Error(`Invalid DSH profile manifest at ${manifestPath}: ${cause.message}`)
  }

  const semanticBefore = JSON.stringify(manifest)
  if (command === 'install') installManifest(manifest, source)
  else uninstallManifest(manifest)

  const changed = JSON.stringify(manifest) !== semanticBefore
  const next = changed ? formatManifest(manifest, original) : original
  const backupPath = `${manifestPath}.dsh-open-in-editor.bak`
  if (changed) {
    await copyFile(manifestPath, backupPath)
    await atomicWrite(manifestPath, next)
  }

  try {
    if (command === 'install' || changed) await installDependencies(profileDirectory)
  } catch (cause) {
    if (changed) await atomicWrite(manifestPath, original)
    const recovery = changed ? 'package.json was restored.' : 'package.json was unchanged.'
    throw new Error(`Dependency installation failed; ${recovery} ${cause.message}`)
  }

  return {
    command,
    profileDirectory,
    changed,
    backupPath: changed ? backupPath : undefined,
    restartRequired: changed,
    status: inspectProfile(manifest),
  }
}

export async function readProfileStatus(profileDirectory) {
  const manifestPath = path.join(profileDirectory, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (cause) {
    throw new Error(`Could not read DSH profile manifest at ${manifestPath}: ${cause.message}`)
  }
  return inspectProfile(manifest)
}
