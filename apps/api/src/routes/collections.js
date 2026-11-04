import { createRequireUser } from '../hooks/require-user.js'
import { createCollectionsService } from '../services/collections.js'

const uuid = { type: 'string', format: 'uuid' }
const params = { type: 'object', required: ['id'], properties: { id: uuid }, additionalProperties: false }
const placeParams = { type: 'object', required: ['id', 'placeId'], properties: { id: uuid, placeId: uuid }, additionalProperties: false }

export default async function collectionsRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  const requireUser = createRequireUser(options.verifyUser)
  const collections = options.collections ?? createCollectionsService()
  const failure = (req, reply, error, message) => {
    req.log.error(error, message)
    return reply.code(500).send({ error: message })
  }
  const notFound = (reply) => reply.code(404).send({ error: 'Collection not found' })

  app.get('/collections/bookmarks', { preHandler: requireUser }, async (req, reply) => {
    try { return { place_ids: await collections.bookmarks(req.user.id) } }
    catch (error) { return failure(req, reply, error, 'Could not load collection bookmarks') }
  })
  app.delete('/collections/places/:placeId', {
    preHandler: requireUser,
    schema: { params: { type: 'object', required: ['placeId'], properties: { placeId: uuid }, additionalProperties: false } },
  }, async (req, reply) => {
    try {
      await collections.removeEverywhere(req.user.id, req.params.placeId)
      return { removed: true }
    } catch (error) { return failure(req, reply, error, 'Could not remove place from all collections') }
  })

  app.get('/collections', { preHandler: requireUser,
    schema: { querystring: { type: 'object', properties: { place_id: uuid }, additionalProperties: false } },
  }, async (req, reply) => {
    try { return { collections: await collections.list(req.user.id, req.query.place_id) } }
    catch (error) { return failure(req, reply, error, 'Could not load collections') }
  })
  app.post('/collections', {
    preHandler: requireUser,
    schema: { body: { type: 'object', required: ['name'], additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' } } } },
  }, async (req, reply) => {
    try { return reply.code(201).send({ collection: await collections.create(req.user.id, req.body.name.trim()) }) }
    catch (error) { return failure(req, reply, error, 'Could not create collection') }
  })
  app.get('/collections/:id', { preHandler: requireUser, schema: { params } }, async (req, reply) => {
    try {
      const collection = await collections.get(req.user.id, req.params.id)
      return collection ? { collection } : notFound(reply)
    } catch (error) { return failure(req, reply, error, 'Could not load collection') }
  })
  app.put('/collections/:id/places/:placeId', { preHandler: requireUser, schema: { params: placeParams } }, async (req, reply) => {
    try {
      return await collections.add(req.user.id, req.params.id, req.params.placeId) ? { added: true } : notFound(reply)
    } catch (error) {
      if (error.code === '23503') return reply.code(404).send({ error: 'Place not found' })
      return failure(req, reply, error, 'Could not add place to collection')
    }
  })
  app.delete('/collections/:id/places/:placeId', { preHandler: requireUser, schema: { params: placeParams } }, async (req, reply) => {
    try {
      return await collections.remove(req.user.id, req.params.id, req.params.placeId) ? { removed: true } : notFound(reply)
    } catch (error) { return failure(req, reply, error, 'Could not remove place from collection') }
  })
  app.post('/collections/:id/share', { preHandler: requireUser, schema: { params } }, async (req, reply) => {
    try {
      const share = await collections.share(req.user.id, req.params.id)
      return share ?? notFound(reply)
    } catch (error) { return failure(req, reply, error, 'Could not share collection') }
  })
  app.get('/collections/shared/:token', {
    schema: { params: { type: 'object', required: ['token'], properties: { token: uuid }, additionalProperties: false } },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    try {
      const collection = await collections.shared(req.params.token)
      return collection ? { collection } : notFound(reply)
    } catch (error) { return failure(req, reply, error, 'Could not load shared collection') }
  })
}
