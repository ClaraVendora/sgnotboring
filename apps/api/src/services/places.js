import { supabase } from './supabase.js'

const CARD_FIELDS =
  'id, name, address, rating, user_ratings_total, price_level, tags, summary, opening_hours, photo_url'

export async function searchPlaces({ q = '', tags = '' }) {
  const selected = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
  // browse_places() already orders by rating (unrated last), then name and id.
  const { data, error } = await supabase
    .rpc('browse_places', { search_text: q.trim(), selected_tags: selected })
    .select(CARD_FIELDS)
  if (error) throw new Error(error.message)
  return data
}

// One page of already-matched rows; 'recommended' keeps browse_places() order.
// Paging happens in memory, which is fine at the current catalogue size. Move it
// into browse_places() if the catalogue grows to thousands of places.
export function pagePlaces(rows, { limit = 24, offset = 0, sort = 'recommended' } = {}) {
  const sorted = sort === 'recommended' ? rows : [...rows].sort((a, b) =>
    (sort === 'za' ? -1 : 1) * a.name.localeCompare(b.name, 'en-SG') || a.id.localeCompare(b.id))
  return { places: sorted.slice(offset, offset + limit), total: rows.length }
}
