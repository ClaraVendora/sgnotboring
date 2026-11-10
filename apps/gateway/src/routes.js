// Which service owns each public path. Order matters: review paths live under /places and /me
// but belong to Community, so they are matched first. /internal/* is never forwarded.
const RULES = [
  [/^\/internal(\/|$)/, null],
  [/^\/places\/[^/]+\/reviews?$/, 'community'],
  [/^\/me\/reviews(\/|$)/, 'community'],
  [/^\/collections(\/|$)/, 'community'],
  [/^\/(places|tags)(\/|$)/, 'places'],
  [/^\/ask$/, 'ask'],
  [/^\/me(\/|$)/, 'accounts'],
]

// → 'places' | 'ask' | 'accounts' | 'community' | null (path without the query string)
export function serviceFor(path) {
  for (const [pattern, service] of RULES) if (pattern.test(path)) return service
  return null
}

export function upstreamsFromEnv(env = process.env) {
  return {
    places: env.PLACES_URL || 'http://localhost:3011',
    ask: env.ASK_URL || 'http://localhost:3012',
    accounts: env.ACCOUNTS_URL || 'http://localhost:3013',
    community: env.COMMUNITY_URL || 'http://localhost:3014',
  }
}
