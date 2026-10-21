// Google Places opening_hours → { label, color }.
// Places API (New) rows carry `periods` ({ open: { day, hour, minute }, close }, day 0 = Sunday),
// Status always uses periods and Singapore time, never the ingest-time snapshot.
const OPEN = { label: 'Open now', color: 'green' }
const CLOSED = { label: 'Closed', color: 'red' }
const UNKNOWN = { label: 'Hours unknown', color: 'gray' }

const WEEK = 7 * 24 * 60
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const validTime = (point) => point &&
  Number.isInteger(point.day) && point.day >= 0 && point.day <= 6 &&
  Number.isInteger(point.hour) && point.hour >= 0 && point.hour <= 23 &&
  Number.isInteger(point.minute ?? 0) && (point.minute ?? 0) >= 0 && (point.minute ?? 0) <= 59
const validPeriod = (period) => validTime(period?.open) &&
  (period.close ? validTime(period.close) :
    period.open.day === 0 && period.open.hour === 0 && (period.open.minute ?? 0) === 0)
const toMinutes = ({ day, hour, minute = 0 }) => day * 24 * 60 + hour * 60 + minute

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
  return Array.isArray(periods) && periods.filter(validPeriod).some(({ open, close }) => {
    if (!close) return true // a single period with no close = open 24 hours
    const start = toMinutes(open)
    let end = toMinutes(close)
    if (end <= start) end += WEEK // e.g. Saturday 6pm → Sunday 2am
    return [minuteOfWeek, minuteOfWeek + WEEK].some((m) => m >= start && m < end)
  })
}

export function openStatus(openingHours, now = new Date()) {
  if (Array.isArray(openingHours?.periods) && openingHours.periods.length && openingHours.periods.every(validPeriod)) {
    return isOpenAt(openingHours.periods, singaporeMinuteOfWeek(now)) ? OPEN : CLOSED
  }
  return UNKNOWN
}
