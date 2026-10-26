import { supabase } from './supabase.js'

export function createSavedPlacesService(db = supabase) {
  return {
    async list(userId) {
      const { data, error } = await db.from('saved_places')
        .select('created_at, place:places(*)').eq('user_id', userId)
        .order('created_at', { ascending: false }).order('place_id')
      if (error) throw error
      return data.filter(({ place }) => place).map(({ place, created_at }) => ({
        ...place, saved: true, saved_at: created_at,
      }))
    },
    async save(userId, placeId) {
      // Do nothing on conflict, preserving the original save timestamp.
      const { error } = await db.from('saved_places').upsert({ user_id: userId, place_id: placeId },
        { onConflict: 'user_id,place_id', ignoreDuplicates: true })
      if (error) throw error
    },
    async remove(userId, placeId) {
      const { error } = await db.from('saved_places').delete().eq('user_id', userId).eq('place_id', placeId)
      if (error) throw error
    },
    async annotate(places, userId) {
      if (!userId || !places.length) return places.map((place) => ({ ...place, saved: false }))
      const { data, error } = await db.from('saved_places').select('place_id')
        .eq('user_id', userId).in('place_id', places.map(({ id }) => id))
      if (error) throw error
      const saved = new Set(data.map(({ place_id }) => place_id))
      return places.map((place) => ({ ...place, saved: saved.has(place.id) }))
    },
  }
}
