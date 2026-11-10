import test from 'node:test'
import assert from 'node:assert/strict'
import { createSavedPlacesService } from './saved-places.js'

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`

// accounts.saved_places stand-in: select/eq/order chain, upsert, delete.
function fixtureDb(rows, writes) {
  const query = { eq: () => query, order: () => query, then: (resolve) => resolve({ data: rows, error: null }) }
  return {
    from: () => ({
      select: () => query,
      upsert: async (row) => { writes.push(row); return { error: null } },
    }),
  }
}

test('list keeps saved order, adds saved_at and skips places the catalogue no longer has', async () => {
  const rows = [{ place_id: uuid(2), created_at: '2026-11-02' }, { place_id: uuid(9), created_at: '2026-11-01' },
    { place_id: uuid(1), created_at: '2026-10-30' }]
  const places = { lookup: async (ids, view) => {
    assert.equal(view, 'full')
    return ids.filter((id) => id !== uuid(9)).map((id) => ({ id, name: id.at(-1) }))
  } }
  const list = await createSavedPlacesService(fixtureDb(rows, []), places).list('user-a')
  assert.deepEqual(list.map((place) => [place.name, place.saved, place.saved_at]),
    [['2', true, '2026-11-02'], ['1', true, '2026-10-30']])
})

test('save checks the place exists before writing', async () => {
  const writes = []
  const places = { lookup: async (ids) => ids.filter((id) => id === uuid(1)).map((id) => ({ id })) }
  const saved = createSavedPlacesService(fixtureDb([], writes), places)
  assert.equal(await saved.save('user-a', uuid(9)), false)
  assert.equal(writes.length, 0)
  assert.equal(await saved.save('user-a', uuid(1)), true)
  assert.deepEqual(writes, [{ user_id: 'user-a', place_id: uuid(1) }])
})
