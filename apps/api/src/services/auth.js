import { createClient } from '@supabase/supabase-js'

let client

export async function verifyAccessToken(token) {
  // getUser contacts this project's Auth server. Decoding a JWT alone is not
  // verification; never trust a user_id or role supplied by the caller.
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw Object.assign(new Error('Authentication unavailable'), { status: 503 })
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }),
      },
    })
  }
  const { data, error } = await client.auth.getUser(token)
  if (error) {
    if (error.status >= 500 || error.name === 'AuthRetryableFetchError') {
      throw Object.assign(new Error('Authentication unavailable'), { status: 503 })
    }
    return null
  }
  return data.user
}
