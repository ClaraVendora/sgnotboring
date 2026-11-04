const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function clock(text, inheritedMeridiem) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text.trim())
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const meridiem = match[3] ?? inheritedMeridiem
  if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return null
  if (meridiem) hour = hour % 12 + (meridiem === 'pm' ? 12 : 0)
  return hour * 60 + minute
}

// Require a full English week. An annotated day is uncertain, but should not
// invalidate clear days elsewhere in the week. Keep notes in the original text.
export function scheduleFromDescriptions(descriptions) {
  if (!Array.isArray(descriptions) || descriptions.length !== 7) return null
  const seen = new Set()
  const periods = []
  const uncertainDays = []
  for (const description of descriptions) {
    if (typeof description !== 'string') return null
    const match = /^(\w+):\s*(.+)$/.exec(description.normalize('NFKC').toLowerCase().trim())
    const day = match ? DAYS.indexOf(match[1]) : -1
    if (day < 0 || seen.has(day)) return null
    seen.add(day)
    const text = match[2].trim()
    if (/[()]/.test(text)) {
      uncertainDays.push(day)
      continue
    }
    if (text === 'closed') continue
    if (/^(?:open )?24 hours$/.test(text)) {
      periods.push({ open: { day, hour: 0, minute: 0 }, close: { day: (day + 1) % 7, hour: 0, minute: 0 } })
      continue
    }
    for (const shift of text.split(',')) {
      const range = shift.trim().split(/\s*[–—−-]\s*/)
      if (range.length !== 2) return null
      const endMeridiem = /(am|pm)$/.exec(range[1])?.[1]
      const start = clock(range[0], endMeridiem)
      const end = clock(range[1])
      if (start === null || end === null || start === end) return null
      if (!/(am|pm)$/.test(range[0]) && endMeridiem && end <= start) return null
      periods.push({
        open: { day, hour: Math.floor(start / 60), minute: start % 60 },
        close: { day: (day + (end <= start ? 1 : 0)) % 7, hour: Math.floor(end / 60), minute: end % 60 },
      })
    }
  }
  return { periods, uncertainDays }
}
