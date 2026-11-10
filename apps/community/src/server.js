import 'dotenv/config'
import { startService } from '@sgnotboring/service-kit/server'
import collectionsRoutes from './routes/collections.js'
import reviewsRoutes from './routes/reviews.js'

// Community service: collections and reviews (community schema).
await startService({
  name: 'community',
  port: 3014,
  register: async (app) => {
    await app.register(collectionsRoutes)
    await app.register(reviewsRoutes)
  },
})
