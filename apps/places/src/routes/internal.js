import { createPlacesService } from '../services/places.js'
import { getTagVocabulary } from '../services/tags.js'
import { findNextOpening, searchCandidates } from '../services/ask-candidates.js'

// Service-to-service endpoints. The gateway never forwards /internal/*, and on Railway this
// service has no public domain, so only other services on the private network can call them.
const tagList = { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 100 } }
const uuid = { type: 'string', format: 'uuid' }

export default async function internalRoutes(app, options = {}) {
  const places = options.places ?? createPlacesService()
  const vocabulary = options.vocabulary ?? getTagVocabulary
  const candidates = options.searchCandidates ?? searchCandidates
  const nextOpening = options.findNextOpening ?? findNextOpening

  // The controlled tag vocabulary: [{ name, facet, description }].
  app.get('/internal/vocabulary', async () => ({ tags: await vocabulary() }))

  // AI search candidates: every `must` tag, ranked by `want` matches, optionally open at `at`.
  app.post('/internal/search', {
    schema: { body: {
      type: 'object', required: ['must', 'want'], additionalProperties: false,
      properties: { must: tagList, want: tagList, prefer: tagList, openNow: { type: 'boolean' },
        at: { type: 'string', format: 'date-time' } },
    } },
  }, async (req) => ({
    places: await candidates(req.body.must, req.body.want, {
      openNow: req.body.openNow ?? false,
      at: req.body.at ? new Date(req.body.at) : new Date(),
      prefer: req.body.prefer ?? [],
    }),
  }))

  // Earliest next opening among matching places → { next: { name, opensAt } | null }.
  app.post('/internal/next-opening', {
    schema: { body: {
      type: 'object', required: ['must', 'want', 'at'], additionalProperties: false,
      properties: { must: tagList, want: tagList, at: { type: 'string', format: 'date-time' } },
    } },
  }, async (req) => ({ next: await nextOpening(req.body.must, req.body.want, new Date(req.body.at)) }))

  // Batch read by id for Accounts, Community and AI search. Unknown ids are left out.
  app.post('/internal/places/lookup', {
    schema: { body: {
      type: 'object', required: ['ids'], additionalProperties: false,
      properties: {
        ids: { type: 'array', maxItems: 1000, items: uuid },
        view: { type: 'string', enum: ['card', 'full', 'tags', 'name'] },
      },
    } },
  }, async (req) => ({ places: await places.lookup(req.body.ids, req.body.view ?? 'card') }))
}
