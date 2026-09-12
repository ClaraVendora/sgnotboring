import { supabase } from '../services/supabase.js'

const CARD_FIELDS =
  'id, name, address, rating, user_ratings_total, price_level, tags, summary, opening_hours'

export default async function placesRoutes(app) {
  // GET /places?tags=Late%20Night,Spicy  → places matching ANY of the tags
  app.get('/places', async (req, reply) => {
    const tags = String(req.query.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    let query = supabase.from('places').select(CARD_FIELDS).order('rating', { ascending: false })
    if (tags.length) query = query.overlaps('tags', tags)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // GET /places/:id
  app.get('/places/:id', async (req, reply) => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) return reply.code(500).send({ error: error.message })
    if (!data) return reply.code(404).send({ error: 'Place not found' })
    return data
  })

  // GET /tags → sorted distinct tags across all places (for the filter pills)
  app.get('/tags', async (_req, reply) => {
    const { data, error } = await supabase.from('places').select('tags')
    if (error) return reply.code(500).send({ error: error.message })
    return [...new Set(data.flatMap((row) => row.tags))].sort()
  })
}
