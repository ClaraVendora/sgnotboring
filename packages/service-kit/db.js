import { createClient } from '@supabase/supabase-js'

// One Supabase project, one Postgres schema per service. A service's client is pinned to its
// own schema (catalog, accounts or community), so it cannot name another service's tables;
// anything it needs from another service comes over HTTP. The service role key bypasses RLS,
// so every query must scope rows to the verified user itself.
const clients = new Map()

export function createDb(schema) {
  if (!clients.has(schema)) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) console.warn('[db] SUPABASE_URL and a key are not set — database calls will fail')
    clients.set(schema, createClient(url ?? 'http://localhost', key ?? 'anon', {
      auth: { persistSession: false },
      db: { schema },
    }))
  }
  return clients.get(schema)
}
