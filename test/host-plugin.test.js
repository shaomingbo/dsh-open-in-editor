import assert from 'node:assert/strict'
import test from 'node:test'

import { CHANNEL, Config, EDITOR_IDS, SETTINGS_NAMESPACE, apply, inject } from '../lib/index.js'

test('declares host dependencies and validates the default editor schema', () => {
  assert.deepEqual(inject, ['connection'])
  assert.equal(CHANNEL, '/open-in-editor')
  assert.equal(SETTINGS_NAMESPACE, 'open-in-editor')
  assert.deepEqual(EDITOR_IDS, ['system', 'zed', 'vscode', 'xcode'])
  assert.deepEqual(Config({}), { defaultEditor: 'system' })
  assert.deepEqual(Config({ defaultEditor: 'zed' }), { defaultEditor: 'zed' })
  assert.throws(() => Config({ defaultEditor: 'arbitrary' }))
})

test('registers a loopback RPC and rejects malformed or unknown requests', async () => {
  let handler
  let channel
  let options
  const ctx = {
    connection: { rpc: { handle(nextChannel, nextHandler, nextOptions) {
      channel = nextChannel
      handler = nextHandler
      options = nextOptions
      return () => {}
    } } },
    inject() {},
  }
  apply(ctx, {})
  assert.equal(channel, CHANNEL)
  assert.deepEqual(options, { authority: 'loopback' })

  const signal = new AbortController().signal
  const malformed = await handler('describe', { refresh: 'yes' }, signal)
  assert.equal(malformed.ok, false)
  assert.match(malformed.error.message, /boolean/)
  const unknown = await handler('missing', {}, signal)
  assert.equal(unknown.ok, false)
  assert.match(unknown.error.message, /unknown open-in-editor endpoint/)
})
