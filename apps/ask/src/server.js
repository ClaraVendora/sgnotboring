import 'dotenv/config'
import { startService } from '@sgnotboring/service-kit/server'
import askRoutes from './routes/ask.js'

// AI search service: POST /ask. Stateless; calls Places, Accounts and Gemini.
await startService({
  name: 'ask',
  port: 3012,
  register: (app) => app.register(askRoutes),
})
