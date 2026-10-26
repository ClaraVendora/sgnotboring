import { supabase } from '../services/supabase.js'
import { generateJson, RateLimitError } from '../services/llm.js'
import { getTagVocabulary } from '../services/tags.js'
import { createOptionalUser } from '../hooks/require-user.js'
import { createSavedPlacesService } from '../services/saved-places.js'
import {
  interpretInput,
  interpretSchema,
  interpretSystemPrompt,
  RANK_SYSTEM_PROMPT,
  rankInput,
  rankSchema,
} from '../prompts/ask.js'

const MAX_CANDIDATES = 20
// Only these facets can be hard filters. Anything else the model marks as a must
// (type, vibe, occasion…) becomes a want, so one soft preference can't empty the results.
const MUST_FACETS = new Set(['area', 'dietary', 'budget', 'time'])

async function searchPlaces(mustTags, wantTags) {
  const { data, error } = await supabase.rpc('search_places', {
    must_tags: mustTags,
    want_tags: wantTags,
    max_results: MAX_CANDIDATES,
  })
  if (error) throw new Error(error.message)
  return data
}

// Strict first. If that finds fewer than `count`, make the area optional, then everything.
// `exact` = how many places met every must tag; `dropped` = the must tags given up to fill in.
// Exact matches still rank first after loosening, because dropped musts become want tags.
async function findCandidates(must, want, count, facetOf) {
  const strict = await searchPlaces(must, want)
  const exact = strict.length
  if (exact >= count || !must.length) return { candidates: strict, exact, dropped: [] }

  const areas = must.filter((t) => facetOf.get(t) === 'area')
  if (areas.length && areas.length < must.length) {
    const candidates = await searchPlaces(must.filter((t) => !areas.includes(t)), [...want, ...areas])
    if (candidates.length >= count) return { candidates, exact, dropped: areas }
  }
  return { candidates: await searchPlaces([], [...must, ...want]), exact, dropped: must }
}

// LLM ranking with a fallback to search order, so a failed or slow rank call still returns
// places (just without reasons). Short deadline: the user is waiting.
async function rankCandidates({ intent, count, exact, dropped, candidates }, log) {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const started = Date.now()
  try {
    const out = await generateJson({
      system: RANK_SYSTEM_PROMPT,
      input: rankInput({ intent, count, exact, dropped, candidates }),
      schema: rankSchema([...byId.keys()], count),
      timeoutMs: 10_000,
    })
    log.info({ step: 'rank', ms: Date.now() - started }, 'gemini')
    const seen = new Set()
    const picks = out.picks
      .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
      .slice(0, count)
      .map((p) => ({ ...byId.get(p.id), reason: p.reason }))
    if (picks.length) return { reply: out.reply, picks }
  } catch (err) {
    log.warn({ err }, 'rank step failed, falling back to search order')
  }
  const picks = candidates.slice(0, count).map((c) => ({ ...c, reason: null }))
  return { reply: `Here's what fits best for: ${intent}`, picks }
}

export default async function askRoutes(app) {
  app.decorateRequest('user', null)
  const savedPlaces = createSavedPlacesService()
  // POST /ask { message, history? } → { reply, places: [...card fields, reason], filters }
  // Two Gemini calls: interpret the message into tags, then rank the search_places() results.
  app.post(
    '/ask',
    {
      preHandler: createOptionalUser(),
      schema: {
        body: {
          type: 'object',
          properties: {
            message: { type: 'string', minLength: 1, maxLength: 500 },
            history: {
              type: 'array',
              maxItems: 10,
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant'] },
                  text: { type: 'string', maxLength: 1000 },
                },
                required: ['role', 'text'],
                additionalProperties: false,
              },
            },
          },
          required: ['message'],
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { message, history = [] } = req.body
      try {
        const vocab = await getTagVocabulary()
        const facetOf = new Map(vocab.map((t) => [t.name, t.facet]))
        const tagNames = [...facetOf.keys()]

        const started = Date.now()
        const filters = await generateJson({
          system: interpretSystemPrompt(vocab),
          input: interpretInput(message, history),
          schema: interpretSchema(tagNames),
          timeoutMs: 10_000,
        })
        req.log.info({ step: 'interpret', ms: Date.now() - started }, 'gemini')
        const asked = [...new Set([...filters.must_tags, ...filters.want_tags])].filter((t) => facetOf.has(t))
        const must = filters.must_tags.filter((t) => MUST_FACETS.has(facetOf.get(t)))
        const want = asked.filter((t) => !must.includes(t))
        const count = Math.min(Math.max(filters.count || 3, 1), 10)
        const applied = { intent: filters.intent, must_tags: must, want_tags: want, count, relaxed: false }

        if (filters.off_topic) {
          return { reply: filters.reply || 'I can only help with food and drinks in Singapore!', places: [], filters: applied }
        }

        const { candidates, exact, dropped } = await findCandidates(must, want, count, facetOf)
        applied.relaxed = dropped.length > 0
        if (!candidates.length) {
          return { reply: "Couldn't find anything for that yet. Try another area or vibe?", places: [], filters: applied }
        }

        const { reply: text, picks } = await rankCandidates(
          { intent: filters.intent, count, exact, dropped, candidates },
          req.log,
        )
        return { reply: text, places: await savedPlaces.annotate(picks, req.user?.id), filters: applied }
      } catch (err) {
        if (err instanceof RateLimitError) {
          return reply.code(429).send({ error: 'Lots of people asking right now. Try again in a minute.' })
        }
        if (err.status >= 500) {
          req.log.warn({ err }, 'Gemini unavailable')
          return reply.code(503).send({ error: 'The AI is a bit overloaded right now. Try again in a few seconds.' })
        }
        req.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )
}
