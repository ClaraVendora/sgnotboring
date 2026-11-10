import { createPlacesService, pagePlaces } from '../services/places.js'

// Public catalogue routes. Saved state is not added here: the web app keeps the user's saved
// list itself (GET /me/saved-places on the Accounts service).
export default async function placesRoutes(app, options = {}) {
  const places = options.places ?? createPlacesService()

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
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0, maximum: 100000 },
            sort: { type: 'string', enum: ['recommended', 'az', 'za'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      let rows
      try {
        rows = await places.search(req.query)
      } catch (error) {
        req.log.error(error, 'Could not search places')
        return reply.code(500).send({ error: 'Could not load places' })
      }
      // ?limit= opts into one page as { places, total }. Without it the full array is
      // returned, which Collections and Home's Open now filter rely on.
      return req.query.limit === undefined ? rows : pagePlaces(rows, req.query)
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
      let place
      try {
        place = await places.get(req.params.id)
      } catch (error) {
        req.log.error(error, 'Could not load place')
        return reply.code(500).send({ error: 'Could not load place' })
      }
      return place ?? reply.code(404).send({ error: 'Place not found' })
    },
  )

  // GET /tags → sorted distinct tags across all places (for the filter pills)
  app.get('/tags', async (req, reply) => {
    try {
      return await places.allTags()
    } catch (error) {
      req.log.error(error, 'Could not load tags')
      return reply.code(500).send({ error: 'Could not load tags' })
    }
  })
}
