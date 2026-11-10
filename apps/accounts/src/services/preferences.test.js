import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { surveyTags } from './preferences.js'

// The database trigger keeps its own copy of the survey answers; the two must not drift.
test('survey tags match the accounts.validate_preference_tags list', () => {
  const dir = new URL('../../../../supabase/migrations/', import.meta.url)
  const latest = readdirSync(dir).filter((file) => readFileSync(new URL(file, dir), 'utf8')
    .includes('function accounts.validate_preference_tags')).sort().at(-1)
  const sql = readFileSync(new URL(latest, dir), 'utf8')
  const list = /new\.tags <@ array\[([^\]]+)\]/.exec(sql)[1]
  assert.deepEqual([...list.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort(), [...surveyTags].sort())
})
