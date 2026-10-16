import { formatVocabulary } from './vocabulary.js'

// Tags derived from Google's data by code, never by the LLM: they're facts, not judgement.
export const RULE_TAGS = new Set(['Budget', 'Mid-Range', 'Splurge', 'Late Night', 'Outdoor Seating', 'Pet Friendly'])

const BUDGET_BY_PRICE = {
  PRICE_LEVEL_FREE: 'Budget',
  PRICE_LEVEL_INEXPENSIVE: 'Budget',
  PRICE_LEVEL_MODERATE: 'Mid-Range',
  PRICE_LEVEL_EXPENSIVE: 'Splurge',
  PRICE_LEVEL_VERY_EXPENSIVE: 'Splurge',
}

const FEATURE_FLAGS = [
  'servesBreakfast', 'servesBrunch', 'servesLunch', 'servesDinner', 'servesCoffee', 'servesDessert',
  'servesBeer', 'servesWine', 'servesCocktails', 'servesVegetarianFood', 'goodForGroups',
  'outdoorSeating', 'allowsDogs', 'reservable', 'takeout',
]

// Closes at 23:30 or later (or runs past midnight) on at least 3 days, or is open 24 hours.
function isLateNight(periods = []) {
  if (periods.some((p) => !p.close)) return true
  const lateDays = new Set(
    periods
      .filter(({ open, close }) => close.day !== open.day || close.hour * 60 + close.minute >= 23 * 60 + 30)
      .map((p) => p.open.day),
  )
  return lateDays.size >= 3
}

// payload: Places API (New) object → tags we can derive without the LLM.
export function ruleTags(payload) {
  const tags = []
  if (BUDGET_BY_PRICE[payload.priceLevel]) tags.push(BUDGET_BY_PRICE[payload.priceLevel])
  if (isLateNight(payload.regularOpeningHours?.periods)) tags.push('Late Night')
  if (payload.outdoorSeating) tags.push('Outdoor Seating')
  if (payload.allowsDogs) tags.push('Pet Friendly')
  return tags
}

// The compact view of a place the LLM sees (keeps tokens down on the free tier).
export function toTaggingInput(id, payload) {
  return {
    id,
    name: payload.displayName?.text,
    address: payload.formattedAddress,
    googleType: payload.primaryType,
    rating: payload.rating,
    ratingCount: payload.userRatingCount,
    priceLevel: payload.priceLevel,
    hours: payload.regularOpeningHours?.weekdayDescriptions,
    description: payload.editorialSummary?.text,
    features: FEATURE_FLAGS.filter((f) => payload[f] === true),
  }
}

// tags: the vocabulary minus RULE_TAGS.
export function taggingSystemPrompt(tags) {
  return `You tag restaurants, cafes and bars in Singapore for "SG is not boring", a discovery app for young Singaporeans. Users search by these tags, so accuracy matters more than coverage.

For every place in the input JSON array, return its id and:
- tags: 4 to 10 tags, ONLY from the vocabulary below.
  - Exactly one "type" tag. Use Hawker for stalls in a hawker centre, food centre, kopitiam or coffee shop, even if Google calls them a restaurant, and for hawker centres themselves.
  - Exactly one "area" tag: the area whose description names a street, building or landmark that appears in the address (e.g. "Chip Bee Gardens" → Holland Village). Omit it if none fits.
  - Cuisine, vibe, occasion, drinks and feature tags only when the input supports them.
  - Dietary tags only on explicit evidence: Halal only if the description says halal or Muslim-owned; Vegetarian Only only if it says the whole menu is vegetarian; Vegetarian Friendly if servesVegetarianFood is listed. Never infer dietary tags from cuisine.
- summary: one sentence, at most 120 characters, saying why someone would go. Casual, confident local voice. Only facts from the input; no emojis, no exclamation marks.

Vocabulary (facet, then tag: meaning):
${formatVocabulary(tags)}`
}

// ids: the batch's place ids; tagNames: allowed tags. Enums stop the model inventing either.
export function taggingSchema(ids, tagNames) {
  return {
    type: 'object',
    properties: {
      places: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ids },
            tags: { type: 'array', items: { type: 'string', enum: tagNames }, maxItems: 12 },
            summary: { type: 'string' },
          },
          required: ['id', 'tags', 'summary'],
        },
      },
    },
    required: ['places'],
  }
}
