// Area labels come from the controlled area-tag vocabulary (create_tags migration).
// Do not infer neighbourhoods from free-form addresses or other tag facets.
const AREA_TAGS = new Set([
  'Bugis & Kampong Glam', 'Chinatown', 'Tanjong Pagar', 'CBD', 'Tiong Bahru', 'Orchard',
  'City Hall', 'Riverside', 'Marina Bay', 'Little India', 'Jalan Besar', 'Katong & Joo Chiat',
  'Holland Village', 'Dempsey', 'Bukit Timah', 'Novena', 'Upper Thomson', 'East Coast', 'Sentosa', 'Changi',
])
export const placeArea = (place) => (place.tags ?? []).find((tag) => AREA_TAGS.has(tag)) ?? 'Area unknown'
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export function ratingCount(value) {
  const count = Math.max(0, Number(value) || 0)
  return count > 999 ? compactCount.format(count).toLowerCase() : String(count)
}
export function priceBand(level) {
  if (level === 0) return 'Free'
  return Number.isInteger(level) && level >= 1 && level <= 4 ? '$'.repeat(level) : 'Price unknown'
}
export function placeMeta(place) {
  const rating = place.rating == null ? 'No rating' : `★ ${Number(place.rating).toFixed(1)} (${ratingCount(place.user_ratings_total)})`
  return `${placeArea(place)} · ${priceBand(place.price_level)} · ${rating}`
}
