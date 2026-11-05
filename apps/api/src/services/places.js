import { isOpenNow } from '@sgnotboring/shared/hours'
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

// Preserve the original array response for existing collection callers.
export async function searchPlacesPage({ limit = 24, offset = 0, open_now = false, sort = 'recommended', ...filters }) {
  const rows = await searchPlaces(filters)
  const now = new Date()
  const filtered = open_now ? rows.filter((row) => isOpenNow(row.opening_hours, now)) : rows
  if (sort !== 'recommended') filtered.sort((a, b) => (sort === 'za' ? -1 : 1) * a.name.localeCompare(b.name, 'en-SG') || a.id.localeCompare(b.id))
  return { places: filtered.slice(offset, offset + limit), total: filtered.length }
}
