import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Fastify from 'fastify'
import meRoutes from '../routes/me.js'
import placesRoutes from '../routes/places.js'
import { surveyTags } from './preferences.js'

test('local preferences and saves: real JWTs, persistence, ownership and direct RLS', {
  skip: process.env.RUN_LOCAL_PERSONALISATION_TEST !== '1', timeout: 60000,
}, async (t) => {
  const url = process.env.SUPABASE_URL
  assert.ok(['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url), 'local database only')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
  const guest = createClient(url, process.env.SUPABASE_ANON_KEY, options)
  const users = []
  t.after(async () => {
    for (const { id } of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null)
  })
  for (let i = 0; i < 2; i++) {
    const email = `taste-${randomUUID()}@example.com`
    const password = `Test-${randomUUID()}`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    assert.equal(created.error, null)
    users.push({ id: created.data.user.id })
    const client = createClient(url, process.env.SUPABASE_ANON_KEY, options)
    const login = await client.auth.signInWithPassword({ email, password })
    assert.equal(login.error, null)
    Object.assign(users[i], { client, token: login.data.session.access_token })
  }
  const [a, b] = users
  const { data: catalogue, error: catalogueError } = await admin.from('places').select('id').limit(2)
  assert.equal(catalogueError, null)
  assert.equal(catalogue.length, 2, 'seed has places')
  const [place, otherPlace] = catalogue
  const { data: vocabulary } = await guest.from('tags').select('name').in('name', surveyTags)
  assert.equal(vocabulary.length, surveyTags.length, 'every survey option exists in vocabulary')
  const app = Fastify()
  await app.register(meRoutes)
  await app.register(placesRoutes)
  t.after(() => app.close())
  const api = (user, method, url, payload) => app.inject({
    method, url, payload, headers: user ? { authorization: `Bearer ${user.token}` } : {},
  })

  assert.deepEqual((await api(a, 'GET', '/me/preferences')).json(), { preferences: null })
  await api(a, 'GET', '/me/preferences/options')
  assert.equal((await admin.from('preferences').select('*').eq('user_id', a.id)).data.length, 0, 'skip/read does not create a row')
  let response = await api(a, 'PUT', '/me/preferences', { tags: ['Cafe', 'Budget', 'No pork', 'Family Friendly'], user_id: b.id })
  assert.equal(response.statusCode, 200)
  const initial = response.json().preferences
  assert.deepEqual(initial.tags, ['Cafe', 'Budget', 'No pork', 'Family Friendly'])
  assert.deepEqual((await api(b, 'GET', '/me/preferences')).json(), { preferences: null })
  response = await api(a, 'PUT', '/me/preferences', { tags: ['Hawker'] })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().preferences.created_at, initial.created_at)
  assert.deepEqual((await api(a, 'GET', '/me/preferences')).json().preferences.tags, ['Hawker'])
  assert.equal((await admin.from('preferences').select('*').eq('user_id', a.id)).data.length, 1)
  assert.equal((await api(a, 'PUT', '/me/preferences', { tags: ['invalid'] })).statusCode, 400)

  // Query and mutation ownership must hold even when the browser bypasses the API.
  assert.deepEqual((await b.client.from('preferences').select('*').eq('user_id', a.id)).data, [])
  assert.ok((await b.client.from('preferences').insert({ user_id: a.id, tags: ['Cafe'] })).error)
  assert.deepEqual((await b.client.from('preferences').update({ tags: ['Cafe'] }).eq('user_id', a.id).select()).data, [])
  assert.ok((await a.client.from('preferences').update({ user_id: b.id }).eq('user_id', a.id)).error)
  assert.deepEqual((await b.client.from('preferences').delete().eq('user_id', a.id).select()).data, [])
  assert.deepEqual((await a.client.from('preferences').select('tags').single()).data.tags, ['Hawker'])
  for (const tags of [['unknown'], ['Cafe', 'Cafe'], [null]]) {
    assert.ok((await a.client.from('preferences').update({ tags }).eq('user_id', a.id)).error, 'DB validates direct tags')
  }
  assert.ok((await guest.from('preferences').select('*')).error, 'guest has no table grant')
  assert.ok((await guest.from('preferences').insert({ user_id: a.id, tags: [] })).error)
  assert.equal((await b.client.from('preferences').insert({ user_id: b.id, tags: ['Bar'] })).error, null)

  for (let i = 0; i < 2; i++) {
    const save = await api(a, 'PUT', `/me/saved-places/${place.id}?user_id=${b.id}`)
    assert.equal(save.statusCode, 200)
  }
  assert.equal((await api(a, 'GET', '/me/saved-places')).json().count, 1)
  assert.equal((await api(b, 'GET', '/me/saved-places')).json().count, 0)
  for (const user of [a, b, null]) {
    assert.equal((await api(user, 'GET', `/places/${place.id}`)).json().saved, user === a)
    const browse = await api(user, 'GET', '/places')
    assert.equal(browse.statusCode, 200)
    assert.equal(browse.json().find(({ id }) => id === place.id).saved, user === a)
  }
  assert.deepEqual((await b.client.from('saved_places').select('*').eq('user_id', a.id)).data, [])
  assert.ok((await b.client.from('saved_places').insert({ user_id: a.id, place_id: otherPlace.id })).error)
  assert.deepEqual((await b.client.from('saved_places').delete().eq('user_id', a.id).select()).data, [])
  assert.ok((await a.client.from('saved_places').update({ user_id: b.id }).eq('user_id', a.id)).error)
  assert.ok((await guest.from('saved_places').select('*')).error)
  assert.ok((await guest.from('saved_places').insert({ user_id: a.id, place_id: otherPlace.id })).error)
  assert.equal((await b.client.from('saved_places').insert({ user_id: b.id, place_id: place.id })).error, null)
  assert.ok((await b.client.from('saved_places').insert({ user_id: b.id, place_id: place.id })).error, 'composite key blocks duplicates')
  assert.equal((await api(a, 'PUT', `/me/saved-places/${randomUUID()}`)).statusCode, 404)
  for (let i = 0; i < 2; i++) assert.equal((await api(a, 'DELETE', `/me/saved-places/${place.id}`)).statusCode, 200)
  assert.equal((await api(a, 'GET', '/me/saved-places')).json().count, 0)
  assert.equal((await api(b, 'GET', '/me/saved-places')).json().count, 1, 'other user unaffected by removal')
  assert.equal((await api(b, 'PUT', '/me/preferences', { tags: [] })).statusCode, 200)
  assert.deepEqual((await api(b, 'GET', '/me/preferences')).json().preferences.tags, [])

  await admin.auth.admin.deleteUser(b.id)
  assert.deepEqual((await admin.from('saved_places').select('*').eq('user_id', b.id)).data, [])
  assert.deepEqual((await admin.from('preferences').select('*').eq('user_id', b.id)).data, [])
  users.pop()
})
