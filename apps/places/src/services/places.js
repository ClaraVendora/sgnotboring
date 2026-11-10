import { createDb } from '@sgnotboring/service-kit/db'

const CARD_FIELDS =
  'id, name, address, rating, user_ratings_total, price_level, tags, summary, opening_hours, photo_url'
// What other services may ask for in a batch lookup.
const VIEWS = { card: CARD_FIELDS, full: '*', tags: 'id, tags', name: 'id, name' }
const LOOKUP_BATCH = 100 // keeps the id list well inside URL limits

export function createPlacesService(db = createDb('catalog')) {
  return {
    async search({ q = '', tags = '' }) {
      const selected = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      // browse_places() already orders by rating (unrated last), then name and id.
      const { data, error } = await db
        .rpc('browse_places', { search_text: q.trim(), selected_tags: selected })
        .select(CARD_FIELDS)
      if (error) throw new Error(error.message)
      return data
    },
    async get(id) {
      const { data, error } = await db.from('places').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    // Sorted distinct tags across all places (for the filter pills).
    async allTags() {
      const { data, error } = await db.from('places').select('tags')
      if (error) throw error
      return [...new Set(data.flatMap((row) => row.tags))].sort()
    },
    // Batch read for other services (saved places, collections, reviews, AI search). Results
    // follow the order of `ids`; unknown ids are left out, which is also the existence check.
    async lookup(ids, view = 'card') {
      const unique = [...new Set(ids)]
      const byId = new Map()
      for (let start = 0; start < unique.length; start += LOOKUP_BATCH) {
        const { data, error } = await db.from('places').select(VIEWS[view])
          .in('id', unique.slice(start, start + LOOKUP_BATCH))
        if (error) throw error
        for (const place of data) byId.set(place.id, place)
      }
      return ids.filter((id) => byId.has(id)).map((id) => byId.get(id))
    },
  }
}

// One page of already-matched rows; 'recommended' keeps browse_places() order.
// Paging happens in memory, which is fine at the current catalogue size. Move it
// into browse_places() if the catalogue grows to thousands of places.
export function pagePlaces(rows, { limit = 24, offset = 0, sort = 'recommended' } = {}) {
  const sorted = sort === 'recommended' ? rows : [...rows].sort((a, b) =>
    (sort === 'za' ? -1 : 1) * a.name.localeCompare(b.name, 'en-SG') || a.id.localeCompare(b.id))
  return { places: sorted.slice(offset, offset + limit), total: rows.length }
}
