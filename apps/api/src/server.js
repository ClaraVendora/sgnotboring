import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import healthRoutes from './routes/health.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000'

const app = Fastify({ logger: true })

await app.register(cors, { origin: WEB_ORIGIN })
await app.register(healthRoutes)

try {
  await app.listen({ port: PORT, host: HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
