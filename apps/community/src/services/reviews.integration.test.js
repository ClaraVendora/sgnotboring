import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Fastify from 'fastify'
import reviewsRoutes from '../routes/reviews.js'
import { createReviewsService } from './reviews.js'

// Places lookups straight from catalog.places, standing in for the Places service.
const catalogLookup = (admin) => ({
  async lookup(ids, view = 'card') {
    const fields = { card: '*', full: '*', tags: 'id,tags', name: 'id,name' }[view]
    const { data, error } = await admin.schema('catalog').from('places').select(fields).in('id', ids)
    if (error) throw error
    return ids.map((id) => data.find((place) => place.id === id)).filter(Boolean)
  },
})

test('local reviews persist, support author edits, and disallow direct browser writes', {
  skip: process.env.RUN_LOCAL_REVIEWS_TEST !== '1', timeout: 60000,
}, async (t) => {
  const url = process.env.SUPABASE_URL
  assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url), 'local database only')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
  const guest = createClient(url, process.env.SUPABASE_ANON_KEY, options)
  const accounts = []
  t.after(async () => {
    for (const account of accounts) assert.equal((await admin.auth.admin.deleteUser(account.id)).error, null)
  })
  for (const name of ['Review Alice', 'Review Bob']) {
    const email = `review-${randomUUID()}@example.com`
    const password = `Test-${randomUUID()}`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } })
    assert.equal(error, null)
    const account = { id: data.user.id }
    accounts.push(account)
    const client = createClient(url, process.env.SUPABASE_ANON_KEY, options)
    const login = await client.auth.signInWithPassword({ email, password })
    assert.equal(login.error, null)
    Object.assign(account, { client, token: login.data.session.access_token })
  }
  const { data: places } = await admin.schema('catalog').from('places').select('id').limit(1)
  const placeId = places[0].id
  const app = Fastify()
  await app.register(reviewsRoutes, { reviews: createReviewsService(undefined, catalogLookup(admin)) })
  t.after(() => app.close())
  const write = (account, body, extra = {}) => app.inject({ method: 'PUT', url: `/places/${placeId}/review`,
    headers: { authorization: `Bearer ${account.token}` }, payload: { body, rating: 4, ...extra } })
  const first = await write(accounts[0], '  Lovely coffee  ')
  assert.equal(first.statusCode, 200)
  const initial = first.json().review
  assert.equal(initial.author_name, 'Review Alice')
  assert.equal(initial.body, 'Lovely coffee')
  assert.equal(initial.rating, 4)
  const edit = await write(accounts[0], 'Lovely coffee and cake', { rating: 5 })
  assert.equal(edit.statusCode, 200)
  assert.equal(edit.json().review.id, initial.id)
  assert.equal(edit.json().review.created_at, initial.created_at)
  assert.equal(edit.json().review.rating, 5)
  const second = await write(accounts[1], 'My own experience', { user_id: accounts[0].id, id: initial.id })
  assert.equal(second.statusCode, 200)
  assert.equal(second.json().review.user_id, accounts[1].id)
  const list = await app.inject(`/places/${placeId}/reviews`)
  assert.equal(list.statusCode, 200)
  assert.equal(list.json().reviews.find((row) => row.id === initial.id).body, 'Lovely coffee and cake')
  assert.equal(list.json().reviews.filter((row) => accounts.some((account) => account.id === row.user_id)).length, 2)
  assert.ok(!JSON.stringify(list.json()).includes('@example.com'))
  assert.equal((await guest.schema('community').from('place_reviews').select('body').eq('id', initial.id)).error, null)
  const unauthorized = await accounts[1].client.schema('community').from('place_reviews').update({ body: 'Stolen' }).eq('id', initial.id)
  assert.ok(unauthorized.error)
  assert.ok((await accounts[1].client.schema('community').from('place_reviews').insert({ place_id: placeId, user_id: accounts[0].id, author_name: 'Imposter', body: 'No' })).error)
  assert.ok((await guest.schema('community').from('place_reviews').insert({ place_id: placeId, user_id: accounts[0].id, author_name: 'Guest', body: 'No' })).error)
  const ownApi = (account, method, path, payload) => app.inject({ method, url: path, payload, headers: { authorization: `Bearer ${account.token}` } })
  const history = await ownApi(accounts[0], 'GET', '/me/reviews')
  assert.equal(history.statusCode, 200)
  assert.equal(history.json().reviews.length, 1)
  assert.ok(history.json().reviews[0].place.name)
  assert.equal(history.json().reviews[0].created_at, initial.created_at)
  const ownPath = `/me/reviews/${initial.id}`
  assert.equal((await ownApi(accounts[1], 'PUT', ownPath, { body: 'Stolen', rating: 1 })).statusCode, 404)
  assert.equal((await ownApi(accounts[1], 'DELETE', ownPath)).statusCode, 404)
  const updated = await ownApi(accounts[0], 'PUT', ownPath, { body: 'Edited from history', rating: 3 })
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.json().review.rating, 3)
  assert.equal(updated.json().review.created_at, initial.created_at)
  for (const rating of [0, 6]) assert.equal((await admin.schema('community').from('place_reviews').update({ rating }).eq('id', initial.id)).error.code, '23514')
  assert.equal((await ownApi(accounts[0], 'DELETE', ownPath)).statusCode, 200)
  assert.equal((await ownApi(accounts[0], 'GET', '/me/reviews')).json().reviews.length, 0)
  assert.equal((await ownApi(accounts[1], 'GET', '/me/reviews')).json().reviews.length, 1)
  assert.equal((await admin.schema('community').from('place_reviews').insert({ place_id: placeId, user_id: accounts[0].id, author_name: 'Legacy author', body: 'Older unrated review' })).error, null)
  const legacy = (await ownApi(accounts[0], 'GET', '/me/reviews')).json().reviews[0]
  assert.equal(legacy.rating, null)
  assert.equal((await ownApi(accounts[0], 'PUT', `/me/reviews/${legacy.id}`, { body: 'Now rated', rating: 5 })).statusCode, 200)
})
