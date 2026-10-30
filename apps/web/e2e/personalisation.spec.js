import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../../api/.env', import.meta.url), 'utf8')
  .split('\n').filter((line) => /^[A-Z_]+=/.test(line)).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('E2E requires local Supabase')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let users = []
let mailIds = []

async function user() {
  const email = `e2e-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  expect(error).toBeNull()
  const result = { id: data.user.id, email, password }
  users.push(result)
  return result
}
async function login(page, account) {
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(account.email)
  await page.getByLabel('Password', { exact: false }).fill(account.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await expect(page.getByText('Loading saved places…')).toHaveCount(0)
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
test.afterEach(async () => {
  for (const account of users) await admin.auth.admin.deleteUser(account.id)
  users = []
  if (mailIds.length) await fetch('http://127.0.0.1:54324/api/v1/messages', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: mailIds }),
  })
  mailIds = []
})

test('guest heart prompts login, does not navigate or persist saves', async ({ page }) => {
  await page.goto('/')
  const heart = page.getByRole('button', { name: 'Save Odette', exact: true })
  await expect(heart).toBeEnabled()
  await heart.click()
  await expect(page).toHaveURL('http://localhost:3000/')
  await expect(page.getByText('Log in to save places and find them here later.')).toBeVisible()
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
  await page.getByRole('link', { name: 'Odette', exact: true }).click()
  await expect(page).toHaveURL(/\/places\//)
  await expect(page.getByRole('button', { name: 'Save Odette', exact: true })).toBeVisible()
  await noOverflow(page)
})

test('email signup opens four-question survey; Skip, Finish and prefilled Edit persist correctly', async ({ page }, info) => {
  const email = `signup-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  await page.goto('/profile')
  await page.getByRole('tab', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Display name (optional)').fill('Taste explorer')
  await page.getByLabel('Email', { exact: false }).fill(email)
  await page.getByLabel('Password', { exact: false }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText(/Check your email for a confirmation link/)).toBeVisible()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const account = data.users.find((item) => item.email === email)
  expect(account).toBeTruthy()
  users.push(account)
  let message
  await expect.poll(async () => {
    const inbox = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json()
    message = inbox.messages.find((item) => item.To.some((to) => to.Address === email))
    return Boolean(message)
  }).toBe(true)
  mailIds.push(message.ID)
  const contents = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json()
  const link = contents.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll('&amp;', '&')
  expect(new URL(link).origin).toBe(env.SUPABASE_URL)
  await page.goto(link)
  await expect(page).toHaveURL('http://localhost:3000/onboarding')
  await expect(page.locator('fieldset')).toHaveCount(4)
  await page.getByRole('button', { name: 'Cafes', exact: true }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My preferences' })).toBeVisible()
  expect((await admin.from('preferences').select('*').eq('user_id', account.id)).data).toEqual([])
  await page.getByRole('link', { name: 'Take survey', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cafes', exact: true })).toHaveAttribute('aria-pressed', 'false')
  for (const name of ['Cafes', 'Budget · up to S$15', 'No pork', 'Family']) {
    await page.getByRole('button', { name, exact: true }).click()
  }
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('survey-mobile.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByText('Family Friendly', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('No pork', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  for (const name of ['Cafes', 'Budget · up to S$15', 'No pork', 'Family']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  const splurge = page.getByRole('button', { name: 'Splurge · S$40+', exact: true })
  await splurge.focus()
  await page.keyboard.press('Space')
  await expect(splurge).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Budget · up to S$15', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.route('**/me/preferences', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 500, json: { error: 'Test failure' } })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your choices are still here')
  await expect(splurge).toHaveAttribute('aria-pressed', 'true')
  await page.unroute('**/me/preferences')
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByText('Splurge', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('account-mobile.png'), fullPage: true, animations: 'disabled' })
  expect((await admin.from('preferences').select('tags').eq('user_id', account.id).single()).data.tags)
    .toEqual(['Cafe', 'No pork', 'Family Friendly', 'Splurge'])
  await noOverflow(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await noOverflow(page)
})

test('optimistic hearts, rapid taps, failed save/remove rollback and reload', async ({ page }) => {
  const account = await user()
  await login(page, account)
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toBeVisible()
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  let release
  let requests = 0
  const gate = new Promise((resolve) => { release = resolve })
  await page.route('**/me/saved-places/*', async (route) => {
    requests++
    await gate
    await route.continue()
  })
  const heart = page.getByRole('button', { name: 'Save Odette', exact: true })
  await heart.click()
  const unsave = page.getByRole('button', { name: 'Unsave Odette', exact: true })
  await expect(unsave).toHaveAttribute('aria-pressed', 'true')
  await expect(unsave).toBeDisabled()
  await unsave.click({ force: true }) // a second physical click cannot issue another write
  expect(requests).toBe(1)
  release()
  await expect(unsave).toBeEnabled()
  await page.unroute('**/me/saved-places/*')
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved places (1)' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeEnabled()

  await page.route('**/me/saved-places/*', (route) => route.fulfill({ status: 500, json: { error: 'Test failure' } }))
  await page.getByRole('button', { name: 'Unsave Odette', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your change was undone')
  await expect(page.getByRole('heading', { name: 'Saved places (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeEnabled()
  await page.unroute('**/me/saved-places/*')
  await page.getByRole('link', { name: 'Odette', exact: true }).click()
  await page.getByRole('button', { name: 'Unsave Odette', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save Odette', exact: true })).toBeEnabled()
  await page.route('**/me/saved-places/*', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Save Odette', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your change was undone')
  await expect(page.getByRole('button', { name: 'Save Odette', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.unroute('**/me/saved-places/*')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Save Odette', exact: true })).toBeEnabled()
  expect((await admin.from('saved_places').select('*').eq('user_id', account.id)).data).toEqual([])
  // Unintercepted browser writes also exercise the real CORS preflight.
  await page.getByRole('button', { name: 'Save Odette', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeEnabled()
})

test('account switch ignores an old pending save response and AI cards share heart state', async ({ page }) => {
  const a = await user()
  const b = await user()
  await login(page, a)
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route('**/me/saved-places/*', async (route) => {
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Save Odette', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  // Stay in the SPA so the old response is still pending during the account switch.
  await page.getByLabel('Email', { exact: false }).fill(b.email)
  await page.getByLabel('Password', { exact: false }).fill(b.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toBeVisible()
  release()
  await page.unrouteAll({ behavior: 'wait' })
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Odette', exact: true })).toHaveCount(0)
  const { data: place } = await admin.from('places').select('*').eq('name', 'Odette').single()
  // Stub only the unrelated Gemini response; auth and saves still use real API/DB.
  await page.route('**/ask', (route) => route.fulfill({ json: {
    reply: 'Try Odette', places: [{ ...place, reason: 'A place to try', saved: false }],
    filters: { must_tags: [], want_tags: [] },
  } }))
  await page.getByRole('link', { name: 'Ask', exact: true }).click()
  await page.getByRole('button', { name: 'Cheap supper for 6 after midnight', exact: true }).click()
  await page.getByRole('button', { name: 'Save Odette', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved places (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unsave Odette', exact: true })).toBeVisible()
})

async function authKey(page) {
  return page.evaluate(() => Object.keys(localStorage).find((key) => key.endsWith('-auth-token')))
}

test('a rejected login token falls back to guest browsing instead of failing Home and detail', async ({ page }) => {
  await login(page, await user())
  // A revoked token the SDK still considers unexpired: the API rejects it with 401.
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify({ ...session, access_token: 'revoked', expires_at: Math.floor(Date.now() / 1000) + 3000 }))
  }, await authKey(page))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Odette', exact: true })).toBeVisible()
  await expect(page.getByText("Couldn't load places")).toHaveCount(0)
  await page.getByRole('link', { name: 'Odette', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Odette', exact: true })).toBeVisible()
})

test('a routine token refresh keeps unsaved survey answers and saved places', async ({ page }) => {
  test.setTimeout(120000)
  let savedListLoads = 0
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().endsWith('/me/saved-places')) savedListLoads++
  })
  await login(page, await user())
  await page.goto('/onboarding')
  await page.getByRole('button', { name: 'Hawker food', exact: true }).click()
  await page.getByRole('button', { name: 'Cafes', exact: true }).click()
  const loadsBefore = savedListLoads
  const key = await authKey(page)
  const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).access_token, key)
  // Near expiry, the SDK's auto-refresh tick (every 30s) rotates the token.
  await page.evaluate((k) => {
    const session = JSON.parse(localStorage.getItem(k))
    localStorage.setItem(k, JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + 20 }))
  }, key)
  await page.waitForFunction(([k, token]) => JSON.parse(localStorage.getItem(k)).access_token !== token, [key, before], { timeout: 75000 })
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(2)
  expect(savedListLoads).toBe(loadsBefore)
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText('Hawker', { exact: true })).toBeVisible()
})

test('auth callback opens the survey only for users without preferences', async ({ page }) => {
  const returning = await user()
  expect((await admin.from('preferences').insert({ user_id: returning.id, tags: ['Cafe'] })).error).toBeNull()
  await login(page, returning)
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/profile$/)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await login(page, await user())
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/onboarding$/)
})
