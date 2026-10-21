import { supabase } from '../services/supabase.js'
import { searchPlaces } from '../services/places.js'

export default async function placesRoutes(app) {
  // GET /places?tags=Late%20Night,Spicy  → places matching ANY of the tags
  app.get(
    '/places',
    {
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
        return await searchPlaces(req.query)
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
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (req, reply) => {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle()

      if (error) return reply.code(500).send({ error: error.message })
      if (!data) return reply.code(404).send({ error: 'Place not found' })
      return data
    },
  )

  // GET /tags → sorted distinct tags across all places (for the filter pills)
  app.get('/tags', async (_req, reply) => {
    const { data, error } = await supabase.from('places').select('tags')
    if (error) return reply.code(500).send({ error: error.message })
    return [...new Set(data.flatMap((row) => row.tags))].sort()
  })
}
