import Fastify from 'fastify'
import cors from '@fastify/cors'
import replyFrom from '@fastify/reply-from'
import { serviceFor, upstreamsFromEnv } from './routes.js'

// The one public entry point. CORS is checked here only; requests (including the user's
// Authorization header) are streamed to the owning service unchanged, and each service
// verifies the user itself.
export async function buildGateway({
  upstreams = upstreamsFromEnv(),
  origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
  logger = true,
} = {}) {
  const app = Fastify({ logger })
  await app.register(cors, { origin: origins, methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'] })
  await app.register(replyFrom)
  // Pass bodies through as raw streams instead of parsing and re-serialising them.
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', (_req, payload, done) => done(null, payload))

  app.get('/health', async () => ({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() }))

  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    url: '/*',
    handler(req, reply) {
      const service = serviceFor(req.url.split('?')[0])
      if (!service) return reply.code(404).send({ error: 'Not found' })
      return reply.from(`${upstreams[service].replace(/\/+$/, '')}${req.url}`, {
        onError(reply, { error }) {
          req.log.error({ err: error, service }, 'Upstream service failed')
          reply.code(502).send({ error: 'Service unavailable' })
        },
      })
    },
  })
  return app
}
