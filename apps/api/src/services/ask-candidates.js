import { isOpenNow, nextOpening } from '@sgnotboring/shared/hours'
import { supabase } from './supabase.js'

const FIELDS = 'id,name,address,rating,user_ratings_total,price_level,tags,summary,opening_hours,photo_url'
const PAGE_SIZE = 500
const MAX_CANDIDATES = 20
const MAX_POOL = 50 // search_places() caps max_results at 50

async function taggedPlaces(must, db) {
  const places = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = db.from('places').select(FIELDS).not('enriched_at', 'is', null).order('id')
    if (must.length) query = query.contains('tags', must)
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    places.push(...data)
    if (data.length < PAGE_SIZE) return places
  }
}

// `prefer`: personalised tastes (SGN-012). They only reorder places the request itself rates
// equally (same match_score), so what the message asks for always wins.
export async function searchCandidates(must, want, { openNow = false, at = new Date(), prefer = [], db = supabase } = {}) {
  const preferred = new Set(prefer)
  const taste = (place) => (place.tags ?? []).filter((tag) => preferred.has(tag)).length
  if (openNow) {
    // Filter the complete matching set BEFORE taking the ranking pool. A closed top 20
    // must not hide a lower-rated place that really is open.
    const wanted = new Set(want)
    return (await taggedPlaces(must, db))
      .filter((place) => isOpenNow(place.opening_hours, at))
      .map((place) => ({ ...place, match_score: (place.tags ?? []).filter((tag) => wanted.has(tag)).length }))
      .sort((a, b) => b.match_score - a.match_score || taste(b) - taste(a) ||
        (b.rating ?? -1) - (a.rating ?? -1) || (b.user_ratings_total ?? -1) - (a.user_ratings_total ?? -1))
      .slice(0, MAX_CANDIDATES)
  }
  // Preserve the existing non-open-now ranking and relaxation behavior. With tastes, read a
  // wider pool so a preferred place just outside the top 20 can still be tried.
  const { data, error } = await db.rpc('search_places', {
    must_tags: must, want_tags: want, max_results: prefer.length ? MAX_POOL : MAX_CANDIDATES,
  })
  if (error) throw new Error(error.message)
  if (!data.length) return data
  // Stable sort: within equal scores the RPC's rating order is kept.
  const ranked = prefer.length
    ? [...data].sort((a, b) => b.match_score - a.match_score || taste(b) - taste(a)).slice(0, MAX_CANDIDATES)
    : data
  const photos = await db.from('places').select('id,photo_url').in('id', ranked.map((place) => place.id))
  if (photos.error) throw new Error(photos.error.message)
  const photoById = new Map(photos.data.map((place) => [place.id, place.photo_url]))
  return ranked.map((place) => ({ ...place, photo_url: photoById.get(place.id) ?? null }))
}

// Earliest known opening among places with every must tag, limited to those that best match
// the wanted tags: a cafe request should not suggest a bar just because it opens sooner.
export async function findNextOpening(must, want, at, db = supabase) {
  const wanted = new Set(want)
  const upcoming = (await taggedPlaces(must, db))
    .map((place) => ({
      name: place.name, opensAt: nextOpening(place.opening_hours, at),
      score: (place.tags ?? []).filter((tag) => wanted.has(tag)).length,
    }))
    .filter((place) => place.opensAt)
  const best = Math.max(0, ...upcoming.map((place) => place.score))
  const [next] = upcoming.filter((place) => place.score === best).sort((a, b) => a.opensAt - b.opensAt)
  return next ? { name: next.name, opensAt: next.opensAt } : null
}
