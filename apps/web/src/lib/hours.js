// Google Places opening_hours → { label, color }.
// Places API (New) rows carry `periods` ({ open: { day, hour, minute }, close }, day 0 = Sunday),
// so status is computed for right now in Singapore time. Older rows only have `open_now`,
// a snapshot from ingest time.
const OPEN = { label: 'Open now', color: 'green' }
const CLOSED = { label: 'Closed', color: 'red' }
const UNKNOWN = { label: 'Hours unknown', color: 'gray' }

const WEEK = 7 * 24 * 60
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const toMinutes = ({ day, hour, minute }) => day * 24 * 60 + hour * 60 + minute

const sgClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Singapore',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

// Minutes since Sunday 00:00, Singapore time.
export function singaporeMinuteOfWeek(date = new Date()) {
  const parts = Object.fromEntries(sgClock.formatToParts(date).map((p) => [p.type, p.value]))
  return toMinutes({ day: WEEKDAYS.indexOf(parts.weekday), hour: Number(parts.hour), minute: Number(parts.minute) })
}

export function isOpenAt(periods, minuteOfWeek) {
  return periods.some(({ open, close }) => {
    if (!close) return true // a single period with no close = open 24 hours
    const start = toMinutes(open)
    let end = toMinutes(close)
    if (end <= start) end += WEEK // e.g. Saturday 6pm → Sunday 2am
    return [minuteOfWeek, minuteOfWeek + WEEK].some((m) => m >= start && m < end)
  })
}

export function openStatus(openingHours, now = new Date()) {
  if (Array.isArray(openingHours?.periods) && openingHours.periods.length) {
    return isOpenAt(openingHours.periods, singaporeMinuteOfWeek(now)) ? OPEN : CLOSED
  }
  if (typeof openingHours?.open_now === 'boolean') return openingHours.open_now ? OPEN : CLOSED
  return UNKNOWN
}
