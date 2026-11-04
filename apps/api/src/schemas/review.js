export const reviewBodySchema = {
  type: 'object', required: ['body', 'rating'], additionalProperties: false,
  properties: {
    body: { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
  },
}
