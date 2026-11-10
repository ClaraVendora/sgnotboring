import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import meRoutes from '../routes/me.js'

// Explicit opt-in, localhost only. Never runs against a hosted project.
test('local email confirmation, password login, JWT verification, refresh and logout', {
  skip: process.env.RUN_LOCAL_AUTH_TEST !== '1', timeout: 45000,
}, async (t) => {
  const origin = process.env.SUPABASE_URL
  assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(origin))
  const mailOrigin = 'http://127.0.0.1:54324'
  const email = `sgn013-${randomUUID()}@example.com`
  const password = `Local-${randomUUID()}`
  const headers = { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
  const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
  async function auth(path, body, token) {
    const res = await fetch(`${origin}/auth/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  let userId
  let messageId
  t.after(async () => {
    if (userId) {
      const res = await fetch(`${origin}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders })
      assert.equal(res.status, 200, 'test user removed')
    }
    if (messageId) {
      await fetch(`${mailOrigin}/api/v1/messages`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: [messageId] }),
      })
    }
  })
  const settings = await auth('/settings')
  assert.equal(settings.body.external.email, true)
  assert.equal(settings.body.mailer_autoconfirm, false, 'email confirmation required')
  const signup = await auth('/signup?redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback', {
    email, password, data: { display_name: 'Kejia Test' },
  })
  assert.equal(signup.status, 200)
  userId = signup.body.id || signup.body.user?.id
  assert.ok(userId)
  assert.equal(signup.body.access_token, undefined)
  const beforeConfirmation = await auth('/token?grant_type=password', { email, password })
  assert.equal(beforeConfirmation.status, 400)
  assert.equal(beforeConfirmation.body.error_code, 'email_not_confirmed')
  let message
  for (let attempt = 0; attempt < 8 && !message; attempt++) {
    const inbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json()
    message = inbox.messages.find((item) => item.To.some((to) => to.Address === email))
    if (!message) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(message, 'confirmation email arrives in Mailpit')
  messageId = message.ID
  const contents = await (await fetch(`${mailOrigin}/api/v1/message/${messageId}`)).json()
  const link = contents.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll('&amp;', '&')
  assert.ok(link, 'confirmation link exists')
  assert.equal(new URL(link).origin, origin)
  const confirmed = await fetch(link, { redirect: 'manual' })
  assert.equal(confirmed.status, 303)
  const callback = new URL(confirmed.headers.get('location'))
  assert.equal(callback.origin + callback.pathname, 'http://localhost:3000/auth/callback')
  assert.ok(new URLSearchParams(callback.hash.slice(1)).get('access_token'))

  const wrongPassword = await auth('/token?grant_type=password', { email, password: 'wrong-password' })
  assert.equal(wrongPassword.status, 400)
  const login = await auth('/token?grant_type=password', { email, password })
  assert.equal(login.status, 200)
  const refresh = await auth('/token?grant_type=refresh_token', { refresh_token: login.body.refresh_token })
  assert.equal(refresh.status, 200)
  const app = Fastify()
  await app.register(meRoutes)
  t.after(() => app.close())
  const me = await app.inject({ url: '/me', headers: { authorization: `Bearer ${refresh.body.access_token}` } })
  assert.equal(me.statusCode, 200)
  assert.equal(me.json().user.id, userId)
  const tokenParts = refresh.body.access_token.split('.')
  const claims = JSON.parse(Buffer.from(tokenParts[1], 'base64url'))
  tokenParts[1] = Buffer.from(JSON.stringify({ ...claims, sub: randomUUID() })).toString('base64url')
  for (const token of [tokenParts.join('.'), 'invalid', process.env.SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    const rejected = await app.inject({ url: '/me', headers: { authorization: `Bearer ${token}` } })
    assert.equal(rejected.statusCode, 401)
  }
  const logout = await auth('/logout?scope=local', {}, refresh.body.access_token)
  assert.equal(logout.status, 204)
  const revoked = await auth('/token?grant_type=refresh_token', { refresh_token: refresh.body.refresh_token })
  assert.notEqual(revoked.status, 200, 'logout revokes refresh session')
})
