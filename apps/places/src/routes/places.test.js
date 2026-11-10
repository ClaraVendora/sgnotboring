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
    places: {
      search: async (query) => { calls.push(query); return rows },
      get: async (id) => rows.find((row) => row.id === id) ?? null,
      allTags: async () => ['Cafe', 'Late Night'],
    },
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

test('GET /places/:id returns one place or 404, and ignores any login token', async (t) => {
  const { app } = await setup(t)
  const res = await app.inject({ url: `/places/${uuid(2)}`, headers: { authorization: 'Bearer anything' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().name, 'Atlas')
  assert.equal(res.json().saved, undefined)
  assert.equal((await app.inject(`/places/${uuid(9)}`)).statusCode, 404)
  assert.equal((await app.inject('/places/not-a-uuid')).statusCode, 400)
})

test('GET /tags lists the distinct tags', async (t) => {
  const { app } = await setup(t)
  assert.deepEqual((await app.inject('/tags')).json(), ['Cafe', 'Late Night'])
})
