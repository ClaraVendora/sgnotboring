import { verifyAccessToken } from '../services/auth.js'

// Reuse as preHandler on every future preferences/saved-places endpoint.
export function createRequireUser(verify = verifyAccessToken) {
  return async function requireUser(request, reply) {
    reply.header('Cache-Control', 'no-store')
    const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization || '')
    if (!match) return reply.code(401).send({ error: 'Authentication required' })
    try {
      const user = await verify(match[1])
      if (!user || user.role !== 'authenticated' || !user.email_confirmed_at) {
        return reply.code(401).send({ error: 'Invalid or expired session' })
      }
      request.user = user
    } catch {
      return reply.code(503).send({ error: 'Authentication temporarily unavailable' })
    }
  }
}
