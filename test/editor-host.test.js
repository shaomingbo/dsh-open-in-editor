import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  EDITORS,
  OPEN_BINARY,
  createEditorHost,
  openArguments,
  requireEditorId,
  runOpen,
} from '../lib/editor-host.js'

test('exposes a fixed editor allowlist and builds shell-free open arguments', () => {
  assert.deepEqual(EDITORS.map((editor) => editor.id), ['system', 'zed', 'vscode', 'xcode'])
  assert.deepEqual(openArguments('system', '/tmp/file name.md'), ['/tmp/file name.md'])
  assert.deepEqual(openArguments('zed', '/tmp/file name.md'), ['-a', 'Zed', '/tmp/file name.md'])
  assert.throws(() => requireEditorId('custom; rm -rf /'), /must be one of/)
})

test('runOpen invokes the fixed binary without a shell and reports non-zero exit', async () => {
  const calls = []
  const okSpawn = (command, args, options) => {
    calls.push({ command, args, options })
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', 0, null))
    return child
  }
  await runOpen(['-Ra', 'Zed'], undefined, okSpawn)
  assert.equal(calls[0].command, OPEN_BINARY)
  assert.deepEqual(calls[0].args, ['-Ra', 'Zed'])
  assert.equal(calls[0].options.shell, undefined)
  assert.equal(calls[0].options.stdio, 'ignore')

  const badSpawn = () => {
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', 1, null))
    return child
  }
  await assert.rejects(runOpen(['-Ra', 'Missing'], undefined, badSpawn), /exit code 1/)
})

test('detects installed applications and refreshes the cached catalog on demand', async () => {
  let zedAvailable = true
  const calls = []
  const host = createEditorHost({
    platform: 'darwin',
    run: async (args) => {
      calls.push(args)
      if (args[0] === '-Ra' && args[1] === 'Zed' && !zedAvailable) throw new Error('missing')
      if (args[0] === '-Ra' && args[1] === 'Xcode') throw new Error('missing')
    },
  })

  const first = await host.describe()
  assert.equal(first.supported, true)
  assert.equal(first.editors.find((editor) => editor.id === 'zed').available, true)
  assert.equal(first.editors.find((editor) => editor.id === 'xcode').available, false)
  const callsAfterFirst = calls.length

  zedAvailable = false
  const cached = await host.describe()
  assert.equal(cached.editors.find((editor) => editor.id === 'zed').available, true)
  assert.equal(calls.length, callsAfterFirst)

  const refreshed = await host.describe({ refresh: true })
  assert.equal(refreshed.editors.find((editor) => editor.id === 'zed').available, false)
  assert.ok(calls.length > callsAfterFirst)
})

test('opens canonical files with the live default editor and supports a one-shot override', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-open-in-editor-'))
  const file = join(directory, 'note.md')
  const alias = join(directory, 'alias.md')
  await writeFile(file, '# note', 'utf8')
  await symlink(file, alias)
  let defaultEditor = 'zed'
  const calls = []
  const host = createEditorHost({
    platform: 'darwin',
    getDefaultEditor: () => defaultEditor,
    run: async (args) => calls.push(args),
  })

  const first = await host.open({ path: alias })
  assert.deepEqual(first, { opened: true, path: await realpath(file), editor: 'zed' })
  assert.deepEqual(calls.at(-1), ['-a', 'Zed', await realpath(file)])

  defaultEditor = 'vscode'
  const second = await host.open({ path: file })
  assert.equal(second.editor, 'vscode')
  assert.deepEqual(calls.at(-1), ['-a', 'Visual Studio Code', await realpath(file)])

  const override = await host.open({ path: file, editor: 'xcode' })
  assert.equal(override.editor, 'xcode')
  assert.deepEqual(calls.at(-1), ['-a', 'Xcode', await realpath(file)])
})

test('opens directories and rejects relative, missing, special, unavailable, or unsupported targets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-open-in-editor-'))
  const nested = join(directory, 'nested')
  const unicodeFile = join(directory, '空 格 -note.md')
  await mkdir(nested)
  await writeFile(unicodeFile, 'safe', 'utf8')
  const calls = []
  const host = createEditorHost({
    platform: 'darwin',
    run: async (args) => {
      calls.push(args)
      if (args[0] === '-Ra' && args[1] === 'Zed') throw new Error('missing')
    },
  })

  const opened = await host.open({ path: nested, editor: 'system' })
  assert.equal(opened.path, await realpath(nested))
  const unicode = await host.open({ path: unicodeFile, editor: 'system' })
  assert.equal(unicode.path, await realpath(unicodeFile))
  assert.deepEqual(calls.at(-1), [await realpath(unicodeFile)])
  await assert.rejects(host.open({ path: 'relative.md' }), /absolute path/)
  await assert.rejects(host.open({ path: '/tmp/nul\0file.md' }), /null bytes|ENOENT|path/i)
  await assert.rejects(host.open({ path: join(directory, 'missing.md') }), /ENOENT/)
  await assert.rejects(host.open({ path: '/dev/null' }), /regular file or directory/)
  await assert.rejects(host.open({ path: nested, editor: 'zed' }), /not installed/)
  await assert.rejects(host.open({ path: nested, editor: 'unknown' }), /must be one of/)

  const linux = createEditorHost({ platform: 'linux', run: async () => {} })
  await assert.rejects(linux.open({ path: nested }), /supports macOS only/)
})
