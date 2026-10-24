// SerpApi Google Maps results → the Places API (New) shape used by our DB trigger.
// The API key stays on the server; never log the request URL (it contains the key).
const PRICE_LEVELS = [
  'PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE',
  'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE',
]
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// Keep only public image URLs; search/API URLs can contain server credentials.
function coverPhoto(result) {
  for (const candidate of [result.thumbnail, result.serpapi_thumbnail]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    try {
      const url = new URL(candidate.startsWith('//') ? `https:${candidate}` : candidate)
      const googleImage = /(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)
      const serpImage = url.hostname === 'serpapi.com' && url.pathname.startsWith('/images/')
      if (url.protocol === 'https:' && !url.username && !url.password &&
          !url.searchParams.has('api_key') && (googleImage || serpImage)) return url.href
    } catch { /* Try the alternate image URL. */ }
  }
  return null
}

export function normalizeGoogleMapsPlace(result) {
  if (!result.place_id || !result.title) return null
  const latitude = result.gps_coordinates?.latitude
  const longitude = result.gps_coordinates?.longitude
  // Searches can include nearby Malaysia/Indonesia. Keep Singapore results only.
  if (result.country && result.country !== 'Singapore') return null
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (latitude < 1.15 || latitude > 1.48 || longitude < 103.59 || longitude > 104.1) return null
  } else if (!/singapore/i.test(result.address ?? '')) return null

  // Only map explicit $ tiers; a monetary range such as "$10–20" isn't a price tier.
  const tier = /^\${1,4}$/.test(result.price ?? '') ? result.price.length : null
  const weekdayDescriptions = DAYS
    .filter((day) => typeof result.operating_hours?.[day] === 'string')
    .map((day) => `${day[0].toUpperCase()}${day.slice(1)}: ${result.operating_hours[day]}`)
  const mapsUrl = new URL('https://www.google.com/maps/search/')
  mapsUrl.searchParams.set('api', '1')
  mapsUrl.searchParams.set('query', `${result.title} ${result.address ?? 'Singapore'}`)
  mapsUrl.searchParams.set('query_place_id', result.place_id)

  return {
    id: result.place_id,
    displayName: { text: result.title, languageCode: 'en' },
    formattedAddress: result.address ?? null,
    location: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude } : null,
    primaryType: result.type_id ?? result.type,
    types: result.type_ids ?? result.types ?? [],
    rating: typeof result.rating === 'number' ? result.rating : null,
    userRatingCount: Number.isInteger(result.reviews) ? result.reviews : null,
    priceLevel: tier === null ? null : PRICE_LEVELS[tier],
    regularOpeningHours: weekdayDescriptions.length ? { weekdayDescriptions } : null,
    editorialSummary: result.description ? { text: result.description, languageCode: 'en' } : null,
    googleMapsUri: mapsUrl.href,
    photoUrl: coverPhoto(result),
  }
}

export async function searchGoogleMaps({
  query = 'food places in Singapore',
  queries = [query],
  limit = 20,
  maxRequests = 6,
  onPage = () => {},
  apiKey = process.env.SERPAPI_KEY,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey?.trim() || /^(paste-|your-)/i.test(apiKey)) {
    throw new Error('Set SERPAPI_KEY in apps/api/.env before importing places.')
  }
  if (!Array.isArray(queries) || !queries.length || queries.some((q) => typeof q !== 'string' || !q.trim() || q.length > 500)) {
    throw new Error('Query must contain 1–500 characters.')
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1200) {
    throw new Error('Limit must be an integer between 1 and 1200.')
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 60) {
    throw new Error('Request budget must be an integer between 1 and 60.')
  }
  // Round-robin queries for broader coverage before fetching deeper pages.
  // Cap each query at offset 100, following SerpApi's pagination recommendation.
  const queue = [...new Set(queries.map((q) => q.trim()))].map((q) => ({ query: q, start: 0 }))
  const unique = new Map()
  let requests = 0
  while (queue.length && unique.size < limit && requests < maxRequests) {
    const current = queue.shift()
    const body = await fetchPage(current)
    requests++
    const previousSize = unique.size
    const pagePlaces = new Map()
    for (const result of body.local_results ?? []) {
      const place = normalizeGoogleMapsPlace(result)
      if (place && (unique.has(place.id) || unique.size < limit)) {
        unique.set(place.id, place)
        pagePlaces.set(place.id, place)
      }
    }
    // Persist completed pages immediately, so a later quota/network error loses no data.
    await onPage({ places: [...pagePlaces.values()], query: current.query, requests })
    if (body.serpapi_pagination?.next && current.start < 100 && unique.size > previousSize) {
      queue.push({ ...current, start: current.start + 20 })
    }
  }
  return [...unique.values()].slice(0, limit)

  async function fetchPage({ query: pageQuery, start }) {
    const url = new URL('https://serpapi.com/search.json')
    url.search = new URLSearchParams({
      engine: 'google_maps', type: 'search', q: pageQuery, hl: 'en', gl: 'sg',
      ll: '@1.3521,103.8198,12z', start: String(start), api_key: apiKey.trim(),
    }).toString()
    let response
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) })
    } catch {
      throw new Error('Could not reach SerpApi within 60 seconds. Check connectivity and try again.')
    }
    const body = await response.json().catch(() => null)
    if (!response.ok || body?.error || body?.search_metadata?.status === 'Error') {
      // Redact credentials even if the provider echoes them in an error message.
      const message = String(body?.error ?? `HTTP ${response.status}`).replaceAll(apiKey.trim(), '[redacted]')
      throw new Error(`SerpApi: ${message}`)
    }
    if (!body || (body.local_results !== undefined && !Array.isArray(body.local_results))) {
      throw new Error('SerpApi returned an unexpected response; this page was not imported.')
    }
    return body
  }
}
