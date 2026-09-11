import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not set — client will not work')
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'anon')
