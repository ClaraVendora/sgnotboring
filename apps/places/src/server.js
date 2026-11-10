import 'dotenv/config'
import { startService } from '@sgnotboring/service-kit/server'
import placesRoutes from './routes/places.js'
import internalRoutes from './routes/internal.js'

// Places service: the catalogue (catalog schema). Public browse routes plus internal lookups.
await startService({
  name: 'places',
  port: 3011,
  register: async (app) => {
    await app.register(placesRoutes)
    await app.register(internalRoutes)
  },
})
