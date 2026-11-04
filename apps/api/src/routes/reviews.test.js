import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import placesRoutes from './places.js'
import meRoutes from './me.js'

const id = '11111111-1111-4111-8111-111111111111'
const missing = '22222222-2222-4222-8222-222222222222'
const headers = { authorization: 'Bearer alice' }
const aliceReview = '33333333-3333-4333-8333-333333333333'
const bobReview = '44444444-4444-4444-8444-444444444444'
async function setup(t, fail = false) {
  const rows = new Map()
  const reviews = {
    list: async (placeId) => { if (fail) throw new Error('private database detail'); return placeId === id ? [...rows.values()] : null },
    save: async (placeId, user, body, rating) => {
      if (fail) throw new Error('private database detail')
      if (placeId !== id) throw { code: '23503' }
      const row = { id: user.id === 'alice' ? aliceReview : bobReview, user_id: user.id, body, rating }
      rows.set(user.id, row)
      return row
    },
    listOwn: async (userId) => [...rows.values()].filter((row) => row.user_id === userId),
    edit: async (userId, reviewId, body, rating) => {
      const row = rows.get(userId)
      if (row?.id !== reviewId) return null
      rows.set(userId, { ...row, body, rating })
      return rows.get(userId)
    },
    remove: async (userId, reviewId) => rows.get(userId)?.id === reviewId ? rows.delete(userId) : false,
  }
  const app = Fastify()
  const verifyUser = async (token) => ['alice', 'bob'].includes(token)
    ? { id: token, role: 'authenticated', email_confirmed_at: '2026-01-01' } : null
  await app.register(placesRoutes, { reviews, verifyUser })
  await app.register(meRoutes, { reviews, verifyUser })
  t.after(() => app.close())
  return { app, rows }
}

test('public reads, authenticated writes and edits are scoped to the verified author', async (t) => {
  const { app, rows } = await setup(t)
  const url = `/places/${id}/review`
  assert.equal((await app.inject({ method: 'PUT', url, payload: { body: 'Hello', rating: 4 } })).statusCode, 401)
  let res = await app.inject({ method: 'PUT', url, headers, payload: { body: '  First visit  ', rating: 4, user_id: 'bob' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().review.user_id, 'alice')
  assert.equal(rows.get('alice').body, 'First visit')
  await app.inject({ method: 'PUT', url, headers, payload: { body: 'Edited visit', rating: 5 } })
  assert.equal(rows.size, 1)
  res = await app.inject({ method: 'PUT', url, headers: { authorization: 'Bearer bob' }, payload: { body: 'Bob visit', rating: 3, user_id: 'alice', id: 'alice' } })
  assert.equal(res.statusCode, 200)
  assert.equal(rows.get('alice').body, 'Edited visit')
  assert.equal(rows.get('alice').rating, 5)
  const list = await app.inject(`/places/${id}/reviews`)
  assert.equal(list.statusCode, 200)
  assert.equal(list.headers['cache-control'], 'no-store')
  assert.equal(list.json().reviews.length, 2)
})

test('validates place IDs and review text and reports missing places', async (t) => {
  const { app } = await setup(t)
  for (const payload of [{}, { body: '', rating: 4 }, { body: ' \n ', rating: 4 }, { body: 'a'.repeat(2001), rating: 4 }, { body: {}, rating: 4 },
    { body: 'Missing rating' }, ...[0, 6, 1.5].map((rating) => ({ body: 'Invalid rating', rating }))]) {
    const res = await app.inject({ method: 'PUT', url: `/places/${id}/review`, headers, payload })
    assert.equal(res.statusCode, 400)
  }
  assert.equal((await app.inject('/places/not-an-id/reviews')).statusCode, 400)
  assert.equal((await app.inject(`/places/${missing}/reviews`)).statusCode, 404)
  assert.equal((await app.inject({ method: 'PUT', url: `/places/${missing}/review`, headers, payload: { body: 'Valid review', rating: 4 } })).statusCode, 404)
})

test('database failures use safe public error messages', async (t) => {
  const { app } = await setup(t, true)
  const read = await app.inject(`/places/${id}/reviews`)
  assert.equal(read.statusCode, 500)
  assert.deepEqual(read.json(), { error: 'Could not load reviews' })
  const write = await app.inject({ method: 'PUT', url: `/places/${id}/review`, headers, payload: { body: 'Valid review', rating: 4 } })
  assert.equal(write.statusCode, 500)
  assert.deepEqual(write.json(), { error: 'Could not save review' })
})

test('review history is private and editing/deleting cannot target another author', async (t) => {
  const { app, rows } = await setup(t)
  await app.inject({ method: 'PUT', url: `/places/${id}/review`, headers, payload: { body: 'Alice review', rating: 4 } })
  const bobHeaders = { authorization: 'Bearer bob' }
  assert.equal((await app.inject('/me/reviews')).statusCode, 401)
  assert.deepEqual((await app.inject({ url: '/me/reviews', headers: bobHeaders })).json(), { reviews: [] })
  assert.equal((await app.inject({ url: '/me/reviews', headers })).json().reviews.length, 1)
  const url = `/me/reviews/${aliceReview}`
  for (const method of ['PUT', 'DELETE']) {
    const payload = method === 'PUT' ? { body: 'Stolen', rating: 1, user_id: 'alice' } : undefined
    assert.equal((await app.inject({ method, url, headers: bobHeaders, payload })).statusCode, 404)
  }
  assert.equal(rows.get('alice').body, 'Alice review')
  assert.equal((await app.inject({ method: 'PUT', url, headers, payload: { body: 'Updated', rating: 5 } })).statusCode, 200)
  assert.equal(rows.get('alice').rating, 5)
  assert.equal((await app.inject({ method: 'DELETE', url, headers })).statusCode, 200)
  assert.equal(rows.size, 0)
  assert.equal((await app.inject({ method: 'DELETE', url, headers })).statusCode, 404)
})
