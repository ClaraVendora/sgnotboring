import test from 'node:test'
import assert from 'node:assert/strict'
import { isOpenNow, nextOpening, normalizeOpeningHours, openStatus, singaporeMinuteOfWeek } from './hours.js'

const point = (day, hour, minute = 0) => ({ day, hour, minute })
const schedule = (...periods) => ({ periods })
const wed = (hour, minute = 0) => new Date(`2026-10-28T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)
const textWeek = (text) => ({ weekdayDescriptions: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => `${day}: ${text}`) })

test('holiday notes on other days do not hide clear Thursday hours from Discover', () => {
  const hours = textWeek('9 am–5 pm')
  hours.weekdayDescriptions[0] += ' (Diwali might affect these hours)'
  hours.weekdayDescriptions[4] += ' (Diwali might affect these hours)'
  assert.equal(openStatus(hours, new Date('2026-11-05T12:00:00+08:00')).label, 'Open now')
  assert.equal(openStatus(hours, new Date('2026-11-05T18:00:00+08:00')).label, 'Closed')
  assert.equal(openStatus(hours, new Date('2026-11-06T12:00:00+08:00')).label, 'Hours unknown')
  assert.equal(normalizeOpeningHours(hours), hours, 'uncertain weekdays must not be persisted as closed')
  assert.equal(nextOpening(hours, new Date('2026-11-05T18:00:00+08:00')), null, 'avoid promising a future opening across uncertain days')
})

test('annotated previous days cannot invent overnight closing times', () => {
  const hours = textWeek('9 am–5 pm')
  hours.weekdayDescriptions[4] += ' (Diwali hours)'
  assert.equal(openStatus(hours, new Date('2026-11-07T01:00:00+08:00')).label, 'Hours unknown')
  assert.equal(openStatus(hours, new Date('2026-11-07T12:00:00+08:00')).label, 'Open now')
})

test('existing SerpApi text works without reimport, with Unicode spaces and split shifts', () => {
  const hours = textWeek('12–3\u202fpm, 5–10:30\u202fpm')
  assert.equal(isOpenNow(hours, wed(12)), true)
  assert.equal(isOpenNow(hours, wed(15)), false)
  assert.equal(isOpenNow(hours, wed(17)), true)
  assert.equal(isOpenNow(hours, wed(22, 30)), false)
  assert.equal(nextOpening(hours, wed(16)).toISOString(), wed(17).toISOString())
  assert.equal(normalizeOpeningHours(hours).periods.length, 14)
})

test('text supports overnight week wrap, midnight, full days and all-closed weeks', () => {
  assert.equal(isOpenNow(textWeek('6 pm–2 am'), new Date('2026-11-01T01:59:00+08:00')), true)
  assert.equal(isOpenNow(textWeek('8 am–12 am'), wed(0)), false)
  assert.equal(isOpenNow(textWeek('8 am–12 am'), wed(23, 59)), true)
  assert.equal(isOpenNow(textWeek('Open 24 hours'), wed(3)), true)
  assert.equal(isOpenNow(textWeek('09:00-17:00'), wed(12)), true)
  assert.equal(openStatus(textWeek('Closed'), wed(12)).label, 'Closed')
  assert.equal(nextOpening(textWeek('Closed'), wed(12)), null)
})

test('incomplete, duplicate, malformed or holiday text stays unknown; native periods take priority', () => {
  const duplicate = textWeek('9 am–5 pm')
  duplicate.weekdayDescriptions[6] = duplicate.weekdayDescriptions[0]
  for (const hours of [duplicate, { weekdayDescriptions: ['Wednesday: 9 am–5 pm'] },
    textWeek('9 am–5 pm (holiday hours)'), textWeek('25:00–26:00'),
    textWeek('9:60 am–5 pm'), textWeek('9–2 pm'), textWeek('Open')]) {
    assert.equal(openStatus(hours, wed(12)).label, 'Hours unknown')
  }
  const native = { ...textWeek('Closed'), periods: [{ open: { day: 0 } }] }
  assert.equal(normalizeOpeningHours(native), native)
  assert.equal(isOpenNow(native, wed(12)), true)
})

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
