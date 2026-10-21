import { supabase } from './supabase.js'

const CARD_FIELDS =
  'id, name, address, rating, user_ratings_total, price_level, tags, summary, opening_hours'

export async function searchPlaces({ q = '', tags = '' }) {
  const selected = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
  const { data, error } = await supabase
    .rpc('search_places', { search_text: q.trim(), selected_tags: selected })
    .select(CARD_FIELDS)
    .order('rating', { ascending: false, nullsFirst: false })
    .order('name')
    .order('id')
  if (error) throw new Error(error.message)
  return data
}
