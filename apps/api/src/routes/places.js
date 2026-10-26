import { supabase } from '../services/supabase.js'
import { searchPlaces } from '../services/places.js'
import { createOptionalUser } from '../hooks/require-user.js'
import { createSavedPlacesService } from '../services/saved-places.js'

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
      try {
        return await savedPlaces.annotate(await search(req.query), req.user?.id)
      } catch (error) {
        req.log.error(error, 'Could not search places')
        return reply.code(500).send({ error: 'Could not load places' })
      }
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
      try {
        const { data, error } = await db.from('places').select('*').eq('id', req.params.id).maybeSingle()
        if (error) throw error
        if (!data) return reply.code(404).send({ error: 'Place not found' })
        return (await savedPlaces.annotate([data], req.user?.id))[0]
      } catch (error) {
        req.log.error(error, 'Could not load place')
        return reply.code(500).send({ error: 'Could not load place' })
      }
    },
  )

  // GET /tags → sorted distinct tags across all places (for the filter pills)
  app.get('/tags', async (_req, reply) => {
    const { data, error } = await supabase.from('places').select('tags')
    if (error) return reply.code(500).send({ error: error.message })
    return [...new Set(data.flatMap((row) => row.tags))].sort()
  })
}
