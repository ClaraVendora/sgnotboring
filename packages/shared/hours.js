import { scheduleFromDescriptions } from './hours-text.js'

// The browser and API use the same weekly Google opening periods in Singapore time.
const OPEN = { label: 'Open now', color: 'green' }
const CLOSED = { label: 'Closed', color: 'red' }
const UNKNOWN = { label: 'Hours unknown', color: 'gray' }
const WEEK = 7 * 24 * 60
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const validTime = (point) => point &&
  Number.isInteger(point.day) && point.day >= 0 && point.day <= 6 &&
  Number.isInteger(point.hour ?? 0) && (point.hour ?? 0) >= 0 && (point.hour ?? 0) <= 23 &&
  Number.isInteger(point.minute ?? 0) && (point.minute ?? 0) >= 0 && (point.minute ?? 0) <= 59
const toMinutes = ({ day, hour = 0, minute = 0 }) => day * 1440 + hour * 60 + minute
const validPeriod = (period) => validTime(period?.open) && (period.close
  ? validTime(period.close) && toMinutes(period.open) !== toMinutes(period.close)
  : toMinutes(period.open) === 0)
const validPeriods = (hours) => Array.isArray(hours?.periods) && hours.periods.length > 0 &&
  hours.periods.every(validPeriod)

export function normalizeOpeningHours(hours) {
  if (!hours || hours.periods !== undefined) return hours
  const schedule = scheduleFromDescriptions(hours.weekdayDescriptions)
  // Do not persist a partial set of periods: that would make holiday days look closed.
  return schedule?.periods.length && !schedule.uncertainDays.length ? { ...hours, periods: schedule.periods } : hours
}

function openingSchedule(hours) {
  if (validPeriods(hours)) return { periods: hours.periods, uncertainDays: [] }
  if (hours?.periods !== undefined) return null
  return scheduleFromDescriptions(hours?.weekdayDescriptions)
}
const sgClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Singapore', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
})

export function singaporeMinuteOfWeek(date = new Date()) {
  const parts = Object.fromEntries(sgClock.formatToParts(date).map((p) => [p.type, p.value]))
  return toMinutes({ day: WEEKDAYS.indexOf(parts.weekday), hour: Number(parts.hour), minute: Number(parts.minute) })
}

export function isOpenAt(periods, minuteOfWeek) {
  if (!Array.isArray(periods) || !periods.length || !periods.every(validPeriod)) return false
  return periods.some(({ open, close }) => {
    if (!close) return true // Google's Sunday 00:00, no-close sentinel means 24/7.
    const start = toMinutes(open)
    let end = toMinutes(close)
    if (end < start) end += WEEK
    return [minuteOfWeek, minuteOfWeek + WEEK].some((m) => m >= start && m < end)
  })
}

export function openStatus(hours, now = new Date()) {
  const schedule = openingSchedule(hours)
  if (!schedule) return UNKNOWN
  const minute = singaporeMinuteOfWeek(now)
  const day = Math.floor(minute / 1440)
  if (schedule.uncertainDays.includes(day)) return UNKNOWN
  if (isOpenAt(schedule.periods, minute)) return OPEN
  // Yesterday's uncertain hours might run past midnight. A clear current-day
  // opening is still usable; otherwise avoid inventing a closing boundary.
  if (schedule.uncertainDays.includes((day + 6) % 7)) return UNKNOWN
  return CLOSED
}

export function isOpenNow(hours, now = new Date()) {
  return openStatus(hours, now) === OPEN
}

// The next opening instant, for a no-match suggestion. Unknown hours never become a guess.
export function nextOpening(hours, now = new Date()) {
  const schedule = openingSchedule(hours)
  if (!schedule?.periods.length || schedule.uncertainDays.length || isOpenNow(hours, now)) return null
  const minute = singaporeMinuteOfWeek(now)
  const wait = Math.min(...schedule.periods.map(({ open }) => (toMinutes(open) - minute + WEEK) % WEEK))
  const startOfMinute = Math.floor(now.getTime() / 60000) * 60000
  return new Date(startOfMinute + wait * 60000)
}
