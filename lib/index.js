import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

import { EDITORS, createEditorHost } from './editor-host.js'

export const CHANNEL = '/open-in-editor'
export const SETTINGS_NAMESPACE = 'open-in-editor'
export const SETTINGS_NS = settingsNamespace(SETTINGS_NAMESPACE)
export const EDITOR_IDS = EDITORS.map((editor) => editor.id)

export const Config = z.object({
  defaultEditor: z.union(EDITOR_IDS).default('system'),
})

export const inject = ['connection']

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

  installSettingsSection(ctx, SETTINGS_NS, Config, entry, {
    setSource(source) {
      current = source
    },
    onChange() {},
  })

  const host = createEditorHost({
    getDefaultEditor: () => current().defaultEditor,
  })

  ctx.connection.rpc.handle(CHANNEL, async (endpoint, payload, signal) => {
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
  }, { authority: 'loopback' })
}
