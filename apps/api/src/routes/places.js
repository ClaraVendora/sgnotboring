import { supabase } from '../services/supabase.js'
import { searchPlaces } from '../services/places.js'
import { createOptionalUser } from '../hooks/require-user.js'
import { createSavedPlacesService, withSavedFlags } from '../services/saved-places.js'

export default async function placesRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  const optionalUser = createOptionalUser(options.verifyUser)
  const savedPlaces = options.savedPlaces ?? createSavedPlacesService()
  const search = options.searchPlaces ?? searchPlaces
  const db = options.db ?? supabase
  // GET /places?tags=Late%20Night,Spicy  → places matching ANY of the tags
  app.get(
    '/places',
    {
      preHandler: optionalUser,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            tags: { type: 'string', maxLength: 500 },
            q: { type: 'string', maxLength: 100 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      let places
      try {
        places = await search(req.query)
      } catch (error) {
        req.log.error(error, 'Could not search places')
        return reply.code(500).send({ error: 'Could not load places' })
      }
      return withSavedFlags(savedPlaces, places, req.user?.id, req.log)
    },
  )

  // GET /places/:id
  app.get(
    '/places/:id',
    {
      preHandler: optionalUser,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (req, reply) => {
      let place
      try {
        const { data, error } = await db.from('places').select('*').eq('id', req.params.id).maybeSingle()
        if (error) throw error
        place = data
      } catch (error) {
        req.log.error(error, 'Could not load place')
        return reply.code(500).send({ error: 'Could not load place' })
      }
      if (!place) return reply.code(404).send({ error: 'Place not found' })
      return (await withSavedFlags(savedPlaces, [place], req.user?.id, req.log))[0]
    },
  )

  // GET /tags → sorted distinct tags across all places (for the filter pills)
  app.get('/tags', async (_req, reply) => {
    const { data, error } = await supabase.from('places').select('tags')
    if (error) return reply.code(500).send({ error: error.message })
    return [...new Set(data.flatMap((row) => row.tags))].sort()
  })
}
