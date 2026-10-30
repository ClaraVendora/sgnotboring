import test from 'node:test'
import assert from 'node:assert/strict'
import { searchCandidates, findNextOpening } from './ask-candidates.js'

const at = new Date('2026-10-28T12:00:00+08:00')
const hours = (start, end) => ({ periods: [{ open: { day: 3, hour: start }, close: { day: 3, hour: end } }] })
export function fixtureDb(rows, rpcRows = rows) {
  return {
    rpc: async () => ({ data: rpcRows, error: null }),
    from: () => {
      let required = []
      const query = {
        select: () => query, not: () => query, order: () => query,
        contains: (_field, tags) => { required = tags; return query },
        range: async (start, end) => ({ data: rows.filter((row) => required.every((tag) => row.tags.includes(tag))).slice(start, end + 1), error: null }),
        in: async (_field, ids) => ({ data: rows.filter((row) => ids.includes(row.id)), error: null }),
      }
      return query
    },
  }
}

test('open-now filtering happens before candidate limit and excludes snapshot-only hours', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ id: `closed-${i}`, name: 'Closed', tags: ['Cafe'], rating: 5, opening_hours: hours(18, 22) }))
  rows.push({ id: 'unknown', tags: ['Cafe'], opening_hours: { open_now: true } })
  rows.push({ id: 'open', tags: ['Cafe'], rating: 3, photo_url: 'https://example.com/photo', opening_hours: hours(10, 14) })
  const result = await searchCandidates([], ['Cafe'], { openNow: true, at, db: fixtureDb(rows) })
  assert.deepEqual(result.map((place) => place.id), ['open'])
  assert.equal(result[0].photo_url, 'https://example.com/photo')
})

test('ordinary search preserves RPC order and includes photos without imposing opening hours', async () => {
  const closed = { id: 'closed', tags: ['Cafe'], photo_url: 'https://example.com/closed', opening_hours: hours(18, 22) }
  const result = await searchCandidates([], [], { db: fixtureDb([closed], [{ id: 'closed' }]) })
  assert.deepEqual(result, [{ id: 'closed', photo_url: closed.photo_url }])
})

test('next-opening suggestion uses the earliest known matching schedule', async () => {
  const db = fixtureDb([
    { name: 'Later', tags: ['Cafe'], opening_hours: hours(18, 22) },
    { name: 'Sooner', tags: ['Cafe'], opening_hours: hours(14, 17) },
    { name: 'Unknown', tags: ['Cafe'] },
  ])
  const next = await findNextOpening(['Cafe'], [], at, db)
  assert.equal(next.name, 'Sooner')
  assert.equal(next.opensAt.toISOString(), '2026-10-28T06:00:00.000Z')
})

test('next-opening suggestion prefers places matching the wanted tags over ones opening sooner', async () => {
  const db = fixtureDb([
    { name: 'Bar opens first', tags: ['Bar'], opening_hours: hours(13, 23) },
    { name: 'Cafe', tags: ['Cafe'], opening_hours: hours(16, 20) },
    { name: 'Cafe with wifi', tags: ['Cafe', 'Wifi'], opening_hours: hours(18, 22) },
  ])
  assert.equal((await findNextOpening([], ['Cafe'], at, db)).name, 'Cafe')
  assert.equal((await findNextOpening([], ['Cafe', 'Wifi'], at, db)).name, 'Cafe with wifi')
  assert.equal((await findNextOpening([], ['Dessert'], at, db)).name, 'Bar opens first')
})
