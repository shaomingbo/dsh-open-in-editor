import z from '@deepseek-ai/schemastery'

import { EDITORS, createEditorHost } from './editor-host.js'

export const CHANNEL = '/open-in-editor'
export const SETTINGS_NAMESPACE = 'open-in-editor'
export const SETTINGS_NS = SETTINGS_NAMESPACE
export const EDITOR_IDS = EDITORS.map((editor) => editor.id)

export const Config = z.object({
  defaultEditor: z.union(EDITOR_IDS).default('system'),
})

export const inject = ['connection']

function registerLoopbackRpc(ctx, handler) {
  try {
    ctx.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' })
  } catch (error) {
    if (!String(error?.message ?? error).includes('webServer')) throw error
  }
  if (typeof ctx.connection.fetch?.register !== 'function') return
  const name = CHANNEL.slice(1)
  for (const endpoint of ['describe', 'open']) {
    ctx.connection.fetch.register({
      path: `/api/${name}/${endpoint}`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
          return new Response('content type must be application/json', { status: 415 })
        }
        let body
        try { body = await request.json() } catch { return new Response('body is not JSON', { status: 400 }) }
        const expected = `${name}/${endpoint}`
        if (body?.type !== 'client-request' || typeof body.rpcId !== 'string' || (body.method !== endpoint && body.method !== expected)) {
          return Response.json({ type: 'server-response', rpcId: body?.rpcId ?? 'invalid-request', result: { ok: false, error: { code: 'gateway/bad-request', message: 'invalid client-request message', details: { issues: [] } } } })
        }
        const result = await handler(endpoint, body.payload, request.signal)
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
      },
    })
  }
}

function success(value) {
  return { ok: true, value }
}

function failure(message) {
  return {
    ok: false,
    error: { code: 'internal', message, details: {} },
  }
}

function requireObject(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('request payload must be an object')
  }
  return payload
}

/** Register the host-side settings section and loopback opener RPC. */
export function apply(ctx, config = {}) {
  const entry = Config(config)
  let current = () => entry

  // The settings service is optional: the section attaches while it is present and the
  // opener keeps working without it. installSection registers the namespace with the
  // composition entry as the base layer and re-judges `current` on every commit.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, entry, {
      setSource(source) {
        current = source
      },
      onChange() {},
    })
  })

  const host = createEditorHost({
    getDefaultEditor: () => current().defaultEditor,
  })

  registerLoopbackRpc(ctx, async (endpoint, payload, signal) => {
    try {
      const input = requireObject(payload ?? {})
      if (endpoint === 'describe') {
        if (input.refresh !== undefined && typeof input.refresh !== 'boolean') {
          throw new Error('refresh must be a boolean')
        }
        return success(await host.describe({ refresh: input.refresh === true, signal }))
      }
      if (endpoint === 'open') {
        return success(await host.open({ path: input.path, editor: input.editor }, signal))
      }
      return failure(`unknown open-in-editor endpoint: ${endpoint}`)
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'open-in-editor request failed')
    }
  })
}
