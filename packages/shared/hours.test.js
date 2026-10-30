import test from 'node:test'
import assert from 'node:assert/strict'
import { isOpenNow, nextOpening, openStatus, singaporeMinuteOfWeek } from './hours.js'

const point = (day, hour, minute = 0) => ({ day, hour, minute })
const schedule = (...periods) => ({ periods })
const wed = (hour, minute = 0) => new Date(`2026-10-28T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)

test('Singapore clock and opening/closing boundaries are independent of machine timezone', () => {
  const hours = schedule({ open: point(3, 11), close: point(3, 14) })
  assert.equal(singaporeMinuteOfWeek(wed(11)), 3 * 1440 + 11 * 60)
  assert.equal(isOpenNow(hours, wed(10, 59)), false)
  assert.equal(isOpenNow(hours, wed(11)), true)
  assert.equal(isOpenNow(hours, wed(13, 59)), true)
  assert.equal(isOpenNow(hours, wed(14)), false)
})

test('overnight periods cross the Saturday/Sunday week boundary', () => {
  const hours = schedule({ open: point(6, 18), close: point(0, 2) })
  assert.equal(isOpenNow(hours, new Date('2026-11-01T01:59:00+08:00')), true)
  assert.equal(isOpenNow(hours, new Date('2026-11-01T02:00:00+08:00')), false)
})

test('split shifts exclude the gap and include the evening shift', () => {
  const hours = schedule({ open: point(3, 11), close: point(3, 14) }, { open: point(3, 18), close: point(3, 22) })
  assert.equal(isOpenNow(hours, wed(15)), false)
  assert.equal(isOpenNow(hours, wed(18)), true)
  assert.equal(nextOpening(hours, wed(15)).toISOString(), wed(18).toISOString())
})

test('24/7 sentinel, omitted zero fields, and full-day periods are handled', () => {
  assert.equal(isOpenNow(schedule({ open: { day: 0 } }), wed(3)), true)
  assert.equal(isOpenNow(schedule({ open: point(3, 0), close: point(4, 0) }), wed(23, 59)), true)
})

test('snapshots and invalid schedules never qualify as open now', () => {
  for (const hours of [null, { open_now: true }, { periods: [] }, schedule(null),
    schedule({ open: point(1, 9) }), schedule({ open: point(7, 9), close: point(1, 18) }),
    schedule({ open: point(3, 9), close: point(3, 9) })]) {
    assert.equal(openStatus(hours, wed(12)).label, 'Hours unknown')
    assert.equal(isOpenNow(hours, wed(12)), false)
    assert.equal(nextOpening(hours, wed(12)), null)
  }
})

test('next opening wraps forward into the next week', () => {
  const hours = schedule({ open: point(3, 11), close: point(3, 14) })
  assert.equal(nextOpening(hours, wed(15)).toISOString(), '2026-11-04T03:00:00.000Z')
  assert.equal(nextOpening(hours, wed(12)), null)
})
