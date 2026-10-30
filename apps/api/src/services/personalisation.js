// Personalised AI Search (SGN-012): the taste survey and saved places become tags for /ask.
// Only tags ever reach the model, never the user's id, email or name.

// Asking for one tag in these facets rules out the others ("a bar" is not "a cafe"), so a
// taste in the same facet gives way to the message instead of competing with it.
const EXCLUSIVE_FACETS = new Set(['type', 'cuisine', 'budget', 'area', 'time'])
// Saved-place tags worth leaning on, most telling first. Area is where a place happens to be;
// dietary needs only count when the user states them in the survey.
const SAVED_FACETS = ['type', 'cuisine', 'budget', 'vibe', 'occasion', 'drinks', 'time', 'feature']
const SAVED_TAG_LIMIT = 4

// → { status: 'logged_out' | 'unavailable' | 'empty' } or { status: 'on', survey, savedTags }
export async function loadTaste(user, { preferences, savedPlaces }, log) {
  if (!user) return { status: 'logged_out' }
  try {
    const [row, savedTags] = await Promise.all([preferences.get(user.id), savedPlaces.tags(user.id)])
    const survey = row?.tags ?? []
    return survey.length || savedTags.length ? { status: 'on', survey, savedTags } : { status: 'empty' }
  } catch (error) {
    log.error(error, 'Could not load taste for personalised search')
    return { status: 'unavailable' }
  }
}

// The most common tags among saved places.
export function commonSavedTags(tagLists, facetOf, limit = SAVED_TAG_LIMIT) {
  const counts = new Map()
  for (const tags of tagLists) for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  const rank = (tag) => SAVED_FACETS.indexOf(facetOf.get(tag))
  return [...counts.keys()].filter((tag) => rank(tag) >= 0)
    .sort((a, b) => counts.get(b) - counts.get(a) || rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, limit)
}

// Message first: survey dietary needs join the hard requirements (unless the message opted
// out), other tastes only break ties, and a taste in a facet the message already chose is dropped.
// → { must, want, prefer, leanings: { dietary, survey, saved } }
export function applyTaste({ survey, saved }, { must, want, facetOf, skipDietary = false }) {
  const dietary = skipDietary ? [] : survey.filter((tag) => facetOf.get(tag) === 'dietary' && !must.includes(tag))
  const asked = new Set([...must, ...want])
  const chosenFacets = new Set([...asked].map((tag) => facetOf.get(tag)).filter((facet) => EXCLUSIVE_FACETS.has(facet)))
  const soft = (tags) => tags.filter((tag) => facetOf.has(tag) && facetOf.get(tag) !== 'dietary'
    && !asked.has(tag) && !chosenFacets.has(facetOf.get(tag)))
  const fromSurvey = soft(survey)
  // One budget at most: the survey's answer, else the saved places' most common one.
  const budgeted = (tags) => fromSurvey.concat(tags).some((tag) => facetOf.get(tag) === 'budget')
  const fromSaved = soft(saved).filter((tag) => !fromSurvey.includes(tag))
    .reduce((kept, tag) => (facetOf.get(tag) === 'budget' && budgeted(kept) ? kept : [...kept, tag]), [])
  return {
    must: [...must, ...dietary],
    want: want.filter((tag) => !dietary.includes(tag)),
    prefer: [...fromSurvey, ...fromSaved],
    leanings: { dietary, survey: fromSurvey, saved: fromSaved },
  }
}

export const hasLeanings = (leanings) =>
  Boolean(leanings && (leanings.dietary.length || leanings.survey.length || leanings.saved.length))

// How tags read in the leaning sentence; any other tag is used in lower case.
const PHRASES = {
  Hawker: 'hawker food', Cafe: 'cafes', Restaurant: 'restaurants', Bar: 'bars', Dessert: 'desserts', Bakery: 'bakeries',
  Budget: 'under S$15', 'Mid-Range': 'S$15–40', Splurge: 'splurging', 'Vegetarian Friendly': 'vegetarian options',
  'Solo Friendly': 'eating solo', 'Date Night': 'date spots', 'Group Friendly': 'groups', 'Family Friendly': 'family-friendly',
}
const phrase = (tag) => PHRASES[tag] ?? tag.toLowerCase()

// The reply's sentence on what personalised search leaned on. Built from the tags rather than
// left to the model, so it only ever names preferences the user actually gave, and only those
// the picks actually reflect ('' when none do: the message won outright).
export function leaningNote({ dietary, survey, saved }, picks) {
  const shown = new Set(picks.flatMap((place) => place.tags ?? []))
  const fromSurvey = [...dietary, ...survey].filter((tag) => shown.has(tag))
  const fromSaved = saved.filter((tag) => shown.has(tag))
  const sources = []
  if (fromSurvey.length) sources.push(`your survey (${fromSurvey.map(phrase).join(', ')})`)
  if (fromSaved.length) sources.push(`your saved places (${fromSaved.map(phrase).join(', ')})`)
  return sources.length ? `Leaning on ${sources.join(' and ')}.` : ''
}
