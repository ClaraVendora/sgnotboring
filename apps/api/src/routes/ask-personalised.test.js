import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import askRoutes from './ask.js'

const vocabulary = async () => [
  { name: 'Cafe', facet: 'type' }, { name: 'Bar', facet: 'type' }, { name: 'Budget', facet: 'budget' }, { name: 'Mid-Range', facet: 'budget' },
  { name: 'Halal', facet: 'dietary' }, { name: 'Late Night', facet: 'time' }, { name: 'Chill', facet: 'vibe' },
  { name: 'Tiong Bahru', facet: 'area' },
]
const user = { id: 'user-a-id', email: 'a@example.com', role: 'authenticated', email_confirmed_at: '2026-01-01' }
const verifyUser = async (token) => (token === 'token-a' ? user : null)
const supper = { intent: 'supper', must_tags: ['Late Night'], want_tags: [], count: 3, off_topic: false, open_now: false, reply: '' }
const place = { id: 'p1', name: 'Supper Spot', tags: ['Late Night', 'Halal', 'Cafe', 'Budget', 'Chill', 'Bar'] }

// survey: preference tags or null; savedTags: tag lists of saved places.
async function setup(t, { survey = null, savedTags = [], interpret = supper, rankReply = 'Here you go.', failTaste = false, placeTags = place.tags } = {}) {
  const calls = { generate: [], candidates: [] }
  const app = Fastify()
  t.after(() => app.close())
  await app.register(askRoutes, {
    vocabulary, verifyUser, clock: () => new Date('2026-10-28T23:30:00+08:00'),
    preferences: { get: async () => { if (failTaste) throw new Error('db down'); return survey && { tags: survey } } },
    savedPlaces: { tags: async () => savedTags, annotate: async (places) => places.map((p) => ({ ...p, saved: false })) },
    candidatesFor: async (must, want, options) => { calls.candidates.push({ must, want, options }); return [{ ...place, tags: placeTags }] },
    generate: async (request) => {
      calls.generate.push(request)
      return request.system.includes('From the candidate places')
        ? { reply: rankReply, picks: [{ id: 'p1', reason: 'Open late.' }] } : interpret
    },
  })
  const ask = async (payload, token) => (await app.inject({
    method: 'POST', url: '/ask', payload: { message: 'supper', ...payload },
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })).json()
  return { ask, calls }
}
const taste = { survey: ['Cafe', 'Budget', 'Halal'], savedTags: [['Chill', 'Cafe', 'Tiong Bahru'], ['Chill', 'Bar']] }
const asSearch = ({ generate, candidates }) => JSON.stringify({ generate, candidates })

test('toggle off, guests and expired logins get exactly the guest search', async (t) => {
  const guest = await setup(t, taste)
  const guestBody = await guest.ask({})
  for (const [payload, token] of [[{}, 'token-a'], [{ personalised: false }, 'token-a'], [{ personalised: true }, null]]) {
    const run = await setup(t, taste)
    const body = await run.ask(payload, token)
    assert.equal(asSearch(run.calls), asSearch(guest.calls))
    assert.deepEqual(body.places, guestBody.places)
    assert.deepEqual(body.personalisation, payload.personalised ? { status: 'logged_out' } : undefined)
  }
  // Without leanings the ranking prompt says nothing about tastes, so none get invented.
  assert.doesNotMatch(guest.calls.generate[1].system, /leaning/i)
})

test('personalised: survey dietary needs become requirements and tastes only break ties, with tags alone sent to the model', async (t) => {
  const { ask, calls } = await setup(t, taste)
  const body = await ask({ personalised: true }, 'token-a')
  assert.deepEqual(calls.candidates[0].must, ['Late Night', 'Halal'])
  // The message's Late Night wins; Cafe/Budget from the survey and the most common saved tags only break ties.
  assert.deepEqual(calls.candidates[0].options.prefer, ['Cafe', 'Budget', 'Chill', 'Bar'])
  assert.deepEqual(body.filters.must_tags, ['Late Night', 'Halal'])
  assert.deepEqual(body.personalisation, {
    status: 'on', leanings: { dietary: ['Halal'], survey: ['Cafe', 'Budget'], saved: ['Chill', 'Bar'] },
  })
  assert.equal(calls.generate.length, 2)
  const sent = JSON.stringify(calls.generate)
  for (const secret of [user.id, user.email, 'token-a']) assert.ok(!sent.includes(secret), secret)
  assert.match(calls.generate[0].system, /saved dietary needs are Halal/)
  assert.match(calls.generate[1].system, /`leanings` are this user's usual tastes/)
  assert.deepEqual(JSON.parse(calls.generate[1].input).leanings,
    { dietary_needs: ['Halal'], usual: ['Cafe', 'Budget'], like_saved_places: ['Chill', 'Bar'] })
  // The server, not the model, says what it leaned on: only tastes the user gave.
  assert.equal(body.reply, 'Here you go. Leaning on your survey (halal, cafes, under S$15) and your saved places (chill, bars).')
  const savedOnly = await setup(t, { savedTags: [['Bar', 'Late Night']] })
  assert.equal((await savedOnly.ask({ personalised: true }, 'token-a')).reply, 'Here you go. Leaning on your saved places (bars).')
  // Only tastes the picks reflect are named; none at all, no sentence.
  const partly = await setup(t, { ...taste, placeTags: ['Late Night', 'Halal', 'Chill'] })
  assert.equal((await partly.ask({ personalised: true }, 'token-a')).reply, 'Here you go. Leaning on your survey (halal) and your saved places (chill).')
  const unmoved = await setup(t, { ...taste, survey: ['Cafe', 'Budget'], placeTags: ['Late Night'] })
  assert.equal((await unmoved.ask({ personalised: true }, 'token-a')).reply, 'Here you go.')
})

test('what the message asks for beats a taste in the same facet, and a clear opt-out lifts dietary needs', async (t) => {
  const bar = await setup(t, { ...taste, interpret: { ...supper, want_tags: ['Bar'] } })
  await bar.ask({ personalised: true }, 'token-a')
  assert.deepEqual(bar.calls.candidates[0].options.prefer, ['Budget', 'Chill'])
  // The survey's budget beats a different budget common among saved places.
  const budgets = await setup(t, { ...taste, savedTags: [['Mid-Range', 'Chill'], ['Mid-Range', 'Chill']] })
  await budgets.ask({ personalised: true }, 'token-a')
  assert.deepEqual(budgets.calls.candidates[0].options.prefer, ['Cafe', 'Budget', 'Chill'])
  const optOut = await setup(t, { ...taste, interpret: { ...supper, skip_saved_dietary: true } })
  const body = await optOut.ask({ personalised: true }, 'token-a')
  assert.deepEqual(optOut.calls.candidates[0].must, ['Late Night'])
  assert.deepEqual(body.personalisation.leanings.dietary, [])
  // Without saved dietary needs the model is not asked about them at all.
  const noDiet = await setup(t, { survey: ['Cafe'] })
  await noDiet.ask({ personalised: true }, 'token-a')
  assert.ok(!('skip_saved_dietary' in noDiet.calls.generate[0].schema.properties))
})

test('no survey answers and no saved places, or a failed lookup, give guest results with a status', async (t) => {
  const guest = await setup(t)
  await guest.ask({})
  for (const [options, status] of [[{}, 'empty'], [{ ...taste, failTaste: true }, 'unavailable']]) {
    const run = await setup(t, options)
    const body = await run.ask({ personalised: true }, 'token-a')
    assert.deepEqual(body.personalisation, { status })
    assert.equal(asSearch(run.calls), asSearch(guest.calls))
    assert.equal(body.places.length, 1)
  }
})
