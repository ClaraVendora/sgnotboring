import test from 'node:test'
import assert from 'node:assert/strict'
import { placeArea, placeMeta, ratingCount } from './place-card.js'
import { filterOpenPlaces } from './place-filters.js'

test('card metadata uses an assigned area tag and abbreviates large review counts', () => {
  const place = { tags: ['Cafe', 'Bugis & Kampong Glam', 'Budget'], price_level: 2, rating: 4.5, user_ratings_total: 1234 }
  assert.equal(placeMeta(place), 'Bugis & Kampong Glam · $$ · ★ 4.5 (1.2k)')
  assert.equal(ratingCount(999), '999')
  assert.equal(ratingCount(1000), '1k')
  assert.equal(placeArea({ tags: ['Cafe'], address: 'Bugis' }), 'Area unknown')
  assert.equal(placeMeta({}), 'Area unknown · Price unknown · No rating')
})

test('Home Open now excludes closed/unknown schedules without mutating API results', () => {
  const open = { id: 'open', opening_hours: { periods: [{ open: { day: 0, hour: 0 } }] } }
  const unknown = { id: 'unknown', opening_hours: { open_now: true } }
  const closed = { id: 'closed', opening_hours: { periods: [{ open: { day: 3, hour: 18 }, close: { day: 3, hour: 22 } }] } }
  const rows = [unknown, closed, open]
  assert.deepEqual(filterOpenPlaces(rows, true, new Date('2026-10-28T12:00:00+08:00')).map((p) => p.id), ['open'])
  assert.equal(filterOpenPlaces(rows, false), rows)
  assert.equal(rows.length, 3)
})
