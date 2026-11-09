import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import placesRoutes from './places.js'

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`
// Already in browse_places() order (rating first), so not alphabetical.
const rows = [
  { id: uuid(1), name: 'Nylon Coffee' },
  { id: uuid(2), name: 'Atlas' },
  { id: uuid(3), name: 'Zam Zam' },
  { id: uuid(4), name: 'Burnt Ends' },
]

async function setup(t) {
  const calls = []
  const app = Fastify()
  await app.register(placesRoutes, {
    searchPlaces: async (query) => { calls.push(query); return rows },
    savedPlaces: { annotate: async (places) => places.map((place) => ({ ...place, saved: false })) },
    verifyUser: async () => null,
  })
  t.after(() => app.close())
  return { app, calls }
}
const names = (places) => places.map((place) => place.name)

test('GET /places without limit keeps the full array response', async (t) => {
  const { app, calls } = await setup(t)
  const res = await app.inject('/places?tags=Cafe&q=bugis')
  assert.equal(res.statusCode, 200)
  assert.deepEqual(names(res.json()), names(rows))
  assert.equal(calls[0].tags, 'Cafe')
  assert.equal(calls[0].q, 'bugis')
})

test('GET /places with limit returns one page and the full total', async (t) => {
  const { app } = await setup(t)
  const first = (await app.inject('/places?limit=2')).json()
  assert.deepEqual(names(first.places), ['Nylon Coffee', 'Atlas'])
  assert.equal(first.total, 4)
  assert.equal(first.places[0].saved, false)

  const last = (await app.inject('/places?limit=2&offset=3')).json()
  assert.deepEqual(names(last.places), ['Burnt Ends'])
  assert.equal(last.total, 4)
})

test('GET /places sorts by name before paging', async (t) => {
  const { app } = await setup(t)
  assert.deepEqual(names((await app.inject('/places?limit=4&sort=az')).json().places),
    ['Atlas', 'Burnt Ends', 'Nylon Coffee', 'Zam Zam'])
  assert.deepEqual(names((await app.inject('/places?limit=2&sort=za')).json().places), ['Zam Zam', 'Nylon Coffee'])
  // The service's array is never reordered in place.
  assert.deepEqual(names(rows), ['Nylon Coffee', 'Atlas', 'Zam Zam', 'Burnt Ends'])
})

test('GET /places rejects invalid paging input', async (t) => {
  const { app } = await setup(t)
  for (const query of ['limit=0', 'limit=101', 'offset=-1', 'sort=rating']) {
    assert.equal((await app.inject(`/places?limit=5&${query}`)).statusCode, 400, query)
  }
})
