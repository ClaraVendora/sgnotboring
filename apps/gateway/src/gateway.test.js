import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { buildGateway } from './app.js'
import { serviceFor } from './routes.js'

const id = '11111111-1111-4111-8111-111111111111'

test('every public path goes to the service that owns it', () => {
  const cases = {
    '/places': 'places', [`/places/${id}`]: 'places', '/tags': 'places',
    [`/places/${id}/reviews`]: 'community', [`/places/${id}/review`]: 'community',
    '/me/reviews': 'community', [`/me/reviews/${id}`]: 'community',
    '/collections': 'community', '/collections/bookmarks': 'community', [`/collections/shared/${id}`]: 'community',
    '/ask': 'ask',
    '/me': 'accounts', '/me/preferences': 'accounts', '/me/preferences/options': 'accounts',
    '/me/saved-places': 'accounts', [`/me/saved-places/${id}`]: 'accounts',
    '/internal/vocabulary': null, '/internal/places/lookup': null, [`/internal/users/${id}/taste`]: null,
    '/asked': null, '/placesx': null, '/': null, '/health/x': null,
  }
  for (const [path, service] of Object.entries(cases)) assert.equal(serviceFor(path), service, path)
})

// Four stub services that echo what they received.
async function stubs(t) {
  const upstreams = {}
  for (const name of ['places', 'ask', 'accounts', 'community']) {
    const app = Fastify()
    app.all('/*', async (req) => ({ service: name, method: req.method, url: req.url, body: req.body ?? null,
      authorization: req.headers.authorization ?? null }))
    await app.listen({ port: 0, host: '127.0.0.1' })
    t.after(() => app.close())
    upstreams[name] = `http://127.0.0.1:${app.server.address().port}`
  }
  return upstreams
}

test('forwards method, path, query, body and Authorization unchanged', async (t) => {
  const gateway = await buildGateway({ upstreams: await stubs(t), origins: ['http://localhost:3000'], logger: false })
  t.after(() => gateway.close())
  const res = await gateway.inject({ method: 'PUT', url: `/places/${id}/review?x=1`,
    headers: { authorization: 'Bearer abc', 'content-type': 'application/json' }, payload: { body: 'Nice', rating: 5 } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { service: 'community', method: 'PUT', url: `/places/${id}/review?x=1`,
    body: { body: 'Nice', rating: 5 }, authorization: 'Bearer abc' })
  const ask = await gateway.inject({ method: 'POST', url: '/ask', payload: { message: 'supper' } })
  assert.deepEqual([ask.json().service, ask.json().body], ['ask', { message: 'supper' }])
  assert.equal((await gateway.inject('/places?limit=2&tags=Cafe')).json().url, '/places?limit=2&tags=Cafe')
})

test('internal and unknown paths are 404, CORS is answered by the gateway', async (t) => {
  const gateway = await buildGateway({ upstreams: await stubs(t), origins: ['http://localhost:3000'], logger: false })
  t.after(() => gateway.close())
  for (const url of ['/internal/vocabulary', `/internal/users/${id}/taste`, '/nope']) {
    assert.equal((await gateway.inject(url)).statusCode, 404, url)
  }
  const preflight = await gateway.inject({ method: 'OPTIONS', url: '/me', headers: {
    origin: 'http://localhost:3000', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization' } })
  assert.equal(preflight.statusCode, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:3000')
  const proxied = await gateway.inject({ url: '/tags', headers: { origin: 'http://localhost:3000' } })
  assert.equal(proxied.headers['access-control-allow-origin'], 'http://localhost:3000')
  const other = await gateway.inject({ url: '/tags', headers: { origin: 'https://evil.example' } })
  assert.equal(other.headers['access-control-allow-origin'], undefined)
})

test('a service that is down becomes a 502 without details', async (t) => {
  const gateway = await buildGateway({ logger: false, origins: [],
    upstreams: { places: 'http://127.0.0.1:9', ask: 'http://127.0.0.1:9', accounts: 'http://127.0.0.1:9', community: 'http://127.0.0.1:9' } })
  t.after(() => gateway.close())
  const res = await gateway.inject('/places')
  assert.equal(res.statusCode, 502)
  assert.deepEqual(res.json(), { error: 'Service unavailable' })
})
