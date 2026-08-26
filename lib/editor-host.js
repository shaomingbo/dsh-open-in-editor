import { spawn } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'

export const OPEN_BINARY = '/usr/bin/open'
export const MAX_PATH_LENGTH = 4096

export const EDITORS = Object.freeze([
  Object.freeze({ id: 'system', name: 'System default', application: null }),
  Object.freeze({ id: 'zed', name: 'Zed', application: 'Zed' }),
  Object.freeze({ id: 'vscode', name: 'Visual Studio Code', application: 'Visual Studio Code' }),
  Object.freeze({ id: 'xcode', name: 'Xcode', application: 'Xcode' }),
])

const EDITOR_BY_ID = new Map(EDITORS.map((editor) => [editor.id, editor]))

export function requireEditorId(value, field = 'editor') {
  if (typeof value !== 'string' || !EDITOR_BY_ID.has(value)) {
    throw new Error(`${field} must be one of: ${EDITORS.map((editor) => editor.id).join(', ')}`)
  }
  return value
}

export function openArguments(editor, path) {
  const definition = EDITOR_BY_ID.get(requireEditorId(editor))
  return definition.application === null ? [path] : ['-a', definition.application, path]
}

/** Run one short-lived macOS `open` command without invoking a shell. */
export function runOpen(args, signal, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    let settled = false
    let child
    const finish = (error) => {
      if (settled) return
      settled = true
      if (error === undefined) resolve()
      else reject(error)
    }

    try {
      child = spawnImpl(OPEN_BINARY, args, {
        stdio: 'ignore',
        windowsHide: true,
        signal,
      })
    } catch (error) {
      finish(error)
      return
    }

    child.once('error', finish)
    child.once('close', (code, closeSignal) => {
      if (code === 0) {
        finish()
        return
      }
      const suffix = closeSignal === null ? `exit code ${String(code)}` : `signal ${closeSignal}`
      finish(new Error(`${OPEN_BINARY} failed with ${suffix}`))
    })
  })
}

export function createEditorHost(options = {}) {
  const canonicalize = options.realpath ?? realpath
  const inspect = options.stat ?? stat
  const run = options.run ?? ((args, signal) => runOpen(args, signal, options.spawn))
  const platform = options.platform ?? process.platform
  const getDefaultEditor = options.getDefaultEditor ?? (() => 'system')
  let cachedEditors

  async function detectEditor(editor, signal) {
    if (editor.application === null) return { id: editor.id, name: editor.name, available: true }
    if (platform !== 'darwin') return { id: editor.id, name: editor.name, available: false }
    try {
      await run(['-Ra', editor.application], signal)
      return { id: editor.id, name: editor.name, available: true }
    } catch {
      return { id: editor.id, name: editor.name, available: false }
    }
  }

  async function describe({ refresh = false, signal } = {}) {
    if (refresh || cachedEditors === undefined) {
      cachedEditors = await Promise.all(EDITORS.map((editor) => detectEditor(editor, signal)))
    }
    return {
      platform,
      supported: platform === 'darwin',
      defaultEditor: requireEditorId(getDefaultEditor(), 'configured defaultEditor'),
      editors: cachedEditors.map((editor) => ({ ...editor })),
    }
  }

  async function open({ path, editor }, signal) {
    if (platform !== 'darwin') throw new Error('dsh-open-in-editor currently supports macOS only')
    if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LENGTH || !isAbsolute(path)) {
      throw new Error('path must be a non-empty absolute path')
    }

    const selected = editor === undefined ? requireEditorId(getDefaultEditor(), 'configured defaultEditor') : requireEditorId(editor)
    const canonicalPath = await canonicalize(path)
    const details = await inspect(canonicalPath)
    if (!details.isFile() && !details.isDirectory()) {
      throw new Error('path must refer to a regular file or directory')
    }

    if (selected !== 'system') {
      const catalog = await describe({ signal })
      if (catalog.editors.find((entry) => entry.id === selected)?.available !== true) {
        throw new Error(`${EDITOR_BY_ID.get(selected).name} is not installed or cannot be opened`)
      }
    }

    await run(openArguments(selected, canonicalPath), signal)
    return { opened: true, path: canonicalPath, editor: selected }
  }

  return { describe, open }
}
