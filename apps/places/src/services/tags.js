import { createDb } from '@sgnotboring/service-kit/db'

// The controlled tag vocabulary (catalog.tags), cached in memory. It only changes through a
// migration, so a few minutes of staleness is fine.
const TTL_MS = 5 * 60 * 1000
let cache = null

export async function getTagVocabulary() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tags

  const { data, error } = await createDb('catalog')
    .from('tags')
    .select('name, facet, description')
    .order('facet')
    .order('name')
  if (error) throw new Error(error.message)

  cache = { at: Date.now(), tags: data }
  return data
}
