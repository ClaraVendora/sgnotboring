import { createDb } from '@sgnotboring/service-kit/db'
import { createPlacesClient } from '../clients.js'
import { placeNotFound } from './reviews.js'

const FIELDS = 'id,name,is_shared,created_at,updated_at'

async function allRows(query) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query().range(start, start + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

// community.collection_places stores place ids only; cards come from the Places service, which
// is also the existence check now that there is no foreign key across schemas.
export function createCollectionsService(db = createDb('community'), places = createPlacesClient()) {
  async function ownIds(userId) {
    const rows = await allRows(() => db.from('collections').select('id').eq('user_id', userId).order('id'))
    return rows.map((row) => row.id)
  }
  async function owned(userId, id) {
    const { data, error } = await db.from('collections').select(FIELDS).eq('id', id).eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  }
  async function withPlaces(collection) {
    if (!collection) return null
    const rows = await allRows(() => db.from('collection_places').select('place_id')
      .eq('collection_id', collection.id).order('created_at', { ascending: false }).order('place_id'))
    return { ...collection, places: await places.lookup(rows.map((row) => row.place_id), 'card') }
  }
  return {
    async bookmarks(userId) {
      const ids = await ownIds(userId)
      const places = new Set()
      for (let start = 0; start < ids.length; start += 100) {
        const rows = await allRows(() => db.from('collection_places').select('place_id')
          .in('collection_id', ids.slice(start, start + 100)).order('collection_id').order('place_id'))
        for (const row of rows) places.add(row.place_id)
      }
      return [...places]
    },
    async removeEverywhere(userId, placeId) {
      const ids = await ownIds(userId)
      for (let start = 0; start < ids.length; start += 100) {
        const { error } = await db.from('collection_places').delete().eq('place_id', placeId)
          .in('collection_id', ids.slice(start, start + 100))
        if (error) throw error
      }
    },
    async list(userId, placeId) {
      const rows = await allRows(() => db.from('collections').select(`${FIELDS},collection_places(count)`)
        .eq('user_id', userId).order('created_at', { ascending: false }).order('id'))
      const memberships = new Set()
      if (placeId) {
        // Restrict the membership lookup to the verified owner's collections.
        // Small batches also keep long collection lists within URL limits.
        for (let start = 0; start < rows.length; start += 100) {
          const { data, error } = await db.from('collection_places').select('collection_id')
            .eq('place_id', placeId).in('collection_id', rows.slice(start, start + 100).map((row) => row.id))
          if (error) throw error
          for (const membership of data) memberships.add(membership.collection_id)
        }
      }
      return rows.map(({ collection_places, ...row }) => ({ ...row, place_count: collection_places[0]?.count ?? 0,
        ...(placeId ? { contains_place: memberships.has(row.id) } : {}),
      }))
    },
    async create(userId, name) {
      const { data, error } = await db.from('collections').insert({ user_id: userId, name }).select(FIELDS).single()
      if (error) throw error
      return { ...data, place_count: 0 }
    },
    async get(userId, id) { return withPlaces(await owned(userId, id)) },
    async add(userId, id, placeId) {
      if (!await owned(userId, id)) return false
      if (!(await places.lookup([placeId], 'name')).length) throw placeNotFound()
      const { error } = await db.from('collection_places').upsert({ collection_id: id, place_id: placeId },
        { onConflict: 'collection_id,place_id', ignoreDuplicates: true })
      if (error) throw error
      return true
    },
    async remove(userId, id, placeId) {
      if (!await owned(userId, id)) return false
      const { error } = await db.from('collection_places').delete().eq('collection_id', id).eq('place_id', placeId)
      if (error) throw error
      return true
    },
    async share(userId, id) {
      const { data, error } = await db.from('collections').update({ is_shared: true })
        .eq('id', id).eq('user_id', userId).select('share_token').maybeSingle()
      if (error) throw error
      return data
    },
    async shared(token) {
      const { data, error } = await db.from('collections').select('id,name,created_at')
        .eq('share_token', token).eq('is_shared', true).maybeSingle()
      if (error) throw error
      return withPlaces(data)
    },
  }
}
