import { verifyAccessToken } from '../services/auth.js'

// → { user } or { status, error }. 503 means Auth itself could not be reached.
async function authenticate(request, verify) {
  const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization || '')
  if (!match) return { status: 401, error: 'Authentication required' }
  try {
    const user = await verify(match[1])
    if (!user || user.role !== 'authenticated' || !user.email_confirmed_at) {
      return { status: 401, error: 'Invalid or expired session' }
    }
    return { user }
  } catch {
    return { status: 503, error: 'Authentication temporarily unavailable' }
  }
}

// Reuse as preHandler on every future preferences/saved-places endpoint.
export function createRequireUser(verify = verifyAccessToken) {
  return async function requireUser(request, reply) {
    reply.header('Cache-Control', 'no-store')
    const { user, status, error } = await authenticate(request, verify)
    if (!user) return reply.code(status).send({ error })
    request.user = user
  }
}

// Public browse endpoints accept guests, but a supplied credential must be valid.
// If Auth cannot be reached the request continues as a guest: browsing never depends on Auth.
export function createOptionalUser(verify = verifyAccessToken) {
  return async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('Vary', 'Authorization, Origin')
    request.user = null
    if (request.headers.authorization === undefined) return
    const { user, status, error } = await authenticate(request, verify)
    if (user) request.user = user
    else if (status === 503) request.log.warn('Auth unavailable; serving public request as a guest')
    else return reply.code(status).send({ error })
  }
}
