import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function text(path) {
  return readFile(fileURLToPath(new URL(path, root)), 'utf8')
}

test('package exposes a host/client DSH bundle with stable ids', async () => {
  const pkg = JSON.parse(await text('package.json'))
  assert.equal(pkg.name, 'dsh-open-in-editor')
  assert.equal(pkg.exports['.'], './lib/index.js')
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-api-remotes'))
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-deliverables'))
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))

  const patch = await text('cordis.patch.yml')
  assert.match(patch, /id: dsh-open-in-editor/)
  assert.match(patch, /name: dsh-open-in-editor/)
})
