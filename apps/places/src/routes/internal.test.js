import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import internalRoutes from './internal.js'

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`

async function setup(t) {
  const calls = []
  const app = Fastify()
  await app.register(internalRoutes, {
    places: { lookup: async (ids, view) => { calls.push(['lookup', ids, view]); return ids.filter((id) => id !== uuid(9)).map((id) => ({ id })) } },
    vocabulary: async () => [{ name: 'Cafe', facet: 'type', description: 'Coffee' }],
    searchCandidates: async (must, want, options) => { calls.push(['search', must, want, options]); return [{ id: uuid(1) }] },
    findNextOpening: async (must, want, at) => { calls.push(['next', must, want, at]); return { name: 'Atlas', opensAt: new Date('2026-11-10T10:00:00Z') } },
  })
  t.after(() => app.close())
  return { app, calls }
}

test('vocabulary is served as { tags }', async (t) => {
  const { app } = await setup(t)
  assert.deepEqual((await app.inject('/internal/vocabulary')).json(), { tags: [{ name: 'Cafe', facet: 'type', description: 'Coffee' }] })
})

test('search passes tags, open-now, time and tastes through', async (t) => {
  const { app, calls } = await setup(t)
  const at = '2026-11-10T14:00:00.000Z'
  const res = await app.inject({ method: 'POST', url: '/internal/search',
    payload: { must: ['Budget'], want: ['Cafe'], openNow: true, at, prefer: ['Chill'] } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { places: [{ id: uuid(1) }] })
  const [, must, want, options] = calls[0]
  assert.deepEqual([must, want, options.openNow, options.prefer], [['Budget'], ['Cafe'], true, ['Chill']])
  assert.equal(options.at.toISOString(), at)
  assert.equal((await app.inject({ method: 'POST', url: '/internal/search', payload: { must: 'Budget' } })).statusCode, 400)
})

test('next-opening returns an ISO time', async (t) => {
  const { app } = await setup(t)
  const res = await app.inject({ method: 'POST', url: '/internal/next-opening',
    payload: { must: [], want: ['Cafe'], at: '2026-11-10T02:00:00.000Z' } })
  assert.deepEqual(res.json(), { next: { name: 'Atlas', opensAt: '2026-11-10T10:00:00.000Z' } })
})

test('lookup keeps known ids, defaults to card view and validates ids', async (t) => {
  const { app, calls } = await setup(t)
  const res = await app.inject({ method: 'POST', url: '/internal/places/lookup', payload: { ids: [uuid(2), uuid(9)] } })
  assert.deepEqual(res.json(), { places: [{ id: uuid(2) }] })
  assert.equal(calls[0][2], 'card')
  for (const payload of [{ ids: ['nope'] }, { ids: [uuid(1)], view: 'secret' }, {}]) {
    assert.equal((await app.inject({ method: 'POST', url: '/internal/places/lookup', payload })).statusCode, 400)
  }
})
