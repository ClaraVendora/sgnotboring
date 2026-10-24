import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeGoogleMapsPlace, searchGoogleMaps } from './google-maps.js'

const result = {
  place_id: 'ChIJ-test', title: 'Test Hawker', address: '1 Test Road, Singapore',
  gps_coordinates: { latitude: 1.3, longitude: 103.8 }, country: 'Singapore',
  rating: 4.5, reviews: 123, price: '$$', type_id: 'restaurant',
  operating_hours: { monday: '10 AM–9 PM', sunday: 'Closed' },
}

test('converts SerpApi fields to the DB trigger format without inventing live opening status', () => {
  const place = normalizeGoogleMapsPlace(result)
  assert.equal(place.id, result.place_id)
  assert.equal(place.displayName.text, result.title)
  assert.equal(place.userRatingCount, 123)
  assert.equal(place.priceLevel, 'PRICE_LEVEL_MODERATE')
  assert.deepEqual(place.location, { latitude: 1.3, longitude: 103.8 })
  assert.deepEqual(place.regularOpeningHours, { weekdayDescriptions: ['Monday: 10 AM–9 PM', 'Sunday: Closed'] })
  assert.equal(new URL(place.googleMapsUri).searchParams.get('query_place_id'), result.place_id)
  assert.equal(normalizeGoogleMapsPlace({ ...result, price: '$10–20' }).priceLevel, null)
})

test('rejects missing identities and results outside Singapore', () => {
  assert.equal(normalizeGoogleMapsPlace({ title: 'Missing ID' }), null)
  assert.equal(normalizeGoogleMapsPlace({ ...result, country: 'Malaysia' }), null)
  assert.equal(normalizeGoogleMapsPlace({ ...result, gps_coordinates: { latitude: 1.5, longitude: 103.8 } }), null)
  assert.equal(normalizeGoogleMapsPlace({ ...result, gps_coordinates: null, address: 'Johor Bahru' }), null)
})

test('keeps public cover photos and handles missing, alternate, and unsafe URLs', () => {
  const thumbnail = 'https://lh5.googleusercontent.com/p/store-photo=w640-h360-k-no'
  const alternate = 'https://serpapi.com/images/url/store-photo'
  assert.equal(normalizeGoogleMapsPlace({ ...result, thumbnail }).photoUrl, thumbnail)
  assert.equal(normalizeGoogleMapsPlace({ ...result, thumbnail: thumbnail.replace('https:', '') }).photoUrl, thumbnail)
  assert.equal(normalizeGoogleMapsPlace(result).photoUrl, null)
  for (const thumbnail of ['', 'broken', 'javascript:alert(1)', 'https://example.com/photo',
    'https://serpapi.com/search.json?api_key=secret', 'https://lh5.googleusercontent.com/p/photo?api_key=secret']) {
    assert.equal(normalizeGoogleMapsPlace({ ...result, thumbnail }).photoUrl, null)
    assert.equal(normalizeGoogleMapsPlace({ ...result, thumbnail, serpapi_thumbnail: alternate }).photoUrl, alternate)
  }
})

test('uses one server-side Singapore search, deduplicates and respects the limit', async () => {
  let calls = 0
  const places = await searchGoogleMaps({
    apiKey: 'test-secret', query: 'food places in Singapore', limit: 1,
    fetchImpl: async (url) => {
      calls++
      assert.equal(url.origin, 'https://serpapi.com')
      assert.equal(url.searchParams.get('api_key'), 'test-secret')
      assert.equal(url.searchParams.get('engine'), 'google_maps')
      assert.equal(url.searchParams.get('gl'), 'sg')
      return Response.json({ local_results: [result, result, { ...result, place_id: 'other' }] })
    },
  })
  assert.equal(calls, 1)
  assert.equal(places.length, 1)
  assert.equal(places[0].id, result.place_id)
})

test('rejects invalid configuration before spending search credits', async () => {
  const fetchImpl = () => assert.fail('Must not call SerpApi')
  await assert.rejects(searchGoogleMaps({ apiKey: '', fetchImpl }), /SERPAPI_KEY/)
  for (const limit of [0, 1201, NaN, 1.5]) {
    await assert.rejects(searchGoogleMaps({ apiKey: 'key', limit, fetchImpl }), /Limit/)
  }
  await assert.rejects(searchGoogleMaps({ apiKey: 'key', query: ' ', fetchImpl }), /Query/)
  await assert.rejects(searchGoogleMaps({ apiKey: 'key', maxRequests: 0, fetchImpl }), /budget/)
})

test('paginates queries fairly and stops at the shared request budget', async () => {
  const calls = []
  const pages = []
  const places = await searchGoogleMaps({
    apiKey: 'key', queries: ['hawkers in Singapore', 'cafes in Singapore'], limit: 100, maxRequests: 3,
    onPage: async (page) => pages.push(page),
    fetchImpl: async (url) => {
      calls.push([url.searchParams.get('q'), url.searchParams.get('start')])
      return Response.json({
        local_results: [{ ...result, place_id: `place-${calls.length}` }],
        serpapi_pagination: { next: 'https://serpapi.com/search.json?start=20' },
      })
    },
  })
  assert.deepEqual(calls, [['hawkers in Singapore', '0'], ['cafes in Singapore', '0'], ['hawkers in Singapore', '20']])
  assert.equal(places.length, 3)
  assert.deepEqual(pages.map((page) => page.places.length), [1, 1, 1])
})

test('stops when results repeat or pagination ends', async () => {
  let calls = 0
  const places = await searchGoogleMaps({
    apiKey: 'key', limit: 100,
    fetchImpl: async () => {
      calls++
      return Response.json({ local_results: [result], serpapi_pagination: { next: 'next' } })
    },
  })
  assert.equal(calls, 2)
  assert.equal(places.length, 1)
})

test('saves completed pages before a later quota error', async () => {
  const saved = []
  let calls = 0
  await assert.rejects(searchGoogleMaps({
    apiKey: 'key', limit: 100,
    onPage: async ({ places }) => saved.push(...places),
    fetchImpl: async () => ++calls === 1
      ? Response.json({ local_results: [result], serpapi_pagination: { next: 'next' } })
      : Response.json({ error: 'Search quota exhausted' }, { status: 429 }),
  }), /quota exhausted/)
  assert.equal(saved.length, 1)
})

test('reports provider errors without revealing the key', async () => {
  await assert.rejects(searchGoogleMaps({
    apiKey: 'test-secret',
    fetchImpl: async () => Response.json({ error: 'Invalid test-secret' }, { status: 401 }),
  }), { message: 'SerpApi: Invalid [redacted]' })
  await assert.rejects(searchGoogleMaps({
    apiKey: 'key', fetchImpl: async () => Response.json({ local_results: {} }),
  }), /unexpected response/)
  assert.deepEqual(await searchGoogleMaps({
    apiKey: 'key', fetchImpl: async () => Response.json({ local_results: [] }),
  }), [])
})
