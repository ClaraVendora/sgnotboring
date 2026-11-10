import { createRequireUser } from '@sgnotboring/service-kit/auth'
import { createReviewsService } from '../services/reviews.js'
import { reviewBodySchema } from '../schemas/review.js'

const uuidParams = {
  type: 'object', required: ['id'], additionalProperties: false,
  properties: { id: { type: 'string', format: 'uuid' } },
}

// Community reviews: public list per place, one review per person/place, and the author's own
// history. The gateway sends /places/:id/review(s) and /me/reviews* here.
export default async function reviewsRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  const requireUser = createRequireUser(options.verifyUser)
  const reviews = options.reviews ?? createReviewsService()
  function failure(request, reply, error, message) {
    request.log.error(error, message)
    return reply.code(500).send({ error: message })
  }

  app.get('/places/:id/reviews', { schema: { params: uuidParams } }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    try {
      const rows = await reviews.list(req.params.id)
      if (rows === null) return reply.code(404).send({ error: 'Place not found' })
      return { reviews: rows }
    } catch (error) {
      return failure(req, reply, error, 'Could not load reviews')
    }
  })

  // The verified session always supplies ownership; a caller cannot choose another author's
  // user_id or review ID to edit.
  app.put('/places/:id/review', {
    preHandler: requireUser,
    schema: { params: uuidParams, body: reviewBodySchema },
  }, async (req, reply) => {
    try {
      return { review: await reviews.save(req.params.id, req.user, req.body.body.trim(), req.body.rating) }
    } catch (error) {
      if (error.code === 'PLACE_NOT_FOUND') return reply.code(404).send({ error: 'Place not found' })
      return failure(req, reply, error, 'Could not save review')
    }
  })

  app.get('/me/reviews', { preHandler: requireUser }, async (request, reply) => {
    try {
      return { reviews: await reviews.listOwn(request.user.id) }
    } catch (error) {
      return failure(request, reply, error, 'Could not load your reviews')
    }
  })
  app.put('/me/reviews/:id', {
    preHandler: requireUser, schema: { params: uuidParams, body: reviewBodySchema },
  }, async (request, reply) => {
    try {
      const review = await reviews.edit(request.user.id, request.params.id, request.body.body.trim(), request.body.rating)
      if (!review) return reply.code(404).send({ error: 'Review not found' })
      return { review }
    } catch (error) {
      return failure(request, reply, error, 'Could not update review')
    }
  })
  app.delete('/me/reviews/:id', {
    preHandler: requireUser, schema: { params: uuidParams },
  }, async (request, reply) => {
    try {
      if (!await reviews.remove(request.user.id, request.params.id)) return reply.code(404).send({ error: 'Review not found' })
      return { deleted: true }
    } catch (error) {
      return failure(request, reply, error, 'Could not delete review')
    }
  })
}
