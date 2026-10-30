import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const env = Object.fromEntries(readFileSync(new URL('../../api/.env', import.meta.url), 'utf8')
  .split('\n').filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('Local Supabase only')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const users = []
async function account(name = 'Kejia Test') {
  const email = `layout-${randomUUID()}@example.com`
  const password = `Local-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name },
  })
  expect(error).toBeNull()
  users.push(data.user.id)
  return { id: data.user.id, email, password, name }
}
async function login(page, user) {
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(user.email)
  await page.getByLabel('Password', { exact: false }).fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  for (const id of users.splice(0)) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull()
})

for (const width of [375, 768, 1280]) {
  test(`navigation, Home grid and Ask composer fit ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toHaveCount(1) // hidden copy must not be keyboard/AT accessible
    await expect(nav.getByRole('link', { name: 'Discover', exact: true })).toHaveAttribute('aria-current', 'page')
    const bar = await nav.boundingBox()
    expect(bar).toBeTruthy()
    if (width < 768) expect(bar.y + bar.height).toBe(900)
    else expect(bar.y + bar.height).toBeLessThan(81)
    const first = page.getByRole('link', { name: 'Odette', exact: true })
    const second = page.getByRole('link', { name: 'Atlas', exact: true })
    await expect(first).toBeVisible()
    const a = await first.boundingBox()
    const b = await second.boundingBox()
    expect(width < 768 ? Math.abs(a.x - b.x) < 2 : b.x > a.x + 100).toBe(true)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), animations: 'disabled' })
    await nav.getByRole('link', { name: 'Ask', exact: true }).click()
    await expect(nav.getByRole('link', { name: 'Ask', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('textbox', { name: 'What are you in the mood for?' })).toBeVisible()
    const form = await page.locator('form').boundingBox()
    expect(Math.abs(form.y + form.height - (width < 768 ? 900 - 64 - 12 : 900 - 12))).toBeLessThanOrEqual(2)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`ask-${width}.png`), animations: 'disabled' })
    await nav.getByRole('link', { name: 'Account', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/profile$/)
    await expect(nav.getByRole('link', { name: 'Account', exact: true })).toHaveAttribute('aria-current', 'page')
    await noOverflow(page)
    // Sign-up form also needs to fit the narrowest viewport.
    await page.getByRole('tab', { name: 'Sign up', exact: true }).click()
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`account-guest-${width}.png`), fullPage: true, animations: 'disabled' })
  })
}

test('resizing switches navigation without losing Ask draft, conversation or active tab', async ({ page }) => {
  await page.route(`${API}/ask`, (route) => route.fulfill({ json: {
    reply: 'Your conversation is kept.', places: [],
    filters: { must_tags: [], want_tags: [] },
  } }))
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/ask')
  const composer = page.getByRole('textbox', { name: 'What are you in the mood for?' })
  await composer.fill('Find cafes')
  await composer.press('Enter')
  await expect(page.getByText('Your conversation is kept.')).toBeVisible()
  await composer.fill('My unfinished follow-up')
  for (const width of [768, 1280, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('navigation')).toHaveCount(1)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Ask', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(composer).toHaveValue('My unfinished follow-up')
    await expect(page.getByText('Your conversation is kept.')).toBeVisible()
    await noOverflow(page)
  }
})

test('Account profile, preferences, compact saved list and logout work at all target widths', async ({ page }, info) => {
  const user = await account('Kejia Test with a long display name for narrow screens')
  const tags = ['Cafe', 'Budget', 'Vegetarian Friendly', 'No pork', 'Family Friendly']
  expect((await admin.from('preferences').insert({ user_id: user.id, tags })).error).toBeNull()
  const places = await (await fetch(`${API}/places`)).json()
  expect((await admin.from('saved_places').insert(places.slice(0, 2).map((place) =>
    ({ user_id: user.id, place_id: place.id })))).error).toBeNull()
  await login(page, user)
  const profile = page.getByRole('region', { name: 'Your profile' })
  const prefs = page.getByRole('region', { name: 'My preferences' })
  const saved = page.getByRole('region', { name: 'Saved places (2)' })
  await expect(profile.getByRole('heading', { name: user.name, exact: true })).toBeVisible()
  await expect(profile.getByText(user.email, { exact: true })).toBeVisible()
  await expect(saved.getByRole('listitem')).toHaveCount(2)
  for (const tag of tags) await expect(prefs.getByText(tag, { exact: true })).toBeVisible()
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await noOverflow(page)
    const boxes = await page.locator('[aria-label="Your profile"], [aria-labelledby="preferences-heading"], [aria-labelledby="saved-heading"]').evaluateAll((nodes) =>
      nodes.map((node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width } }))
    expect(new Set(boxes.map(({ x }) => x)).size).toBe(1)
    expect(boxes[0].y < boxes[1].y && boxes[1].y < boxes[2].y).toBe(true)
    expect(Math.abs(boxes[0].x + boxes[0].width / 2 - width / 2)).toBeLessThan(2)
    await page.screenshot({ path: info.outputPath(`account-saved-${width}.png`), fullPage: true, animations: 'disabled' })
  }
  await prefs.getByRole('link', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cafes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Account', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  // Preserve link behavior: the heart removes, the name opens the place.
  await saved.getByRole('button', { name: `Unsave ${places[0].name}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved places (1)', exact: true })).toBeVisible()
  await page.getByRole('link', { name: places[1].name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/places/${places[1].id}$`))
  await page.getByRole('navigation').getByRole('link', { name: 'Account', exact: true }).click()
  await page.getByRole('button', { name: `Unsave ${places[1].name}`, exact: true }).click()
  await expect(page.getByText('Your next favourite is out there.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saved places (0)', exact: true })).toBeVisible()
  const logout = page.getByRole('button', { name: 'Log out', exact: true })
  const header = page.getByRole('heading', { name: 'Saved places (0)', exact: true })
  expect((await logout.boundingBox()).y).toBeGreaterThan((await header.boundingBox()).y)
  await logout.click()
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  await expect(page.getByText('You have logged out.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your profile' })).toHaveCount(0)
  await expect(page.getByText(user.email, { exact: true })).toHaveCount(0)
})

test('Account errors are local to each section, recover on Retry, and logout failure stays visible', async ({ page }) => {
  const user = await account('')
  for (const endpoint of ['/me', '/me/preferences', '/me/saved-places']) {
    await page.route(`${API}${endpoint}`, (route) => route.fulfill({ status: 500, json: { error: 'Test error' } }))
  }
  await login(page, user)
  await expect(page.getByRole('button', { name: 'Retry account', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry preferences', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry saved places', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Singapore explorer', exact: true })).toBeVisible()
  await page.unrouteAll({ behavior: 'wait' })
  for (const name of ['Retry account', 'Retry preferences', 'Retry saved places']) await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Take survey', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toBeVisible()
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 400, json: { message: 'Test failure' } }))
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('the server could not confirm logout')
  await expect(page.getByRole('region', { name: 'Your profile' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled()
  await page.unroute('**/auth/v1/logout*')
  await login(page, user)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  await expect(page.getByText('You have logged out.', { exact: true })).toBeVisible()
})

test('Account loading states never show a false empty list, and logout remains usable', async ({ page }) => {
  const user = await account()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  for (const endpoint of ['/me', '/me/preferences', '/me/saved-places']) {
    await page.route(`${API}${endpoint}`, async (route) => { await gate; await route.continue() })
  }
  await login(page, user)
  await expect(page.getByText('Loading your account…')).toBeVisible()
  await expect(page.getByText('Loading preferences…')).toBeVisible()
  await expect(page.getByText('Loading saved places…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saved places (0)' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeEnabled()
  release()
  await expect(page.getByText('Your next favourite is out there.')).toBeVisible()
  await expect(page.getByText('Loading your account…')).toHaveCount(0)
})
