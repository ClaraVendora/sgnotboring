// Paginated import with an explicit request budget. Existing places are refreshed by ID.
// npm run ingest -w api -- --query "food places in Singapore" --limit 20
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { searchGoogleMaps } from '../services/google-maps.js'

try {
  const { values: args } = parseArgs({
    options: {
      query: { type: 'string', multiple: true },
      limit: { type: 'string', default: '20' },
      'max-requests': { type: 'string', default: '6' },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  if (!args['dry-run'] && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      /^(paste-|your-)/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY))) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env before importing.')
  }
  let supabase
  if (!args['dry-run']) {
    ;({ supabase } = await import('../services/supabase.js'))
    // Check the destination before spending a SerpApi search credit.
    const { error } = await supabase.from('raw_places').select('google_place_id').limit(1)
    if (error) throw new Error(`Database is not ready: ${error.message}. Check your Supabase config and apply pending migrations (locally: npx supabase migration up --local).`)
  }
  let requests = 0
  const places = await searchGoogleMaps({
    queries: args.query ?? ['food places in Singapore'],
    limit: Number(args.limit),
    maxRequests: Number(args['max-requests']),
    onPage: async ({ places: page, query, requests: used }) => {
      requests = used
      if (!args['dry-run'] && page.length) {
        const { error } = await supabase.from('raw_places').upsert(
          page.map((payload) => ({
            google_place_id: payload.id, payload,
            source: `serpapi:google_maps:${query}`,
            fetched_at: new Date().toISOString(),
          })),
          { onConflict: 'google_place_id', defaultToNull: false },
        )
        if (error) throw new Error(`Could not save places: ${error.message}`)
      }
      console.log(`Request ${used}/${args['max-requests']}: ${page.length} places ${args['dry-run'] ? 'previewed' : 'saved'} for "${query}".`)
    },
  })
  console.log(`Found ${places.length} unique Singapore place(s) using ${requests} request(s).`)
  if (places.length < Number(args.limit)) console.log('Stopped at the request budget, end of available results, or repeated pages. Increase --max-requests or add more --query values for broader coverage.')
  if (!places.length) {
    console.log('No matching places returned. Try a more specific area or category.')
  } else {
    for (const place of places) console.log(`  ${place.displayName.text} — ${place.formattedAddress ?? 'Address unavailable'}`)
    console.log(args['dry-run']
      ? 'Dry run: fetched from SerpApi (may use one search credit per request), nothing written to the database.'
      : 'Saved. Refresh the home page to see them. Run npm run enrich -w api to add AI tags and summaries (requires GEMINI_API_KEY).')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
