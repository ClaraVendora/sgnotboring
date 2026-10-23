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

const postJson = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getHealth = () => request('/health')
export async function getAccount() {
  const { data, error } = await getSession()
  if (error) throw error
  if (!data.session) throw Object.assign(new Error('Please log in again.'), { status: 401 })
  return request('/me', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
}
export const getTags = () => request('/tags')
export const getPlace = (id) => request(`/places/${encodeURIComponent(id)}`)
export function getPlaces(tags = [], q = '') {
  const qs = new URLSearchParams()
  if (tags.length) qs.set('tags', tags.join(','))
  if (q.trim()) qs.set('q', q.trim())
  return request(`/places?${qs}`)
}
// history: earlier turns [{ role: 'user' | 'assistant', text }] so follow-ups make sense
export const askPlaces = (message, history = []) => postJson('/ask', { message, history })
