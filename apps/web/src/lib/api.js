import { createClient } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const authUrl = import.meta.env.VITE_SUPABASE_URL
const authKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// Only the public/anon key belongs in the browser. The SDK owns token persistence,
// refresh rotation, cross-tab events and email callback processing.
let authClient = null
try {
  if (authUrl && authKey && !authKey.startsWith('paste-')) {
    authClient = createClient(authUrl, authKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
} catch {
  // A missing deployment setting must not prevent guests from browsing.
}

export const authConfigured = Boolean(authClient)
function auth() {
  if (!authClient) throw Object.assign(new Error('Auth unavailable'), { code: 'auth_not_configured' })
  return authClient.auth
}

export const getSession = () => auth().getSession()
export const onAuthStateChange = (callback) => auth().onAuthStateChange(callback)
const confirmationUrl = () => `${window.location.origin}/auth/callback`
export const signUp = ({ email, password, displayName }) => auth().signUp({
  email: email.trim(),
  password,
  options: {
    emailRedirectTo: confirmationUrl(),
    data: { display_name: displayName.trim() },
  },
})
export const signIn = ({ email, password }) => auth().signInWithPassword({ email: email.trim(), password })
export async function updateProfile({ name, email, icon }, expectedUserId) {
  const current = await auth().getUser()
  if (current.error) throw current.error
  if (!current.data.user || current.data.user.id !== expectedUserId) throw Object.assign(new Error('Please log in again.'), { status: 401 })
  const requestedEmail = email.trim().toLowerCase()
  const emailChanged = requestedEmail !== current.data.user.email?.toLowerCase()
  const { data, error } = await auth().updateUser({
    data: { display_name: name.trim(), avatar_icon: icon },
    ...(emailChanged ? { email: requestedEmail } : {}),
  }, { emailRedirectTo: confirmationUrl() })
  if (error) throw error
  return { user: data.user, pendingEmail: emailChanged && data.user.email?.toLowerCase() !== requestedEmail
    ? requestedEmail : data.user.new_email ?? '' }
}
export const signOut = () => auth().signOut({ scope: 'local' })
export const resendConfirmation = (email) => auth().resend({
  type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmationUrl() },
})

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error ?? `API ${res.status}`), { status: res.status })
  }
  return res.json()
}

// Reads the current access token on every call, so a routine refresh is picked up without
// callers tracking tokens. Guest-capable calls (required: false) fall back to a guest
// request when the session cannot be read or the API rejects the token.
async function sessionRequest(path, options = {}, { required = false } = {}) {
  let token
  if (authConfigured) {
    const { data, error } = await getSession()
    if (error && required) throw error
    token = data?.session?.access_token
  }
  if (required && !token) throw Object.assign(new Error('Please log in again.'), { status: 401 })
  const send = (credential) => request(path, { ...options, headers: {
    ...options.headers, ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
  } })
  try {
    return await send(token)
  } catch (error) {
    if (required || !token || error.status !== 401) throw error
    return send(null)
  }
}

export const getHealth = () => request('/health')
export const getAccount = () => sessionRequest('/me', {}, { required: true })
export const getSurveyOptions = () => sessionRequest('/me/preferences/options', {}, { required: true })
export const getPreferences = () => sessionRequest('/me/preferences', {}, { required: true })
export const putPreferences = (tags) => sessionRequest('/me/preferences', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }),
}, { required: true })
export const getSavedPlaces = () => sessionRequest('/me/saved-places', {}, { required: true })
export const setPlaceSaved = (id, saved) => sessionRequest(`/me/saved-places/${encodeURIComponent(id)}`,
  { method: saved ? 'PUT' : 'DELETE' }, { required: true })
export const getTags = () => request('/tags')
export const getPlace = (id) => sessionRequest(`/places/${encodeURIComponent(id)}`)
export const getPlaceReviews = (id) => request(`/places/${encodeURIComponent(id)}/reviews`)
export const savePlaceReview = (id, body, rating) => sessionRequest(`/places/${encodeURIComponent(id)}/review`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, rating }),
}, { required: true })
export const getMyReviews = () => sessionRequest('/me/reviews', {}, { required: true })
export const updateMyReview = (id, body, rating) => sessionRequest(`/me/reviews/${encodeURIComponent(id)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, rating }),
}, { required: true })
export const deleteMyReview = (id) => sessionRequest(`/me/reviews/${encodeURIComponent(id)}`, {
  method: 'DELETE',
}, { required: true })
export const getCollections = (placeId) => sessionRequest(`/collections${placeId ? `?place_id=${encodeURIComponent(placeId)}` : ''}`, {}, { required: true })
export const getCollectionBookmarks = () => sessionRequest('/collections/bookmarks', {}, { required: true })
export const removePlaceFromCollections = (placeId) => sessionRequest(`/collections/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' }, { required: true })
export const createCollection = (name) => sessionRequest('/collections', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
}, { required: true })
export const getCollection = (id) => sessionRequest(`/collections/${encodeURIComponent(id)}`, {}, { required: true })
export const addCollectionPlace = (id, placeId) => sessionRequest(`/collections/${encodeURIComponent(id)}/places/${encodeURIComponent(placeId)}`, {
  method: 'PUT',
}, { required: true })
export const removeCollectionPlace = (id, placeId) => sessionRequest(`/collections/${encodeURIComponent(id)}/places/${encodeURIComponent(placeId)}`, {
  method: 'DELETE',
}, { required: true })
export const shareCollection = (id) => sessionRequest(`/collections/${encodeURIComponent(id)}/share`, { method: 'POST' }, { required: true })
export const getSharedCollection = (token) => request(`/collections/shared/${encodeURIComponent(token)}`)
export function getPlaces(tags = [], q = '') {
  const qs = new URLSearchParams()
  if (tags.length) qs.set('tags', tags.join(','))
  if (q.trim()) qs.set('q', q.trim())
  return sessionRequest(`/places?${qs}`)
}
// history: earlier turns [{ role: 'user' | 'assistant', text }] so follow-ups make sense.
// personalised: lean on the user's survey answers and saved places. signal: aborts the request.
export const askPlaces = (message, history = [], { personalised = false, signal } = {}) => sessionRequest('/ask', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
  body: JSON.stringify({ message, history, ...(personalised && { personalised }) }),
})
