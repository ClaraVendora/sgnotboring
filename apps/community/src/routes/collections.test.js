import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import collectionsRoutes from './collections.js'

const id = '11111111-1111-4111-8111-111111111111'
const placeId = '22222222-2222-4222-8222-222222222222'
const token = '33333333-3333-4333-8333-333333333333'
const missingPlace = '44444444-4444-4444-8444-444444444444'
const headers = { authorization: 'Bearer alice' }
const bob = { authorization: 'Bearer bob' }
async function setup(t, fail = false) {
  const row = { id, name: 'Weekend cafes', places: [], is_shared: false }
  const own = (userId, collectionId) => userId === 'alice' && collectionId === id
  const collections = {
    bookmarks: async (userId) => userId === 'alice' ? row.places : [],
    removeEverywhere: async (userId, place) => { if (userId === 'alice') row.places = row.places.filter((item) => item !== place) },
    list: async (userId) => { if (fail) throw new Error('secret SQL'); return userId === 'alice' ? [row] : [] },
    create: async (userId, name) => ({ id, name, user_id: userId }),
    get: async (userId, collectionId) => own(userId, collectionId) ? row : null,
    add: async (userId, collectionId, place) => {
      if (!own(userId, collectionId)) return false
      if (place === missingPlace) throw { code: 'PLACE_NOT_FOUND' }
      if (!row.places.includes(place)) row.places.push(place)
      return true
    },
    remove: async (userId, collectionId, place) => {
      if (!own(userId, collectionId)) return false
      row.places = row.places.filter((item) => item !== place)
      return true
    },
    share: async (userId, collectionId) => {
      if (!own(userId, collectionId)) return null
      row.is_shared = true
      return { share_token: token }
    },
    shared: async (value) => row.is_shared && value === token ? { id, name: row.name, places: row.places } : null,
  }
  const app = Fastify()
  await app.register(collectionsRoutes, { collections, verifyUser: async (value) => ['alice', 'bob'].includes(value)
    ? { id: value, role: 'authenticated', email_confirmed_at: '2026-01-01' } : null })
  t.after(() => app.close())
  return { app, row }
}

test('private collections require auth; creation uses the verified owner and validates names', async (t) => {
  const { app } = await setup(t)
  assert.equal((await app.inject('/collections')).statusCode, 401)
  assert.equal((await app.inject(`/collections/${id}`)).statusCode, 401)
  const created = await app.inject({ method: 'POST', url: '/collections', headers, payload: { name: '  Cafes  ', user_id: 'bob' } })
  assert.equal(created.statusCode, 201)
  assert.deepEqual(created.json().collection, { id, name: 'Cafes', user_id: 'alice' })
  for (const name of ['', '   ', 'a'.repeat(81)]) {
    assert.equal((await app.inject({ method: 'POST', url: '/collections', headers, payload: { name } })).statusCode, 400)
  }
  assert.deepEqual((await app.inject({ url: '/collections', headers: bob })).json(), { collections: [] })
  assert.equal((await app.inject({ url: '/collections/broken', headers })).statusCode, 400)
  assert.equal((await app.inject({ url: '/collections?place_id=broken', headers })).statusCode, 400)
})

test('other users cannot read, add, remove, or share an owned collection', async (t) => {
  const { app, row } = await setup(t)
  for (const [method, url] of [['GET', `/collections/${id}`], ['PUT', `/collections/${id}/places/${placeId}`],
    ['DELETE', `/collections/${id}/places/${placeId}`], ['POST', `/collections/${id}/share`]]) {
    assert.equal((await app.inject({ method, url, headers: bob })).statusCode, 404)
    assert.equal((await app.inject({ method, url })).statusCode, 401)
  }
  assert.equal(row.is_shared, false)
  assert.deepEqual(row.places, [])
})

test('shared links are view-only and only become public after sharing; membership changes are idempotent', async (t) => {
  const { app } = await setup(t)
  assert.equal((await app.inject(`/collections/shared/${token}`)).statusCode, 404)
  for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'PUT', url: `/collections/${id}/places/${placeId}`, headers })).statusCode, 200)
  const share = await app.inject({ method: 'POST', url: `/collections/${id}/share`, headers })
  assert.equal(share.json().share_token, token)
  const shared = await app.inject(`/collections/shared/${token}`)
  assert.equal(shared.statusCode, 200)
  assert.equal(shared.headers['cache-control'], 'no-store')
  assert.deepEqual(shared.json().collection.places, [placeId])
  assert.equal(shared.json().collection.user_id, undefined)
  for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'DELETE', url: `/collections/${id}/places/${placeId}`, headers })).statusCode, 200)
  assert.deepEqual((await app.inject(`/collections/shared/${token}`)).json().collection.places, [])
})

test('database details are not exposed in errors', async (t) => {
  const { app } = await setup(t, true)
  const res = await app.inject({ url: '/collections', headers })
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.json(), { error: 'Could not load collections' })
})

test('bookmark reads and removal across collections use the verified user', async (t) => {
  const { app, row } = await setup(t)
  row.places.push(placeId)
  assert.equal((await app.inject('/collections/bookmarks')).statusCode, 401)
  assert.equal((await app.inject({ method: 'DELETE', url: `/collections/places/${placeId}` })).statusCode, 401)
  assert.equal((await app.inject({ method: 'DELETE', url: '/collections/places/invalid', headers })).statusCode, 400)
  assert.deepEqual((await app.inject({ url: '/collections/bookmarks', headers })).json(), { place_ids: [placeId] })
  assert.deepEqual((await app.inject({ url: '/collections/bookmarks', headers: bob })).json(), { place_ids: [] })
  await app.inject({ method: 'DELETE', url: `/collections/places/${placeId}?user_id=alice`, headers: bob })
  assert.deepEqual(row.places, [placeId])
  for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'DELETE', url: `/collections/places/${placeId}`, headers })).statusCode, 200)
  assert.deepEqual(row.places, [])
})

test('adding a place the catalogue does not have returns 404', async (t) => {
  const { app } = await setup(t)
  const res = await app.inject({ method: 'PUT', url: `/collections/${id}/places/${missingPlace}`, headers })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.json(), { error: 'Place not found' })
})
