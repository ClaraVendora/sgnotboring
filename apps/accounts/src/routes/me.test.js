import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import meRoutes from './me.js'

const user = { id: 'user-a', role: 'authenticated', email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: { display_name: 'Kejia' } }

async function server(t, verifyUser) {
  const app = Fastify()
  await app.register(meRoutes, { verifyUser })
  t.after(() => app.close())
  return app
}

test('missing or malformed credentials return 401 without contacting Auth', async (t) => {
  const app = await server(t, () => assert.fail('Must not contact Auth'))
  for (const authorization of ['', 'Basic abc', 'Bearer', 'Bearer a b', 'Bearer a,Bearer b']) {
    const res = await app.inject({ url: '/me', headers: { authorization } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.headers['cache-control'], 'no-store')
  }
})

test('unverified, unconfirmed and non-user credentials are rejected', async (t) => {
  for (const response of [null, { ...user, email_confirmed_at: null }, { ...user, role: 'service_role' }]) {
    const app = await server(t, async () => response)
    assert.equal((await app.inject({ url: '/me', headers: { authorization: 'Bearer invalid' } })).statusCode, 401)
  }
})

test('verified user is authoritative and response excludes credentials', async (t) => {
  const app = await server(t, async (token) => {
    assert.equal(token, 'valid')
    return { ...user, extra_secret: 'never return' }
  })
  const res = await app.inject({ url: '/me?user_id=user-b', headers: { authorization: 'Bearer valid' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { user: { id: user.id, email: user.email, display_name: 'Kejia' } })
})

test('Auth outage fails closed without disclosing upstream details', async (t) => {
  const app = await server(t, async () => { throw new Error('private upstream information') })
  const res = await app.inject({ url: '/me', headers: { authorization: 'Bearer valid' } })
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.json(), { error: 'Authentication temporarily unavailable' })
})
