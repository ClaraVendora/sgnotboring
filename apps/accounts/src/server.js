import 'dotenv/config'
import { startService } from '@sgnotboring/service-kit/server'
import meRoutes from './routes/me.js'
import internalRoutes from './routes/internal.js'

// Accounts service: profile, taste survey and saved places (accounts schema).
await startService({
  name: 'accounts',
  port: 3013,
  register: async (app) => {
    await app.register(meRoutes)
    await app.register(internalRoutes)
  },
})
