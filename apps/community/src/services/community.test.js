import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollectionsService } from './collections.js'
import { createReviewsService } from './reviews.js'

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`
const known = new Set([uuid(1), uuid(2)])
const places = { lookup: async (ids, view) => ids.filter((id) => known.has(id)).map((id) => ({ id, name: `Place ${id.at(-1)}`, view })) }

// Records which community table each call touches; resolves every query to `data`.
function fixtureDb(data, touched) {
  const chain = () => {
    const query = {
      select: () => query, eq: () => query, order: () => query, in: () => query, maybeSingle: () => query,
      range: () => query, single: () => query, update: () => query, delete: () => query,
      upsert: (...args) => { touched.push(['upsert', ...args]); return query },
      then: (resolve) => resolve({ data, error: null }),
    }
    return query
  }
  return { from: (table) => { touched.push(table); return chain() } }
}

test('reviews: unknown places read as missing and cannot be reviewed', async () => {
  const touched = []
  const reviews = createReviewsService(fixtureDb([], touched), places)
  assert.equal(await reviews.list(uuid(9)), null)
  await assert.rejects(reviews.save(uuid(9), { id: 'u', user_metadata: {} }, 'Nice', 4), { code: 'PLACE_NOT_FOUND' })
  assert.deepEqual(touched, [])
})

test('reviews: own history gets place names from Places', async () => {
  const rows = [{ id: 'r1', place_id: uuid(1) }, { id: 'r2', place_id: uuid(9) }]
  const own = await createReviewsService(fixtureDb(rows, []), places).listOwn('u')
  assert.deepEqual(own.map((row) => row.place?.name ?? null), ['Place 1', null])
})

test('collections: adding an unknown place throws PLACE_NOT_FOUND before writing', async () => {
  const touched = []
  const collections = createCollectionsService(fixtureDb({ id: 'c1', name: 'Mine' }, touched), places)
  await assert.rejects(collections.add('u', 'c1', uuid(9)), { code: 'PLACE_NOT_FOUND' })
  assert.ok(!touched.some((entry) => entry[0] === 'upsert'))
  assert.equal(await collections.add('u', 'c1', uuid(1)), true)
  assert.ok(touched.some((entry) => entry[0] === 'upsert'))
})

test('collections: places come back as cards in saved order without missing ones', async () => {
  const rows = [{ place_id: uuid(2) }, { place_id: uuid(9) }, { place_id: uuid(1) }]
  const db = fixtureDb(rows, [])
  // get() first reads the collection row, then its place ids; both resolve to `rows` here,
  // so make the owner lookup return a collection object instead.
  let first = true
  const from = db.from
  db.from = (table) => {
    const query = from(table)
    if (table === 'collections' && first) { first = false; query.then = (resolve) => resolve({ data: { id: 'c1', name: 'Mine' }, error: null }) }
    return query
  }
  const collection = await createCollectionsService(db, places).get('u', 'c1')
  assert.deepEqual(collection.places.map((place) => [place.id, place.view]), [[uuid(2), 'card'], [uuid(1), 'card']])
})
