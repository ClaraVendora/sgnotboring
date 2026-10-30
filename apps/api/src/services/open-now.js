// Explicit phrases are a safety net around the LLM's conversational interpretation.
// null means the current message did not override its interpretation of the history.
// Negations are checked first: "I don't care if it's open right now" must not turn the
// constraint on just because it contains "right now". Apostrophes may be typed as ’.
const NOT_OPEN_NOW = new RegExp([
  String.raw`\b(?:not|no longer)\s+(?:necessarily\s+)?open\s+(?:right\s+)?now\b`,
  String.raw`\bnot\s+(?:right\s+)?now\b`,
  String.raw`\b(?:don['’]?t|do not|doesn['’]?t|does not)\s+(?:need|have)\s+to\s+be\s+open`,
  String.raw`\b(?:don['’]?t|do not|doesn['’]?t|does not)\s+(?:care|matter)\s+(?:if|whether)\s+(?:it|they|the place|places?)(?:['’]?s|['’]re|\s+is|\s+are)?\s+(?:still\s+)?open\b`,
  String.raw`\bno need to be open`,
  String.raw`\bdon['’]?t filter by open now`,
  String.raw`\b(?:any time|regardless of (?:the )?opening hours)\b`,
].join('|'), 'i')

export function explicitOpenNow(message) {
  if (NOT_OPEN_NOW.test(message)) return false
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
