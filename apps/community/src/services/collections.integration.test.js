import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Fastify from 'fastify'
import collectionsRoutes from '../routes/collections.js'
import { createCollectionsService } from './collections.js'

// Places lookups straight from catalog.places, standing in for the Places service.
const catalogLookup = (admin) => ({
  async lookup(ids, view = 'card') {
    const fields = { card: '*', full: '*', tags: 'id,tags', name: 'id,name' }[view]
    const { data, error } = await admin.schema('catalog').from('places').select(fields).in('id', ids)
    if (error) throw error
    return ids.map((id) => data.find((place) => place.id === id)).filter(Boolean)
  },
})

test('local collection persistence, private RLS, ownership, idempotent membership and explicit view-only sharing', {
  skip: process.env.RUN_LOCAL_COLLECTIONS_TEST !== '1', timeout: 60000,
}, async (t) => {
  const url = process.env.SUPABASE_URL
  assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url), 'local database only')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
  const guest = createClient(url, process.env.SUPABASE_ANON_KEY, options)
  const users = []
  t.after(async () => {
    for (const user of users) assert.equal((await admin.auth.admin.deleteUser(user.id)).error, null)
  })
  for (let i = 0; i < 2; i++) {
    const email = `collection-${randomUUID()}@example.com`
    const password = `Test-${randomUUID()}`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    assert.equal(error, null)
    const user = { id: data.user.id }
    users.push(user)
    const client = createClient(url, process.env.SUPABASE_ANON_KEY, options)
    const login = await client.auth.signInWithPassword({ email, password })
    assert.equal(login.error, null)
    Object.assign(user, { client, token: login.data.session.access_token })
  }
  const app = Fastify()
  await app.register(collectionsRoutes, { collections: createCollectionsService(undefined, catalogLookup(admin)) })
  t.after(() => app.close())
  const api = (user, method, path, payload) => app.inject({ method, url: path, payload, headers: user ? { authorization: `Bearer ${user.token}` } : {} })
  const [alice, bob] = users
  const created = await api(alice, 'POST', '/collections', { name: '  Weekend cafes  ', user_id: bob.id })
  assert.equal(created.statusCode, 201)
  const collection = created.json().collection
  assert.equal(collection.name, 'Weekend cafes')
  assert.equal(collection.share_token, undefined)
  const path = `/collections/${collection.id}`
  const { data: row } = await admin.schema('community').from('collections').select('share_token,user_id').eq('id', collection.id).single()
  assert.equal(row.user_id, alice.id)
  const sharedPath = `/collections/shared/${row.share_token}`
  assert.equal((await api(null, 'GET', sharedPath)).statusCode, 404)
  assert.equal((await api(bob, 'GET', path)).statusCode, 404)
  assert.deepEqual((await api(bob, 'GET', '/collections')).json().collections, [])
  const { data: places } = await admin.schema('catalog').from('places').select('id').limit(2)
  const placeId = places[0].id
  assert.equal((await api(alice, 'GET', `/collections?place_id=${placeId}`)).json().collections[0].contains_place, false)
  for (let i = 0; i < 2; i++) assert.equal((await api(alice, 'PUT', `${path}/places/${placeId}`)).statusCode, 200)
  assert.equal((await api(alice, 'GET', path)).json().collection.places.length, 1)
  assert.equal((await api(alice, 'GET', '/collections')).json().collections[0].place_count, 1)
  assert.equal((await api(alice, 'GET', `/collections?place_id=${placeId}`)).json().collections[0].contains_place, true)
  assert.deepEqual((await api(bob, 'GET', `/collections?place_id=${placeId}`)).json().collections, [])
  assert.equal((await api(bob, 'PUT', `${path}/places/${placeId}`)).statusCode, 404)
  assert.equal((await api(bob, 'DELETE', `${path}/places/${placeId}`)).statusCode, 404)
  assert.equal((await api(bob, 'POST', `${path}/share`)).statusCode, 404)
  assert.deepEqual((await bob.client.schema('community').from('collections').select('*').eq('id', collection.id)).data, [])
  assert.deepEqual((await bob.client.schema('community').from('collection_places').select('*').eq('collection_id', collection.id)).data, [])
  assert.ok((await guest.schema('community').from('collections').select('*')).error)
  assert.ok((await alice.client.schema('community').from('collections').insert({ name: 'Direct', user_id: alice.id })).error)
  assert.ok((await bob.client.schema('community').from('collection_places').insert({ collection_id: collection.id, place_id: placeId })).error)
  assert.ok((await bob.client.schema('community').from('collections').update({ is_shared: true }).eq('id', collection.id)).error)
  const share = await api(alice, 'POST', `${path}/share`)
  assert.equal(share.statusCode, 200)
  assert.equal(share.json().share_token, row.share_token)
  assert.equal((await api(alice, 'POST', `${path}/share`)).json().share_token, row.share_token)
  const publicRead = await api(null, 'GET', sharedPath)
  assert.equal(publicRead.statusCode, 200)
  assert.equal(publicRead.json().collection.places[0].id, placeId)
  assert.equal(publicRead.json().collection.user_id, undefined)
  assert.equal(publicRead.json().collection.share_token, undefined)
  assert.equal((await admin.schema('accounts').from('saved_places').insert({ user_id: alice.id, place_id: placeId })).error, null)
  assert.equal((await api(alice, 'DELETE', `${path}/places/${placeId}`)).statusCode, 200)
  assert.equal((await api(null, 'GET', sharedPath)).json().collection.places.length, 0)
  assert.equal((await api(alice, 'GET', `/collections?place_id=${placeId}`)).json().collections[0].contains_place, false)
  assert.equal((await admin.schema('accounts').from('saved_places').select('*').eq('user_id', alice.id)).data.length, 1)
  const extra = (await api(alice, 'POST', '/collections', { name: 'Dinner ideas' })).json().collection
  const bobsCollection = (await api(bob, 'POST', '/collections', { name: 'Bob favourites' })).json().collection
  await api(alice, 'PUT', `${path}/places/${placeId}`)
  await api(alice, 'PUT', `/collections/${extra.id}/places/${placeId}`)
  await api(bob, 'PUT', `/collections/${bobsCollection.id}/places/${placeId}`)
  await api(alice, 'PUT', `${path}/places/${places[1].id}`)
  const bookmarked = await api(alice, 'GET', '/collections/bookmarks')
  assert.equal(bookmarked.statusCode, 200)
  assert.deepEqual(new Set(bookmarked.json().place_ids), new Set([placeId, places[1].id]))
  assert.equal((await api(null, 'DELETE', `/collections/places/${placeId}`)).statusCode, 401)
  assert.equal((await api(alice, 'DELETE', `/collections/places/${placeId}?user_id=${bob.id}`)).statusCode, 200)
  assert.deepEqual((await api(alice, 'GET', '/collections/bookmarks')).json().place_ids, [places[1].id])
  assert.equal((await api(alice, 'GET', `/collections/${extra.id}`)).json().collection.places.length, 0)
  assert.equal((await api(bob, 'GET', `/collections/${bobsCollection.id}`)).json().collection.places.length, 1)
  assert.equal((await admin.schema('accounts').from('saved_places').select('*').eq('user_id', alice.id)).data.length, 1)
  assert.equal((await api(alice, 'DELETE', `/collections/places/${placeId}`)).statusCode, 200)
})
