import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountsClient, createPlacesClient, createTasteSources } from './clients.js'

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`

function fakeFetch(routes, calls) {
  return async (url, init) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body) })
    const path = new URL(url).pathname
    const body = routes[path]
    if (body === undefined) return new Response(JSON.stringify({ error: 'nope' }), { status: 404 })
    return new Response(JSON.stringify(typeof body === 'function' ? body() : body), { status: 200 })
  }
}

test('places client posts ISO times and turns next-opening back into a Date', async () => {
  const calls = []
  const places = createPlacesClient('http://places.test/', { fetchImpl: fakeFetch({
    '/internal/search': { places: [{ id: uuid(1) }] },
    '/internal/next-opening': { next: { name: 'Atlas', opensAt: '2026-11-10T10:00:00.000Z' } },
  }, calls) })
  const at = new Date('2026-11-10T02:00:00Z')
  assert.deepEqual(await places.search(['Budget'], ['Cafe'], { openNow: true, at }), [{ id: uuid(1) }])
  assert.deepEqual(calls[0].body, { must: ['Budget'], want: ['Cafe'], openNow: true, at: at.toISOString(), prefer: [] })
  assert.equal(calls[0].url, 'http://places.test/internal/search')
  const next = await places.nextOpening([], ['Cafe'], at)
  assert.ok(next.opensAt instanceof Date)
  assert.equal(next.opensAt.toISOString(), '2026-11-10T10:00:00.000Z')
})

test('vocabulary is cached between calls', async () => {
  const calls = []
  const places = createPlacesClient('http://places.test', { fetchImpl: fakeFetch({ '/internal/vocabulary': { tags: [{ name: 'Cafe' }] } }, calls) })
  await places.vocabulary()
  assert.deepEqual(await places.vocabulary(), [{ name: 'Cafe' }])
  assert.equal(calls.length, 1)
})

test('taste sources share one Accounts call and resolve saved places to tags', async () => {
  const calls = []
  const fetchImpl = fakeFetch({
    [`/internal/users/${uuid(1)}/taste`]: { survey: ['Cafe'], savedPlaceIds: [uuid(2), uuid(3)] },
    '/internal/places/lookup': { places: [{ id: uuid(2), tags: ['Chill'] }, { id: uuid(3), tags: null }] },
  }, calls)
  const taste = createTasteSources({
    accounts: createAccountsClient('http://accounts.test', { fetchImpl }),
    places: createPlacesClient('http://places.test', { fetchImpl }),
  })
  const [survey, saved] = await Promise.all([taste.preferences.get(uuid(1)), taste.savedPlaces.tags(uuid(1))])
  assert.deepEqual(survey, { tags: ['Cafe'] })
  assert.deepEqual(saved, [['Chill'], []])
  assert.equal(calls.filter((call) => call.url.includes('/taste')).length, 1)
  assert.deepEqual(calls.find((call) => call.url.endsWith('/lookup')).body, { ids: [uuid(2), uuid(3)], view: 'tags' })
})

test('no survey answers read as null, no saved places skip the lookup', async () => {
  const calls = []
  const fetchImpl = fakeFetch({ [`/internal/users/${uuid(1)}/taste`]: { survey: [], savedPlaceIds: [] } }, calls)
  const taste = createTasteSources({
    accounts: createAccountsClient('http://accounts.test', { fetchImpl }),
    places: createPlacesClient('http://places.test', { fetchImpl }),
  })
  assert.equal(await taste.preferences.get(uuid(1)), null)
  assert.deepEqual(await taste.savedPlaces.tags(uuid(1)), [])
  assert.ok(!calls.some((call) => call.url.endsWith('/lookup')))
})
