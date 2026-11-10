import Fastify from 'fastify'

// Every service: Fastify with logging, GET /health for Railway, then its own routes.
export async function buildService({ name, register, logger = true }) {
  const app = Fastify({ logger })
  app.get('/health', async () => ({ status: 'ok', service: name, timestamp: new Date().toISOString() }))
  await register(app)
  return app
}

// PORT/HOST from the environment. On Railway, inner services set HOST=:: so the private
// network (IPv6) can reach them.
export async function startService({ port, ...options }) {
  const app = await buildService(options)
  try {
    await app.listen({ port: Number(process.env.PORT ?? port), host: process.env.HOST ?? '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
  return app
}
