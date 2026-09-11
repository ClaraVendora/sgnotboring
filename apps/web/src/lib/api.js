const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export function getHealth() {
  return request('/health')
}

export function getPlaces(tags = []) {
  const params = new URLSearchParams()
  if (tags.length) params.set('tags', tags.join(','))
  const qs = params.toString()
  return request(`/places${qs ? `?${qs}` : ''}`)
}
