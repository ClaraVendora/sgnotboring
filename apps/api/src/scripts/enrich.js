// LLM tagging job. Every insert into raw_places starts as enrich_status = 'pending'; this
// drains that queue in batches (one Gemini call per batch), writes tags + summary to places,
// and marks the raw row done. Run it after loading data.
//
//   npm run enrich -w api                       # tag everything pending, then exit
//   npm run enrich -w api -- --retag            # re-queue every place first (vocabulary changed)
//   npm run enrich -w api -- --dry-run          # call Gemini and print, write nothing
//   npm run enrich -w api -- --watch            # keep polling for new rows
//   npm run enrich -w api -- --limit 10 --batch 5
//
// Against a hosted project (from apps/api):
//   node --env-file=.env.staging.local src/scripts/enrich.js
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { supabase } from '../services/supabase.js'
import { generateJson, RateLimitError, MODEL } from '../services/llm.js'
import { getTagVocabulary } from '../services/tags.js'
import { RULE_TAGS, ruleTags, taggingSchema, taggingSystemPrompt, toTaggingInput } from '../prompts/tagging.js'

const { values: args } = parseArgs({
  options: {
    retag: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    watch: { type: 'boolean', default: false },
    limit: { type: 'string' },
    batch: { type: 'string', default: '10' },
  },
})
const DRY_RUN = args['dry-run']
const BATCH = Number(args.batch)
const LIMIT = args.limit ? Number(args.limit) : Infinity
const MAX_ATTEMPTS = 3
const PAUSE_MS = 4_000 // between calls, to stay under the free tier's requests-per-minute
const POLL_MS = 30_000 // --watch

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function nextBatch(size, offset) {
  const { data, error } = await supabase
    .from('raw_places')
    .select('google_place_id, payload, enrich_attempts')
    .or(`enrich_status.eq.pending,and(enrich_status.eq.failed,enrich_attempts.lt.${MAX_ATTEMPTS})`)
    .order('fetched_at')
    .range(offset, offset + size - 1)
  if (error) throw new Error(error.message)
  return data
}

async function markFailed(row, message) {
  console.error(`  ✗ ${row.google_place_id}: ${message}`)
  if (DRY_RUN) return
  await supabase
    .from('raw_places')
    .update({ enrich_status: 'failed', enrich_attempts: row.enrich_attempts + 1, enrich_error: message })
    .eq('google_place_id', row.google_place_id)
}

// One Gemini call with a generous deadline (a batch of 10 can take 30s+). Retries once:
// after 60s on 429 (per-minute window; a second 429 means the daily quota is gone), or
// after 5s on a Gemini 5xx.
async function tagWithRetry(request) {
  const call = () => generateJson({ ...request, temperature: 0, timeoutMs: 120_000 })
  try {
    return await call()
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn('  rate limited, waiting 60s…')
      await sleep(60_000)
    } else if (err.status >= 500) {
      console.warn(`  Gemini ${err.status}, retrying in 5s…`)
      await sleep(5_000)
    } else {
      throw err
    }
    return call()
  }
}

async function processBatch(rows, vocab) {
  const known = new Set(vocab.map((t) => t.name))
  const llmTags = vocab.filter((t) => !RULE_TAGS.has(t.name))
  const ids = rows.map((r) => r.google_place_id)

  const out = await tagWithRetry({
    system: taggingSystemPrompt(llmTags),
    input: JSON.stringify(rows.map((r) => toTaggingInput(r.google_place_id, r.payload))),
    schema: taggingSchema(ids, llmTags.map((t) => t.name)),
  })
  const results = new Map(out.places.map((p) => [p.id, p]))

  for (const row of rows) {
    const result = results.get(row.google_place_id)
    if (!result) {
      await markFailed(row, 'missing from model output')
      continue
    }
    const tags = [...new Set([...result.tags, ...ruleTags(row.payload)])].filter((t) => known.has(t))
    console.log(`  ✓ ${row.payload.displayName?.text}: ${tags.join(', ')}\n    “${result.summary}”`)
    if (DRY_RUN) continue

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('places')
      .update({ tags, summary: result.summary, enriched_at: now })
      .eq('google_place_id', row.google_place_id)
    if (error) {
      await markFailed(row, error.message)
      continue
    }
    await supabase
      .from('raw_places')
      .update({ enrich_status: 'done', enriched_at: now, enrich_error: null })
      .eq('google_place_id', row.google_place_id)
  }
}

if (args.retag && !DRY_RUN) {
  const { error } = await supabase
    .from('raw_places')
    .update({ enrich_status: 'pending', enrich_attempts: 0, enrich_error: null })
    .neq('enrich_status', 'pending')
  if (error) throw new Error(error.message)
  console.log('Re-queued all places for tagging.')
}

console.log(`Tagging with ${MODEL}${DRY_RUN ? ' (dry run, nothing is written)' : ''}`)
let processed = 0
while (processed < LIMIT) {
  // A dry run writes nothing, so it pages with an offset instead of re-reading the queue head.
  const rows = await nextBatch(Math.min(BATCH, LIMIT - processed), DRY_RUN ? processed : 0)
  if (!rows.length) {
    if (!args.watch) break
    await sleep(POLL_MS)
    continue
  }

  console.log(`Batch of ${rows.length}:`)
  try {
    await processBatch(rows, await getTagVocabulary())
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error('Gemini quota exhausted; the rest stays pending. Run again later.')
      break
    }
    for (const row of rows) await markFailed(row, err.message)
  }
  processed += rows.length
  await sleep(PAUSE_MS)
}
console.log(`Done: ${processed} place(s) processed.`)
