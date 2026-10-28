// Explicit phrases are a safety net around the LLM's conversational interpretation.
// null means the current message did not override its interpretation of the history.
export function explicitOpenNow(message) {
  if (/\b(?:not|no longer)\s+(?:necessarily\s+)?open now\b|\b(?:don'?t|do not|doesn'?t)\s+(?:need|have)\s+to\s+be\s+open|\bno need to be open|\bdon'?t filter by open now|\b(?:any time|regardless of (?:the )?opening hours)\b/i.test(message)) return false
  return /\b(?:open\s+(?:right\s+)?now|right\s+now|still\s+open|at\s+this\s+hour|open\s+at\s+the\s+moment)\b/i.test(message) ? true : null
}

const nextTime = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore', weekday: 'short', hour: 'numeric', minute: '2-digit',
})
export function noOpenPlacesReply(next) {
  const suggestion = next
    ? `${next.name} next opens ${nextTime.format(next.opensAt)} (Singapore time). Try another area if you need somewhere now.`
    : 'Try another area or a different time.'
  return `No matching places are open right now. ${suggestion}`
}
