import { createRequireUser } from '../hooks/require-user.js'
import { createPreferencesService, surveyQuestions, surveyTags, validSelection } from '../services/preferences.js'
import { createSavedPlacesService } from '../services/saved-places.js'

export default async function meRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  const requireUser = createRequireUser(options.verifyUser)
  const preferences = options.preferences ?? createPreferencesService()
  const savedPlaces = options.savedPlaces ?? createSavedPlacesService()
  const placeParams = {
    type: 'object', properties: { id: { type: 'string', format: 'uuid' } },
    required: ['id'], additionalProperties: false,
  }
  function failure(request, reply, error, message) {
    request.log.error(error, message)
    return reply.code(500).send({ error: message })
  }

  app.get('/me/preferences/options', { preHandler: requireUser }, async () => ({ questions: surveyQuestions }))
  app.get('/me/preferences', { preHandler: requireUser }, async (request, reply) => {
    try {
      return { preferences: await preferences.get(request.user.id) }
    } catch (error) {
      return failure(request, reply, error, 'Could not load preferences')
    }
  })
  app.put('/me/preferences', {
    preHandler: requireUser,
    schema: { body: {
      type: 'object', required: ['tags'], additionalProperties: false,
      properties: { tags: {
        type: 'array', maxItems: surveyTags.length, uniqueItems: true,
        items: { type: 'string', enum: surveyTags },
      } },
    } },
  }, async (request, reply) => {
    if (!validSelection(request.body.tags)) return reply.code(400).send({ error: 'Choose at most one usual budget' })
    try {
      return { preferences: await preferences.put(request.user.id, request.body.tags) }
    } catch (error) {
      return failure(request, reply, error, 'Could not save preferences')
    }
  })

  app.get('/me/saved-places', { preHandler: requireUser }, async (request, reply) => {
    try {
      const places = await savedPlaces.list(request.user.id)
      return { places, count: places.length }
    } catch (error) {
      return failure(request, reply, error, 'Could not load saved places')
    }
  })
  app.put('/me/saved-places/:id', {
    preHandler: requireUser, schema: { params: placeParams },
  }, async (request, reply) => {
    try {
      await savedPlaces.save(request.user.id, request.params.id)
      return { saved: true }
    } catch (error) {
      if (error.code === '23503') return reply.code(404).send({ error: 'Place not found' })
      return failure(request, reply, error, 'Could not save place')
    }
  })
  app.delete('/me/saved-places/:id', {
    preHandler: requireUser, schema: { params: placeParams },
  }, async (request, reply) => {
    try {
      await savedPlaces.remove(request.user.id, request.params.id)
      return { saved: false }
    } catch (error) {
      return failure(request, reply, error, 'Could not remove saved place')
    }
  })

  app.get('/me', {
    preHandler: requireUser,
    schema: {
      querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                display_name: { type: 'string' },
              },
              required: ['id', 'email', 'display_name'],
              additionalProperties: false,
            },
          },
          required: ['user'],
          additionalProperties: false,
        },
      },
    },
  }, async (request) => {
    const user = request.user
    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: typeof user.user_metadata?.display_name === 'string'
          ? user.user_metadata.display_name.trim().slice(0, 60) : '',
      },
    }
  })
}
