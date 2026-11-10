import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlacesService } from './places.js'

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// Minimal stand-in for the catalog client: from('places').select(fields).in('id', ids).
function fixtureDb(rows, queries) {
  return {
    from: (table) => ({
      select: (fields) => ({
        in: async (column, ids) => {
          queries.push({ table, fields, column, ids })
          return { data: rows.filter((row) => ids.includes(row.id)), error: null }
        },
      }),
    }),
  }
}

test('lookup follows the requested order, drops unknown ids and batches by 100', async () => {
  const rows = Array.from({ length: 150 }, (_, n) => ({ id: uuid(n), name: `Place ${n}` }))
  const queries = []
  const places = createPlacesService(fixtureDb(rows, queries))
  const ids = [uuid(120), uuid(3), uuid(999), uuid(3), ...rows.slice(0, 110).map((row) => row.id)]
  const found = await places.lookup(ids, 'name')
  assert.deepEqual(found.slice(0, 3).map((row) => row.name), ['Place 120', 'Place 3', 'Place 3'])
  assert.equal(found.length, ids.length - 1)
  assert.equal(queries.length, 2)
  assert.ok(queries.every((query) => query.table === 'places' && query.fields === 'id, name' && query.ids.length <= 100))
})

test('lookup of nothing makes no query', async () => {
  const queries = []
  assert.deepEqual(await createPlacesService(fixtureDb([], queries)).lookup([]), [])
  assert.equal(queries.length, 0)
})
