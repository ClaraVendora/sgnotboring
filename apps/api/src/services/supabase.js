import { createClient } from '@supabase/supabase-js'

// Server-side client. Prefers the service role key (bypasses RLS, needed for inserts
// from the ingest script); falls back to the anon key for read-only use.
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('[supabase] SUPABASE_URL and a key are not set — client will not work')
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'anon', {
  auth: { persistSession: false },
})
