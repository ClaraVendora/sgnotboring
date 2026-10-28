import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import askRoutes from './ask.js'

const at = new Date('2026-10-28T12:00:00+08:00')
const vocabulary = async () => [{ name: 'Cafe', facet: 'type' }, { name: 'Tiong Bahru', facet: 'area' }]
const interpreted = { intent: 'cafe', must_tags: [], want_tags: ['Cafe'], count: 3, off_topic: false, open_now: false, reply: '' }

test('all required open-now phrases apply a hard constraint at request time before ranking', async (t) => {
  const app = Fastify()
  t.after(() => app.close())
  await app.register(askRoutes, {
    vocabulary, clock: () => at,
    candidatesFor: async (_must, _want, options) => {
      assert.equal(options.openNow, true)
      assert.equal(options.at, at)
      return [{ id: 'open', name: 'Open Cafe', tags: ['Cafe'] }]
    },
    generate: async ({ input, system }) => {
      if (!system.includes('From the candidate places')) return interpreted
      assert.deepEqual(JSON.parse(input).candidates.map((place) => place.id), ['open'])
      return { reply: 'Here are your picks.', picks: [{ id: 'open', reason: 'Coffee.' }] }
    },
  })
  for (const phrase of ['open now', 'right now', 'still open', 'at this hour', 'open at the moment']) {
    const res = await app.inject({ method: 'POST', url: '/ask', payload: { message: `Cafe ${phrase}` } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().filters.open_now, true)
    assert.match(res.json().reply, /open right now/i)
  }
})

test('no-open-match path returns guidance without ranking or returning closed cards', async (t) => {
  const app = Fastify()
  t.after(() => app.close())
  await app.register(askRoutes, {
    vocabulary, clock: () => at, generate: async () => interpreted,
    candidatesFor: async () => [],
    nextOpeningFor: async () => ({ name: 'Later Cafe', opensAt: new Date('2026-10-28T10:00:00Z') }),
  })
  const res = await app.inject({ method: 'POST', url: '/ask', payload: { message: 'Cafe open now' } })
  assert.deepEqual(res.json().places, [])
  assert.match(res.json().reply, /No matching places are open right now/)
  assert.match(res.json().reply, /Later Cafe next opens/)
})

test('ordinary requests and explicit removal of open-now preserve unrestricted behavior', async (t) => {
  const app = Fastify()
  t.after(() => app.close())
  await app.register(askRoutes, {
    vocabulary, candidatesFor: async (_must, _want, options) => { assert.equal(options.openNow, false); return [] },
    generate: async () => interpreted,
  })
  for (const message of ['Cafe in Tiong Bahru', 'Cafe, any time', 'Cafe, no need to be open now']) {
    const res = await app.inject({ method: 'POST', url: '/ask', payload: { message } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().filters.open_now, false)
  }
})
