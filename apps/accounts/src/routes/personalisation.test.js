import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import meRoutes from './me.js'
import internalRoutes from './internal.js'
import { surveyQuestions, surveyTags } from '../services/preferences.js'

const placeId = '11111111-1111-4111-8111-111111111111'
const place = { id: placeId, name: 'Test cafe', tags: ['Cafe'] }
const headers = { authorization: 'Bearer user-a' }
const verifyUser = async (token) => ['user-a', 'user-b'].includes(token)
  ? { id: token, role: 'authenticated', email_confirmed_at: '2026-01-01' } : null

async function setup(t) {
  const rows = new Map()
  const saves = new Map()
  const preferences = {
    get: async (user) => rows.get(user) ?? null,
    put: async (user, tags) => { rows.set(user, { tags }); return { tags } },
  }
  const savedPlaces = {
    list: async (user) => saves.has(user) ? [{ ...place, saved: true }] : [],
    save: async (user, id) => {
      if (id !== placeId) return false
      saves.set(user, id)
      return true
    },
    remove: async (user) => { saves.delete(user) },
    ids: async (user) => saves.has(user) ? [placeId] : [],
  }
  const app = Fastify()
  await app.register(meRoutes, { verifyUser, preferences, savedPlaces })
  await app.register(internalRoutes, { preferences, savedPlaces })
  t.after(() => app.close())
  return { app, rows, saves }
}

test('survey has four questions; reading options and skipped preferences never creates a row', async (t) => {
  const { app, rows } = await setup(t)
  const res = await app.inject({ url: '/me/preferences/options', headers })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json().questions, surveyQuestions)
  assert.equal(surveyQuestions.length, 4)
  assert.ok(surveyTags.includes('No pork'))
  assert.deepEqual((await app.inject({ url: '/me/preferences', headers })).json(), { preferences: null })
  assert.equal(rows.size, 0)
})

test('preference replacement is owner-scoped and validates tags, duplicates and single budget', async (t) => {
  const { app, rows } = await setup(t)
  const url = '/me/preferences?user_id=user-b'
  const res = await app.inject({ method: 'PUT', url, headers, payload: { tags: ['Cafe', 'No pork'], user_id: 'user-b' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(rows.get('user-a'), { tags: ['Cafe', 'No pork'] })
  assert.equal(rows.has('user-b'), false)
  for (const payload of [{}, { tags: ['not a tag'] }, { tags: ['Cafe', 'Cafe'] },
    { tags: ['Budget', 'Splurge'] }, { tags: Array(31).fill('Cafe') }, { tags: [null] }]) {
    assert.equal((await app.inject({ method: 'PUT', url, headers, payload })).statusCode, 400)
  }
  assert.deepEqual(rows.get('user-a'), { tags: ['Cafe', 'No pork'] })
  assert.equal((await app.inject({ method: 'PUT', url, headers, payload: { tags: [] } })).statusCode, 200)
  assert.equal(rows.size, 1)
  assert.deepEqual(rows.get('user-a').tags, [])
})

test('all personal endpoints reject guests and invalid tokens', async (t) => {
  const { app, rows, saves } = await setup(t)
  for (const [method, url, payload] of [
    ['GET', '/me/preferences/options'], ['GET', '/me/preferences'],
    ['PUT', '/me/preferences', { tags: ['Cafe'] }], ['GET', '/me/saved-places'],
    ['PUT', `/me/saved-places/${placeId}`], ['DELETE', `/me/saved-places/${placeId}`],
  ]) {
    for (const authorization of ['', 'Basic x', 'Bearer invalid']) {
      const res = await app.inject({ method, url, payload, headers: { authorization } })
      assert.equal(res.statusCode, 401)
      assert.equal(res.headers['cache-control'], 'no-store')
    }
  }
  assert.equal(rows.size + saves.size, 0)
})

test('idempotent saves/removals are scoped to the verified user', async (t) => {
  const { app, saves } = await setup(t)
  const url = `/me/saved-places/${placeId}?user_id=user-b`
  for (let n = 0; n < 2; n++) {
    assert.deepEqual((await app.inject({ method: 'PUT', url, headers })).json(), { saved: true })
  }
  assert.equal(saves.size, 1)
  assert.equal(saves.has('user-b'), false)
  for (const token of ['user-a', 'user-b']) {
    const saved = await app.inject({ url: '/me/saved-places', headers: { authorization: `Bearer ${token}` } })
    assert.equal(saved.json().count, token === 'user-a' ? 1 : 0)
  }
  for (let n = 0; n < 2; n++) {
    assert.deepEqual((await app.inject({ method: 'DELETE', url, headers })).json(), { saved: false })
  }
  assert.equal(saves.size, 0)
})

test('internal taste returns survey tags and saved place ids only', async (t) => {
  const { app } = await setup(t)
  const userId = '33333333-3333-4333-8333-333333333333'
  assert.deepEqual((await app.inject(`/internal/users/${userId}/taste`)).json(), { survey: [], savedPlaceIds: [] })
  assert.equal((await app.inject('/internal/users/user-a/taste')).statusCode, 400)
})

test('invalid UUIDs, missing places and database failures return safe errors', async (t) => {
  const { app } = await setup(t)
  assert.equal((await app.inject({ method: 'PUT', url: '/me/saved-places/not-uuid', headers })).statusCode, 400)
  assert.equal((await app.inject({ method: 'PUT', url: '/me/saved-places/22222222-2222-4222-8222-222222222222', headers })).statusCode, 404)
  const failed = Fastify()
  t.after(() => failed.close())
  const fail = async () => { throw new Error('private database details') }
  await failed.register(meRoutes, { verifyUser, preferences: { get: fail, put: fail },
    savedPlaces: { list: fail, save: fail, remove: fail } })
  for (const [method, url, payload] of [
    ['GET', '/me/preferences'], ['PUT', '/me/preferences', { tags: [] }],
    ['GET', '/me/saved-places'], ['PUT', `/me/saved-places/${placeId}`], ['DELETE', `/me/saved-places/${placeId}`],
  ]) {
    const res = await failed.inject({ method, url, payload, headers })
    assert.equal(res.statusCode, 500)
    assert.ok(!res.body.includes('private'))
  }
})
