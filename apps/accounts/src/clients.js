import { createServiceClient } from '@sgnotboring/service-kit/client'

export function createPlacesClient(baseUrl = process.env.PLACES_URL || 'http://localhost:3011', options) {
  const http = createServiceClient('places', baseUrl, options)
  return {
    // Places by id in the given order; unknown ids are left out.
    async lookup(ids, view = 'card') {
      if (!ids.length) return []
      const { places } = await http.post('/internal/places/lookup', { ids, view })
      return places
    },
  }
}
