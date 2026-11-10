import { createPreferencesService } from '../services/preferences.js'
import { createSavedPlacesService } from '../services/saved-places.js'

// Service-to-service only (the gateway never forwards /internal/*). AI search calls this after
// verifying the user's token itself, so only tags and place ids leave this service.
export default async function internalRoutes(app, options = {}) {
  const preferences = options.preferences ?? createPreferencesService()
  const savedPlaces = options.savedPlaces ?? createSavedPlacesService()

  app.get('/internal/users/:id/taste', {
    schema: { params: { type: 'object', required: ['id'], additionalProperties: false,
      properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (req) => {
    const [row, savedPlaceIds] = await Promise.all([preferences.get(req.params.id), savedPlaces.ids(req.params.id)])
    return { survey: row?.tags ?? [], savedPlaceIds }
  })
}
