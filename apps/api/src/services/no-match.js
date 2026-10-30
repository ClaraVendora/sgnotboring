// SGN-011: when no place meets every hard requirement, say what to relax in plain words.
// Never mention tags or filters, and never suggest dropping a dietary need.

// Neighbouring vocabulary areas, closest first.
const NEARBY = {
  'Bugis & Kampong Glam': ['City Hall', 'Little India', 'Jalan Besar'],
  'Bukit Timah': ['Holland Village', 'Dempsey', 'Novena'],
  CBD: ['Tanjong Pagar', 'Marina Bay', 'Chinatown'],
  Changi: ['East Coast', 'Katong & Joo Chiat'],
  Chinatown: ['Tanjong Pagar', 'Riverside', 'CBD'],
  'City Hall': ['Bugis & Kampong Glam', 'Riverside', 'Marina Bay'],
  Dempsey: ['Holland Village', 'Orchard', 'Bukit Timah'],
  'East Coast': ['Katong & Joo Chiat', 'Changi'],
  'Holland Village': ['Dempsey', 'Bukit Timah'],
  'Jalan Besar': ['Little India', 'Bugis & Kampong Glam'],
  'Katong & Joo Chiat': ['East Coast', 'Changi'],
  'Little India': ['Jalan Besar', 'Bugis & Kampong Glam', 'Novena'],
  'Marina Bay': ['CBD', 'City Hall'],
  Novena: ['Upper Thomson', 'Orchard', 'Bukit Timah'],
  Orchard: ['Dempsey', 'Novena', 'Riverside'],
  Riverside: ['Chinatown', 'City Hall', 'Orchard'],
  Sentosa: ['Tiong Bahru', 'Tanjong Pagar'],
  'Tanjong Pagar': ['Chinatown', 'CBD', 'Tiong Bahru'],
  'Tiong Bahru': ['Chinatown', 'Tanjong Pagar', 'Riverside'],
  'Upper Thomson': ['Novena'],
}
const FACET_ORDER = ['budget', 'time', 'area']

// unmet: the hard requirements given up to find anything. places: the close matches shown
// anyway, so a suggested area is one they are actually in: a neighbour if any is, otherwise
// wherever the first of them is. With no places, the closest neighbour.
export function noMatchGuidance(unmet, facetOf, places = [], { openNow = false } = {}) {
  const found = new Set(places.flatMap((place) => place.tags ?? []))
  const shownArea = places.flatMap((place) => place.tags ?? []).find((tag) => facetOf.get(tag) === 'area')
  const tips = unmet
    .filter((tag) => FACET_ORDER.includes(facetOf.get(tag)))
    .sort((a, b) => FACET_ORDER.indexOf(facetOf.get(a)) - FACET_ORDER.indexOf(facetOf.get(b)))
    .map((tag) => {
      const facet = facetOf.get(tag)
      if (facet === 'budget') return tag === 'Splurge' ? 'somewhere more casual' : 'raising the budget'
      if (facet === 'time') return tag === 'Late Night' ? 'an earlier time' : 'another time of day'
      const nearby = NEARBY[tag] ?? []
      const neighbour = nearby.find((name) => found.has(name))
      if (neighbour) return `a nearby area such as ${neighbour}`
      if (shownArea && shownArea !== tag) return `another area such as ${shownArea}`
      return nearby.length ? `a nearby area such as ${nearby[0]}` : 'another area'
    })
  // Open now is never loosened, but coming back later is a real option.
  if (openNow && !unmet.some((tag) => facetOf.get(tag) === 'time')) tips.push('a later time')
  const advice = tips.length ? `Try ${[...new Set(tips)].slice(0, 2).join(' or ')}.` : 'Try asking for something a little broader.'
  return `Nothing fits all of that. ${advice}`
}

// After loosening (dropped non-empty), how the reply opens: if no pick meets every hard
// requirement, what to relax; if only some do, how many, with those listed first.
export function relaxedSummary(picks, must, dropped, facetOf, { openNow = false } = {}) {
  if (!dropped.length) return { picks, note: '' }
  const fits = (place) => must.every((tag) => (place.tags ?? []).includes(tag))
  const fit = picks.filter(fits)
  if (!fit.length) return { picks, note: noMatchGuidance(dropped, facetOf, picks, { openNow }) }
  if (fit.length === picks.length) return { picks, note: '' }
  return {
    picks: [...fit, ...picks.filter((place) => !fits(place))],
    note: `Only ${fit.length} of these ${fit.length === 1 ? 'fits' : 'fit'} everything you asked for.`,
  }
}
