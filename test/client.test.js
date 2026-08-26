import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const clientPath = fileURLToPath(new URL('../lib/client.js', import.meta.url))

async function loadFactory() {
  const source = await readFile(clientPath, 'utf8')
  let registration
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load(value) {
          registration = value
        },
      },
    },
  })
  const React = {
    createElement() {},
    useCallback() {},
    useEffect() {},
    useRef() {},
    useState() {},
    useSyncExternalStore() {},
  }
  const plugin = registration.factory((id) => {
    if (id === 'react') return React
    if (id === '@deepseek-ai/dsh-client-runtime/client') {
      return { resolveWorkspacePath: (cwd, path) => path.startsWith('/') ? path : `${cwd}/${path}` }
    }
    throw new Error(`unexpected client require: ${id}`)
  })
  return { plugin, registration, source }
}

test('uses the DSH client-module handoff and declares the required dependencies', async () => {
  const { plugin, registration } = await loadFactory()
  assert.equal(registration.id, 'dsh-open-in-editor')
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale', 'connection', 'remote', 'settingsScope'])
})

test('derives produced files through closing seq with stable first-seen deduplication', async () => {
  const { plugin } = await loadFactory()
  const data = {
    produced: [
      { path: 'a.md', seq: 2 },
      { path: 'late.md', seq: 8 },
      { path: 'a.md', seq: 3 },
      { path: 'b.md', seq: 4 },
    ],
  }
  assert.deepEqual(Array.from(plugin.producedForClosing(data, 4)), ['a.md', 'b.md'])
  assert.deepEqual(Array.from(plugin.producedForClosing(undefined, 4)), [])
  assert.deepEqual(Array.from(plugin.selectProducedFiles({ turn: { data: new Map([['deliverables', data]]) }, seq: 1 }) ?? []), [])
})

test('claims the produced-file chain before the official entry and registers settings', async () => {
  const { plugin } = await loadFactory()
  const registrations = []
  const settings = {
    getSnapshot: () => ({ status: 'ready', value: { defaultEditor: 'system' }, writable: true }),
    subscribe: () => () => {},
    set: async () => {},
  }
  const ctx = {
    connection: { isLoopback: true, rpc: { call: async () => ({ ok: true, value: { editors: [], supported: true } }) } },
    effect(callback) { callback() },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    settingsScope: { bind: ({ namespace }) => {
      assert.equal(namespace, 'open-in-editor')
      return settings
    } },
    slots: {
      inject(name, callback) {
        assert.ok(['conversation.chat.turnTail', 'settings.section'].includes(name))
        callback()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  plugin.apply(ctx)
  const tail = registrations.find((entry) => entry.options.name === 'conversation.chat.turnTail')
  assert.equal(tail.options.priority, -100)
  assert.equal(typeof tail.options.select, 'function')
  assert.deepEqual(Array.from(tail.options.select({
    turn: { data: new Map([['deliverables', { produced: [{ path: '/tmp/a.md', seq: 1 }] }]]) },
    seq: 1,
  })), ['/tmp/a.md'])

  const section = registrations.find((entry) => entry.options.name === 'settings.section')
  assert.equal(section.options.id, 'open-in-editor')
  assert.equal(section.options.order, 15)
})

test('declines the chain for remote browsers so the official row remains the fallback', async () => {
  const { plugin } = await loadFactory()
  let tail
  const ctx = {
    connection: { isLoopback: false, rpc: { call: async () => ({ ok: false, error: { message: 'denied' } }) } },
    effect(callback) { callback() },
    locale: { register: () => () => {}, bind: () => (key) => key },
    settingsScope: { bind: () => ({ getSnapshot() {}, subscribe() {}, set() {} }) },
    slots: {
      inject(name, callback) { callback() },
      register(options) {
        if (options.name === 'conversation.chat.turnTail') tail = options
        return () => {}
      },
    },
  }
  plugin.apply(ctx)
  assert.equal(tail.select({ turn: { data: new Map() }, seq: 1 }), null)
})

test('produced-file controls use fixed-geometry SVG icons instead of font glyphs', async () => {
  const { source } = await loadFactory()
  assert.match(source, /function FileIcon\(/)
  assert.match(source, /function ChevronIcon\(/)
  assert.match(source, /viewBox: '0 0 16 16'/)
  assert.doesNotMatch(source, /'◧'/)
  assert.doesNotMatch(source, /'⌄'/)
})

test('bundle contains split-button, one-shot editor, accessibility, and settings controls', async () => {
  const { source } = await loadFactory()
  assert.match(source, /dsh-open-in-editor-split/)
  assert.match(source, /aria-haspopup': 'menu'/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /payload\.editor = editor/)
  assert.match(source, /settings\.set\('defaultEditor', id\)/)
  assert.match(source, /settings\.getSnapshot\(\)\.value\?\.defaultEditor !== id/)
  assert.match(source, /resolveWorkspacePath\(cwd, path\)/)
  assert.match(source, /inputActions\?\.notify\?\./)
  assert.match(source, /MAX_VISIBLE_FILES = 6/)
})
