import { supabase } from '../services/supabase.js'
import { searchPlaces, searchPlacesPage } from '../services/places.js'
import { createOptionalUser, createRequireUser } from '../hooks/require-user.js'
import { createReviewsService } from '../services/reviews.js'
import { reviewBodySchema } from '../schemas/review.js'
import { createSavedPlacesService, withSavedFlags } from '../services/saved-places.js'

export default async function placesRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  const optionalUser = createOptionalUser(options.verifyUser)
  const savedPlaces = options.savedPlaces ?? createSavedPlacesService()
  const search = options.searchPlaces ?? searchPlaces
  const db = options.db ?? supabase
  const reviews = options.reviews ?? createReviewsService(db)
  const requireUser = createRequireUser(options.verifyUser)
  const reviewParams = {
    type: 'object', required: ['id'], additionalProperties: false,
    properties: { id: { type: 'string', format: 'uuid' } },
  }

  app.get('/places/:id/reviews', { schema: { params: reviewParams } }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    try {
      const rows = await reviews.list(req.params.id)
      if (rows === null) return reply.code(404).send({ error: 'Place not found' })
      return { reviews: rows }
    } catch (error) {
      req.log.error(error, 'Could not load reviews')
      return reply.code(500).send({ error: 'Could not load reviews' })
    }
  })

  // One review per person/place. The verified session always supplies ownership;
  // a caller cannot choose another author's user_id or review ID to edit.
  app.put('/places/:id/review', {
    preHandler: requireUser,
    schema: { params: reviewParams, body: reviewBodySchema },
  }, async (req, reply) => {
    try {
      return { review: await reviews.save(req.params.id, req.user, req.body.body.trim(), req.body.rating) }
    } catch (error) {
      if (error.code === '23503') return reply.code(404).send({ error: 'Place not found' })
      req.log.error(error, 'Could not save review')
      return reply.code(500).send({ error: 'Could not save review' })
    }
  })
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
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0, maximum: 100000 },
            open_now: { type: 'boolean' },
            sort: { type: 'string', enum: ['recommended', 'az', 'za'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      let places
      try {
        if (req.query.limit !== undefined) {
          const page = await (options.searchPlacesPage ?? searchPlacesPage)(req.query)
          return { ...page, places: await withSavedFlags(savedPlaces, page.places, req.user?.id, req.log) }
        }
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
