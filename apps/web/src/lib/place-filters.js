import { isOpenNow } from './hours.js'

// Quick labels and their vocabulary mapping have one owner.
export const QUICK_FILTERS = [
  { label: 'Open now', param: 'open_now' },
  { label: 'Under $20', tag: 'Budget' },
  { label: 'Supper', tag: 'Late Night' },
  { label: 'Cafe', tag: 'Cafe' },
  { label: 'Group', tag: 'Group Friendly' },
]

export function filterOpenPlaces(places, openNow, now = new Date()) {
  return openNow ? places.filter((place) => isOpenNow(place.opening_hours, now)) : places
}
