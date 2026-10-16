const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API ${res.status}`)
  }
  return res.json()
}

const postJson = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getHealth = () => request('/health')
export const getTags = () => request('/tags')
export const getPlace = (id) => request(`/places/${id}`)
export function getPlaces(tags = []) {
  const qs = tags.length ? `?tags=${encodeURIComponent(tags.join(','))}` : ''
  return request(`/places${qs}`)
}
// history: earlier turns [{ role: 'user' | 'assistant', text }] so follow-ups make sense
export const askPlaces = (message, history = []) => postJson('/ask', { message, history })
