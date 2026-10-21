import { createRequireUser } from '../hooks/require-user.js'

export default async function meRoutes(app, options = {}) {
  app.decorateRequest('user', null)
  app.get('/me', {
    preHandler: createRequireUser(options.verifyUser),
    schema: {
      querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                display_name: { type: 'string' },
              },
              required: ['id', 'email', 'display_name'],
              additionalProperties: false,
            },
          },
          required: ['user'],
          additionalProperties: false,
        },
      },
    },
  }, async (request) => {
    const user = request.user
    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: typeof user.user_metadata?.display_name === 'string'
          ? user.user_metadata.display_name.trim().slice(0, 60) : '',
      },
    }
  })
}
