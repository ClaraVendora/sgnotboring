export default async function healthRoutes(app) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'sgnotboring-api',
    timestamp: new Date().toISOString(),
  }))
}
