import { supabase } from './supabase.js'

const FIELDS = 'id,place_id,user_id,author_name,body,rating,created_at,updated_at'

async function allRows(query) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query().range(start, start + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

export function createReviewsService(db = supabase) {
  return {
    async list(placeId) {
      const { data: place, error: placeError } = await db.from('places').select('id').eq('id', placeId).maybeSingle()
      if (placeError) throw placeError
      if (!place) return null
      // Read in batches to avoid silently hiding reviews at PostgREST's row cap.
      return allRows(() => db.from('place_reviews').select(FIELDS)
          .eq('place_id', placeId).order('created_at', { ascending: false }).order('id')
      )
    },
    async listOwn(userId) {
      return allRows(() => db.from('place_reviews').select(`${FIELDS},place:places(id,name)`)
        .eq('user_id', userId).order('created_at', { ascending: false }).order('id'))
    },
    async save(placeId, user, body, rating) {
      const authorName = typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name.trim().slice(0, 60) : ''
      const { data, error } = await db.from('place_reviews').upsert({
        place_id: placeId, user_id: user.id, author_name: authorName || 'Community member', body, rating,
      }, { onConflict: 'place_id,user_id' }).select(FIELDS).single()
      if (error) throw error
      return data
    },
    async edit(userId, reviewId, body, rating) {
      const { data, error } = await db.from('place_reviews').update({ body, rating })
        .eq('id', reviewId).eq('user_id', userId).select(`${FIELDS},place:places(id,name)`).maybeSingle()
      if (error) throw error
      return data
    },
    async remove(userId, reviewId) {
      const { data, error } = await db.from('place_reviews').delete()
        .eq('id', reviewId).eq('user_id', userId).select('id')
      if (error) throw error
      return data.length > 0
    },
  }
}
