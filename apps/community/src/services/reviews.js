import { createDb } from '@sgnotboring/service-kit/db'
import { createPlacesClient } from '../clients.js'

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

export const placeNotFound = () => Object.assign(new Error('Place not found'), { code: 'PLACE_NOT_FOUND' })

// community.place_reviews stores place ids only; the Places service confirms a place exists
// and supplies names for the author's review history.
export function createReviewsService(db = createDb('community'), places = createPlacesClient()) {
  const exists = async (placeId) => (await places.lookup([placeId], 'name')).length > 0
  async function withPlaceNames(rows) {
    const names = new Map((await places.lookup([...new Set(rows.map((row) => row.place_id))], 'name'))
      .map((place) => [place.id, place]))
    return rows.map((row) => ({ ...row, place: names.get(row.place_id) ?? null }))
  }
  return {
    async list(placeId) {
      if (!await exists(placeId)) return null
      // Read in batches to avoid silently hiding reviews at PostgREST's row cap.
      return allRows(() => db.from('place_reviews').select(FIELDS)
          .eq('place_id', placeId).order('created_at', { ascending: false }).order('id')
      )
    },
    async listOwn(userId) {
      return withPlaceNames(await allRows(() => db.from('place_reviews').select(FIELDS)
        .eq('user_id', userId).order('created_at', { ascending: false }).order('id')))
    },
    async save(placeId, user, body, rating) {
      if (!await exists(placeId)) throw placeNotFound()
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
        .eq('id', reviewId).eq('user_id', userId).select(FIELDS).maybeSingle()
      if (error) throw error
      return data && (await withPlaceNames([data]))[0]
    },
    async remove(userId, reviewId) {
      const { data, error } = await db.from('place_reviews').delete()
        .eq('id', reviewId).eq('user_id', userId).select('id')
      if (error) throw error
      return data.length > 0
    },
  }
}
