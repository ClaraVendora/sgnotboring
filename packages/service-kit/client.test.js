import test from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient, ServiceError } from './client.js'

test('sends JSON and returns the parsed body', async () => {
  let seen
  const client = createServiceClient('places', 'http://places.test/', { fetchImpl: async (url, init) => {
    seen = { url, init }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } })
  assert.deepEqual(await client.post('/internal/x', { a: 1 }), { ok: true })
  assert.equal(seen.url, 'http://places.test/internal/x')
  assert.equal(seen.init.headers['content-type'], 'application/json')
  assert.equal(seen.init.body, '{"a":1}')
})

test('an unreachable service is a 503 ServiceError', async () => {
  const client = createServiceClient('places', 'http://places.test', { fetchImpl: async () => { throw new TypeError('fetch failed') } })
  await assert.rejects(client.get('/x'), (err) => err instanceof ServiceError && err.status === 503 && err.service === 'places')
})

test('an error answer keeps its status', async () => {
  const client = createServiceClient('accounts', 'http://accounts.test', {
    fetchImpl: async () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 }) })
  await assert.rejects(client.get('/x'), (err) => err instanceof ServiceError && err.status === 400 && /bad/.test(err.message))
})
