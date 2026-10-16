import { formatVocabulary } from './vocabulary.js'

// ---- step 1: message (+ earlier turns) → search filters ----

export function interpretSystemPrompt(tags) {
  return `You turn a message from someone looking for food or drinks in Singapore into search filters for "SG is not boring", a discovery app for young Singaporeans.

Return:
- intent: the request as one standalone sentence, folding in earlier turns. For example "cheaper ones?" after a date-night-in-Tanjong-Pagar request becomes "cheaper date night spots in Tanjong Pagar".
- must_tags: only hard constraints, from the area, dietary, budget and time facets: a named area, a dietary need, an explicit budget, late night or brunch. Usually 0-2 tags; an over-strict filter finds nothing.
- want_tags: everything else that fits: place type, cuisine, vibe, occasion, drinks, features. 1-6 tags.
- count: how many places (options, recommendations) they asked for. Default 3, max 10. A group size is not a count: "for 6", "6 pax", "a group of 6" means Group Friendly with count 3.
- off_topic: true only if the message has nothing to do with finding somewhere to eat or drink in Singapore.
- reply: if off_topic, one friendly sentence steering them back to food. Otherwise an empty string.

Use only tags from the vocabulary below. Local phrasing to map:
- "supper", "after midnight", "late" → Late Night
- "cheap", "broke", "student budget" → Budget; "atas", "fancy", "treat" → Splurge
- "study", "laptop", "work from" → Work Friendly
- "with the gang", "big group", "my team" → Group Friendly; "alone", "solo" → Solo Friendly
- "makan" means eat; "kopi" means coffee
- At most one area tag, only when the user names a place in Singapore.

Vocabulary (facet, then tag: meaning):
${formatVocabulary(tags)}`
}

export function interpretInput(message, history) {
  if (!history.length) return `Latest message: ${message}`
  const transcript = history.map((t) => `${t.role}: ${t.text}`).join('\n')
  return `Conversation so far:\n${transcript}\n\nLatest message: ${message}`
}

export function interpretSchema(tagNames) {
  const tagList = (maxItems) => ({ type: 'array', items: { type: 'string', enum: tagNames }, maxItems })
  return {
    type: 'object',
    properties: {
      intent: { type: 'string' },
      must_tags: tagList(4),
      want_tags: tagList(8),
      count: { type: 'integer', minimum: 1, maximum: 10 },
      off_topic: { type: 'boolean' },
      reply: { type: 'string' },
    },
    required: ['intent', 'must_tags', 'want_tags', 'count', 'off_topic', 'reply'],
  }
}

// ---- step 2: candidates from search_places() → ranked picks with reasons ----

export const RANK_SYSTEM_PROMPT = `You are the recommender for "SG is not boring", a food discovery app for young Singaporeans. From the candidate places (JSON), pick the best ones for the request.

Rules:
- Pick exactly \`count\` places, or every candidate if there are fewer. Use only candidate ids, each once.
- Order best first. How well a place fits the request (tags, summary) matters more than its rating; use rating and ratingCount to break ties.
- reason: one sentence, at most 25 words, telling the user why this place fits what they asked for. Only facts from the candidate data. Don't start with the place name.
- reply: one short, friendly sentence introducing the picks. Casual Singaporean voice; light Singlish is fine, don't overdo it.
- If there is a \`note\`, only some candidates meet every requirement. Put those first, and say plainly in reply and in the other picks' reasons what they miss (e.g. "not in Holland V, but..."). Never talk about filters or tags.`

// candidates: rows from search_places(); exact/dropped: from findCandidates() in routes/ask.js.
export function rankInput({ intent, count, exact, dropped, candidates }) {
  return JSON.stringify({
    request: intent,
    count,
    note: dropped.length
      ? `Only ${exact} candidate(s) meet every requirement. The others are close matches that miss: ${dropped.join(', ')}.`
      : undefined,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      tags: c.tags,
      summary: c.summary,
      rating: c.rating,
      ratingCount: c.user_ratings_total,
      priceLevel: c.price_level,
    })),
  })
}

export function rankSchema(ids, count) {
  return {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      picks: {
        type: 'array',
        minItems: Math.min(count, ids.length),
        maxItems: count,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ids },
            reason: { type: 'string' },
          },
          required: ['id', 'reason'],
        },
      },
    },
    required: ['reply', 'picks'],
  }
}
