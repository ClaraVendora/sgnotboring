import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import meRoutes from './me.js'
import placesRoutes from './places.js'
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
      if (id !== placeId) throw { code: '23503' }
      saves.set(user, id)
    },
    remove: async (user) => { saves.delete(user) },
    annotate: async (places, user) => places.map((item) => ({ ...item, saved: saves.has(user) })),
  }
  const app = Fastify()
  await app.register(meRoutes, { verifyUser, preferences, savedPlaces })
  await app.register(placesRoutes, { verifyUser, savedPlaces, searchPlaces: async () => [place],
    db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: place }) }) }) }) } })
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

test('idempotent saves/removals and list/detail flags isolate users and guests', async (t) => {
  const { app, saves } = await setup(t)
  const url = `/me/saved-places/${placeId}?user_id=user-b`
  for (let n = 0; n < 2; n++) {
    assert.deepEqual((await app.inject({ method: 'PUT', url, headers })).json(), { saved: true })
  }
  assert.equal(saves.size, 1)
  assert.equal(saves.has('user-b'), false)
  for (const token of ['user-a', 'user-b', null]) {
    const scopedHeaders = token ? { authorization: `Bearer ${token}` } : {}
    const list = await app.inject({ url: '/places', headers: scopedHeaders })
    assert.equal(list.statusCode, 200)
    assert.equal(list.json()[0].saved, token === 'user-a')
    assert.equal(list.headers['cache-control'], 'no-store')
    const detail = await app.inject({ url: `/places/${placeId}`, headers: scopedHeaders })
    assert.equal(detail.json().saved, token === 'user-a')
    if (token) {
      const saved = await app.inject({ url: '/me/saved-places', headers: scopedHeaders })
      assert.equal(saved.json().count, token === 'user-a' ? 1 : 0)
    }
  }
  for (const url of ['/places', `/places/${placeId}`]) {
    assert.equal((await app.inject({ url, headers: { authorization: 'Bearer invalid' } })).statusCode, 401)
  }
  for (let n = 0; n < 2; n++) {
    assert.deepEqual((await app.inject({ method: 'DELETE', url, headers })).json(), { saved: false })
  }
  assert.equal(saves.size, 0)
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

test('public browse never depends on Auth or saved flags being available', async (t) => {
  const fail = async () => { throw new Error('private outage details') }
  const app = Fastify()
  t.after(() => app.close())
  await app.register(placesRoutes, { verifyUser: fail, savedPlaces: { annotate: fail }, searchPlaces: async () => [place],
    db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: place }) }) }) }) } })
  for (const url of ['/places', `/places/${placeId}`]) {
    // Auth unreachable: a supplied token is served as a guest instead of 503.
    const outage = await app.inject({ url, headers })
    assert.equal(outage.statusCode, 200)
    assert.equal([outage.json()].flat()[0].saved, false)
    // Saved-flag lookup failure falls back to saved: false instead of 500.
    const guest = await app.inject({ url })
    assert.equal(guest.statusCode, 200)
    assert.equal([guest.json()].flat()[0].saved, false)
    assert.ok(!guest.body.includes('private'))
  }
})
