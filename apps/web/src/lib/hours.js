// Google Places opening_hours → { label, color }.
// We store the raw Google object; `open_now` is the cheap MVP signal.
export function openStatus(openingHours) {
  if (!openingHours || typeof openingHours.open_now !== 'boolean') {
    return { label: 'Hours unknown', color: 'gray' }
  }
  return openingHours.open_now
    ? { label: 'Open now', color: 'green' }
    : { label: 'Closed', color: 'red' }
}
