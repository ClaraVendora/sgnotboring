import { createServiceClient } from '@sgnotboring/service-kit/client'

const VOCABULARY_TTL_MS = 5 * 60 * 1000 // tags only change through a migration

export function createPlacesClient(baseUrl = process.env.PLACES_URL || 'http://localhost:3011', options) {
  const http = createServiceClient('places', baseUrl, options)
  let vocabularyCache = null
  return {
    async vocabulary() {
      if (vocabularyCache && Date.now() - vocabularyCache.at < VOCABULARY_TTL_MS) return vocabularyCache.tags
      const { tags } = await http.get('/internal/vocabulary')
      vocabularyCache = { at: Date.now(), tags }
      return tags
    },
    async search(must, want, { openNow = false, at = new Date(), prefer = [] } = {}) {
      const { places } = await http.post('/internal/search', { must, want, openNow, at: at.toISOString(), prefer })
      return places
    },
    async nextOpening(must, want, at) {
      const { next } = await http.post('/internal/next-opening', { must, want, at: at.toISOString() })
      return next && { name: next.name, opensAt: new Date(next.opensAt) }
    },
    async lookup(ids, view = 'card') {
      if (!ids.length) return []
      const { places } = await http.post('/internal/places/lookup', { ids, view })
      return places
    },
  }
}

export function createAccountsClient(baseUrl = process.env.ACCOUNTS_URL || 'http://localhost:3013', options) {
  const http = createServiceClient('accounts', baseUrl, options)
  // → { survey: [tags], savedPlaceIds: [uuid] }
  return { taste: (userId) => http.get(`/internal/users/${encodeURIComponent(userId)}/taste`) }
}

// loadTaste() reads preferences.get() and savedPlaces.tags() in parallel. Both are answered by
// one Accounts call per user (shared while in flight); saved place ids become tag lists via Places.
export function createTasteSources({ accounts, places }) {
  const inFlight = new Map()
  const taste = (userId) => {
    if (!inFlight.has(userId)) {
      const request = accounts.taste(userId)
      inFlight.set(userId, request)
      request.then(() => inFlight.delete(userId), () => inFlight.delete(userId))
    }
    return inFlight.get(userId)
  }
  return {
    preferences: {
      async get(userId) {
        const { survey } = await taste(userId)
        return survey.length ? { tags: survey } : null
      },
    },
    savedPlaces: {
      async tags(userId) {
        const { savedPlaceIds } = await taste(userId)
        return (await places.lookup(savedPlaceIds, 'tags')).map((place) => place.tags ?? [])
      },
    },
  }
}
