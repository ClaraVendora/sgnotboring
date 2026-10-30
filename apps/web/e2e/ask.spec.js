import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

// AI Search recovery (SGN-011), keeping the conversation (SGN-019) and the Personalised
// toggle (SGN-012). /ask is stubbed, so no Gemini quota is used; place details and logins
// use the local API and Supabase.
const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const env = Object.fromEntries(readFileSync(new URL('../../api/.env', import.meta.url), 'utf8')
  .split('\n').filter((line) => /^[A-Z_]+=/.test(line)).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('E2E requires local Supabase')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let users = []
let places = []

test.beforeAll(async () => {
  places = (await (await fetch(`${API}/places`)).json()).slice(0, 9)
})
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  for (const account of users) await admin.auth.admin.deleteUser(account.id)
  users = []
})

async function user() {
  const email = `e2e-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  expect(error).toBeNull()
  const account = { id: data.user.id, email, password }
  users.push(account)
  return account
}
async function login(page, account) {
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(account.email)
  await page.getByLabel('Password', { exact: false }).fill(account.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}
async function logout(page) {
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
}

function answer(text, picks = [], extra = {}) {
  return {
    reply: text,
    places: picks.map((place) => ({ ...place, reason: `Picked for ${place.name}.`, saved: false })),
    filters: { intent: text, must_tags: [], want_tags: [], count: 3, relaxed: false, open_now: false },
    ...extra,
  }
}
// Answers /ask from a queue: a JSON body, { status } for an error, or a function(route).
// Returns the request bodies and Authorization headers, in order.
async function stubAsk(page, ...responses) {
  const requests = []
  await page.route(`${API}/ask`, async (route) => {
    requests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization })
    const next = responses.shift()
    if (typeof next === 'function') return next(route)
    if (next.status) return route.fulfill({ status: next.status, json: { error: 'Stubbed failure' } })
    return route.fulfill({ json: next })
  })
  return requests
}
const composer = (page) => page.getByRole('textbox', { name: 'What are you in the mood for?' })
async function send(page, message) {
  await composer(page).fill(message)
  await composer(page).press('Enter')
}
// Waits for any smooth scrolling to finish, then returns the position.
async function settledScroll(page) {
  let last = -1
  await expect.poll(async () => {
    const y = await page.evaluate(() => window.scrollY)
    const settled = y === last
    last = y
    return settled
  }, { intervals: [150] }).toBe(true)
  return last
}
const newSearch = (page) => page.getByRole('button', { name: 'New search' })
const alert = (page) => page.getByRole('alert')

test('New search appears only with a conversation and returns to the welcome prompts', async ({ page }) => {
  await stubAsk(page, answer('Try these.', places.slice(0, 3)))
  await page.goto('/ask')
  await expect(newSearch(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Halal food near Bugis' }).click()
  await expect(page.getByText('Try these.')).toBeVisible()
  await newSearch(page).click()
  await expect(page.getByText('Try these.')).toHaveCount(0)
  await expect(page.getByText('Halal food near Bugis', { exact: true })).toHaveCount(1) // the prompt chip, not a bubble
  await expect(page.getByRole('button', { name: 'Cheap supper for 6 after midnight' })).toBeVisible()
  await expect(newSearch(page)).toHaveCount(0)
})

test('a failed request keeps the message, explains, and Retry resends it without duplicating it', async ({ page }) => {
  const requests = await stubAsk(page, answer('First reply.'), { status: 500 }, answer('Second reply.', places.slice(0, 1)))
  await page.goto('/ask')
  await send(page, 'cafes in Tiong Bahru')
  await expect(page.getByText('First reply.')).toBeVisible()
  await send(page, 'cheaper ones?')
  await expect(alert(page)).toContainText('Something went wrong')
  await expect(alert(page)).toContainText('Your message is kept')
  await expect(page.getByText('cheaper ones?')).toHaveCount(1)
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('Second reply.')).toBeVisible()
  await expect(alert(page)).toHaveCount(0)
  await expect(page.getByText('cheaper ones?')).toHaveCount(1)
  await expect(page.getByText('First reply.')).toBeVisible()
  expect(requests[2].body).toEqual(requests[1].body)
  expect(requests[1].body.history).toEqual([
    { role: 'user', text: 'cafes in Tiong Bahru' }, { role: 'assistant', text: 'First reply.' },
  ])
})

test('busy and overloaded errors have their own wording, keep the conversation and still offer Retry', async ({ page }) => {
  await stubAsk(page, answer('Earlier reply.'), { status: 429 }, { status: 503 })
  await page.goto('/ask')
  await send(page, 'supper spots')
  await expect(page.getByText('Earlier reply.')).toBeVisible()
  await send(page, 'any in Bugis?')
  await expect(alert(page)).toContainText('AI Search is busy')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(alert(page)).toContainText('The AI is overloaded')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled()
  await expect(page.getByText('Earlier reply.')).toBeVisible()
  await expect(page.getByText('any in Bugis?')).toHaveCount(1)
})

test('a request that takes longer than 20 seconds shows the alert with Retry', async ({ page }) => {
  await page.clock.install()
  await stubAsk(page, () => {}, answer('Got there.'))
  await page.goto('/ask')
  await send(page, 'slow one')
  await expect(page.getByText('Finding places…')).toBeVisible()
  await page.clock.fastForward(19_000)
  await expect(alert(page)).toHaveCount(0)
  await page.clock.fastForward(2_000)
  await expect(alert(page)).toContainText('Something went wrong')
  await expect(page.getByText('slow one')).toHaveCount(1)
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('Got there.')).toBeVisible()
})

test('opening a place and coming back restores the conversation and scroll position', async ({ page }) => {
  await stubAsk(page, answer('One.', places.slice(0, 3)), answer('Two.', places.slice(3, 6)), answer('Three.', places.slice(6, 9)))
  await page.goto('/ask')
  for (const message of ['first', 'second', 'third']) {
    await send(page, message)
    await expect(page.getByText(`${message === 'first' ? 'One' : message === 'second' ? 'Two' : 'Three'}.`)).toBeVisible()
  }
  const card = page.getByRole('link', { name: places[1].name, exact: true })
  for (const goBack of [
    () => page.getByRole('link', { name: '← Back' }).click(),
    () => page.goBack(),
  ]) {
    await settledScroll(page)
    await card.scrollIntoViewIfNeeded()
    const y = await settledScroll(page)
    expect(y).toBeGreaterThan(100)
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/places/${places[1].id}$`))
    // The URL changes before the page does; Back only exists on the detail page.
    await expect(page.getByRole('link', { name: '← Back' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await goBack()
    await expect(page).toHaveURL(/\/ask$/)
    for (const text of ['One.', 'Two.', 'Three.', 'first', 'second', 'third']) await expect(page.getByText(text, { exact: true })).toHaveCount(1)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y)
  }
})

test("the detail page's Back link returns to Home when the place was opened from Home", async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: places[0].name, exact: true }).click()
  await page.getByRole('link', { name: '← Back' }).click()
  await expect(page).toHaveURL(/\/$/)
  // Opened directly (no earlier page in the app), Back still goes Home.
  await page.goto(`/places/${places[0].id}`)
  await page.getByRole('link', { name: '← Back' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('switching tabs keeps the conversation and unsent draft; a pending reply lands in the background; refresh clears', async ({ page }) => {
  let release
  const held = new Promise((resolve) => { release = resolve })
  await stubAsk(page, answer('Kept reply.'), async (route) => {
    await held
    await route.fulfill({ json: answer('Background reply.', places.slice(0, 1)) })
  })
  await page.goto('/ask')
  await send(page, 'kept message')
  await expect(page.getByText('Kept reply.')).toBeVisible()
  await composer(page).fill('half-typed idea')
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(composer(page)).toHaveValue('half-typed idea')
  await expect(page.getByText('Kept reply.')).toBeVisible()

  await send(page, 'slow follow-up')
  await expect(page.getByText('Finding places…')).toBeVisible()
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Places to explore' })).toBeVisible()
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('Background reply.')).toBeVisible()
  await expect(page.getByText('Finding places…')).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Kept reply.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Halal food near Bugis' })).toBeVisible()
})

test('guests see Personalised locked and tapping it goes to log in', async ({ page }) => {
  const requests = await stubAsk(page, answer('Guest reply.'))
  await page.goto('/ask')
  const locked = page.getByRole('link', { name: /Personalised.*Log in to use your saved places and preferences/ })
  await send(page, 'anything')
  await expect(page.getByText('Guest reply.')).toBeVisible()
  expect(requests[0].body).toEqual({ message: 'anything', history: [] })
  await locked.click()
  await expect(page).toHaveURL(/\/profile$/)
})

test('Personalised is off by default, remembered per user, sent with requests, and logging out clears the conversation', async ({ page }) => {
  const [first, second] = [await user(), await user()]
  const requests = await stubAsk(page, answer('Off reply.'), answer('On reply.', [], { personalisation: { status: 'on', leanings: { dietary: [], survey: ['Cafe'], saved: [] } } }))
  await login(page, first)
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('Results are the same as for guests')).toBeVisible()
  await send(page, 'off please')
  await expect(page.getByText('Off reply.')).toBeVisible()
  expect(requests[0].body.personalised).toBeUndefined()
  await page.getByText('Personalised', { exact: true }).click()
  await expect(page.getByText('Using your saved places and survey answers')).toBeVisible()
  await send(page, 'on please')
  await expect(page.getByText('On reply.')).toBeVisible()
  expect(requests[1].body.personalised).toBe(true)
  await expect(page.getByText('Personalised', { exact: true })).toHaveCount(2) // the toggle and the reply's chip

  await page.reload()
  await expect(page.getByText('Using your saved places and survey answers')).toBeVisible()
  await expect(page.getByText('On reply.')).toHaveCount(0) // a refresh starts fresh

  await stubAsk(page, answer('Before logout.'))
  await send(page, 'before logout')
  await expect(page.getByText('Before logout.')).toBeVisible()
  await logout(page)
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('Before logout.')).toHaveCount(0)
  await expect(page.getByText('Log in to use your saved places and preferences')).toBeVisible()

  await login(page, second)
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('Results are the same as for guests')).toBeVisible()
  await logout(page)
  await login(page, first)
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('Using your saved places and survey answers')).toBeVisible()
})

test('an expired login falls back to guest results and says personalisation is off; empty profiles get a hint', async ({ page }) => {
  const account = await user()
  await login(page, account)
  const requests = await stubAsk(page,
    { status: 401 }, answer('Guest results.', [], { personalisation: { status: 'logged_out' } }),
    answer('Normal results.', [], { personalisation: { status: 'empty' } }))
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await page.getByText('Personalised', { exact: true }).click()
  await send(page, 'expired')
  await expect(page.getByText('Guest results.')).toBeVisible()
  expect(requests[0].authorization).toMatch(/^Bearer /)
  expect(requests[1].authorization).toBeUndefined()
  await expect(page.getByText('Personalisation is off because your login has expired.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in again', exact: true })).toHaveAttribute('href', '/profile')
  await expect(page.getByRole('link', { name: /Personalised.*Off: your login has expired/ })).toBeVisible()
  await send(page, 'empty profile')
  await expect(page.getByText('Normal results.')).toBeVisible()
  expect(requests[2].body.personalised).toBe(true) // the setting itself is kept
  await expect(page.getByText('Using your saved places and survey answers')).toBeVisible()
  await expect(page.getByText('Save places you like and Personalised will lean on them in future searches.')).toBeVisible()
})
