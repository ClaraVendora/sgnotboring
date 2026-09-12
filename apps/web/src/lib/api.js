const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request(path) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API ${res.status}`)
  }
  return res.json()
}

export const getHealth = () => request('/health')
export const getTags = () => request('/tags')
export const getPlace = (id) => request(`/places/${id}`)
export function getPlaces(tags = []) {
  const qs = tags.length ? `?tags=${encodeURIComponent(tags.join(','))}` : ''
  return request(`/places${qs}`)
}
