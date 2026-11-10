import { createDb } from '@sgnotboring/service-kit/db'
import { createPlacesClient } from '../clients.js'

// accounts.saved_places stores ids only. Place details come from the Places service, which is
// also the existence check now that there is no foreign key across schemas.
export function createSavedPlacesService(db = createDb('accounts'), places = createPlacesClient()) {
  async function rows(userId) {
    const { data, error } = await db.from('saved_places').select('place_id, created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).order('place_id')
    if (error) throw error
    return data
  }
  return {
    // Newest first; places the catalogue no longer has are skipped.
    async list(userId) {
      const saved = await rows(userId)
      const cards = new Map((await places.lookup(saved.map((row) => row.place_id), 'full')).map((place) => [place.id, place]))
      return saved.filter((row) => cards.has(row.place_id)).map((row) => ({
        ...cards.get(row.place_id), saved: true, saved_at: row.created_at,
      }))
    },
    // → false when the place does not exist.
    async save(userId, placeId) {
      if (!(await places.lookup([placeId], 'name')).length) return false
      // Do nothing on conflict, preserving the original save timestamp.
      const { error } = await db.from('saved_places').upsert({ user_id: userId, place_id: placeId },
        { onConflict: 'user_id,place_id', ignoreDuplicates: true })
      if (error) throw error
      return true
    },
    async remove(userId, placeId) {
      const { error } = await db.from('saved_places').delete().eq('user_id', userId).eq('place_id', placeId)
      if (error) throw error
    },
    // Ids only, for AI search's personalisation (it resolves tags through Places).
    async ids(userId) {
      return (await rows(userId)).map((row) => row.place_id)
    },
  }
}
