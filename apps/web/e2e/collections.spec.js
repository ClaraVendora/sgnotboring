import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const env = dotenv.parse(readFileSync(new URL('../../places/.env', import.meta.url)))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('Local Supabase only')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const users = []
let places

test.beforeAll(async () => {
  const { data, error } = await admin.schema('catalog').from('places').select('*').limit(2)
  expect(error).toBeNull()
  places = data
})
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const results = await Promise.all(users.splice(0).map((user) => admin.auth.admin.deleteUser(user.id)))
  expect(results.every(({ error }) => !error)).toBe(true)
})
async function account() {
  const email = `collections-ui-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  expect(error).toBeNull()
  const user = { id: data.user.id, email, password }
  users.push(user)
  return user
}
async function login(page, user) {
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(user.email)
  await page.getByLabel('Password', { exact: false }).fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}
async function create(page, name) {
  const card = page.getByRole('region', { name: 'Collections', exact: true })
  await card.getByRole('button', { name: 'New collection' }).click()
  await card.getByLabel('Collection name').fill(name)
  await card.getByRole('button', { name: 'Create collection' }).click()
  await card.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}
// Mimics GET /places: Home's paged list (?limit=) gets { places, total }, search gets the plain array.
async function stubPlaces(page) {
  await page.route(`${API}/places?*`, (route) => {
    const paged = new URL(route.request().url()).searchParams.has('limit')
    return route.fulfill({ json: paged ? { places, total: places.length } : places })
  })
}
async function stubSearch(page) {
  await stubPlaces(page)
  await page.getByRole('button', { name: 'Add places', exact: true }).click()
}

test('Profile collections support persistent places, owner controls and public view-only sharing', async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page, await account())
  const card = page.getByRole('region', { name: 'Collections', exact: true })
  const saved = page.getByRole('heading', { name: /^Saved places/ })
  expect((await card.boundingBox()).y).toBeLessThan((await saved.boundingBox()).y)
  await create(page, 'Weekend cafes')
  await stubSearch(page)
  for (const place of places) {
    await page.getByRole('button', { name: `Add ${place.name} to collection`, exact: true }).click()
    await expect(page.getByRole('button', { name: `${place.name} is in collection`, exact: true })).toBeDisabled()
  }
  const ownerUrl = page.url()
  const id = new URL(ownerUrl).pathname.split('/').pop()
  const { data } = await admin.schema('community').from('collections').select('share_token').eq('id', id).single()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Places in collection' }).locator('li')).toHaveCount(2)
  const context = await browser.newContext()
  try {
    const guest = await context.newPage()
    await guest.goto(`${new URL(ownerUrl).origin}/collections/shared/${data.share_token}`)
    await expect(guest.getByRole('heading', { name: 'Collection not found' })).toBeVisible()
    await page.getByRole('button', { name: 'Share collection', exact: true }).click()
    const link = page.getByRole('textbox', { name: 'Collection share link' })
    await expect(link).toBeVisible()
    const shareUrl = await link.inputValue()
    await guest.goto(shareUrl)
    await expect(guest.getByRole('heading', { name: 'Weekend cafes', exact: true })).toBeVisible()
    await expect(guest.getByRole('list', { name: 'Places in collection' }).locator('li')).toHaveCount(2)
    await expect(guest.getByRole('button', { name: /Remove .+ from collection/ })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Add places', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: `Remove ${places[0].name} from collection`, exact: true }).click()
    await expect(page.getByRole('list', { name: 'Places in collection' }).locator('li')).toHaveCount(1)
    await guest.reload()
    await expect(guest.getByRole('list', { name: 'Places in collection' }).locator('li')).toHaveCount(1)
    await login(guest, await account())
    await guest.goto(ownerUrl)
    await expect(guest.getByRole('heading', { name: 'Collection not found' })).toBeVisible()
    await guest.goto(shareUrl)
    await expect(guest.getByRole('heading', { name: 'Weekend cafes', exact: true })).toBeVisible()
    await expect(guest.getByRole('button', { name: /Remove .+ from collection/ })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } finally { await context.close() }
})

test('failed creation and place changes preserve the name and membership for retry', async ({ page }) => {
  await login(page, await account())
  const card = page.getByRole('region', { name: 'Collections', exact: true })
  await page.route(`${API}/collections`, (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, json: { error: 'Unavailable' } }) : route.continue())
  await card.getByRole('button', { name: 'New collection' }).click()
  await card.getByLabel('Collection name').fill('Retry collection')
  await card.getByRole('button', { name: 'Create collection' }).click()
  await expect(card.getByRole('alert')).toContainText('Could not create')
  await expect(card.getByLabel('Collection name')).toHaveValue('Retry collection')
  await page.unroute(`${API}/collections`)
  await card.getByRole('button', { name: 'Create collection' }).click()
  await card.getByRole('link', { name: 'Retry collection', exact: true }).click()
  await stubSearch(page)
  const id = new URL(page.url()).pathname.split('/').pop()
  const path = `${API}/collections/${id}/places/${places[0].id}`
  await page.route(path, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  const add = page.getByRole('button', { name: `Add ${places[0].name} to collection`, exact: true })
  await add.click()
  await expect(page.getByRole('alert')).toContainText('Could not add')
  await expect(page.getByRole('list', { name: 'Places in collection' })).toHaveCount(0)
  await page.unroute(path)
  await add.click()
  const members = page.getByRole('list', { name: 'Places in collection' })
  await expect(members.locator('li')).toHaveCount(1)
  await page.route(path, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  const remove = page.getByRole('button', { name: `Remove ${places[0].name} from collection`, exact: true })
  await remove.click()
  await expect(page.getByRole('alert')).toContainText('Could not remove')
  await expect(members.locator('li')).toHaveCount(1)
  await page.unroute(path)
  await remove.click()
  await expect(page.getByText('No places in this collection yet.')).toBeVisible()
})

test('Discover saves into chosen collections and Profile shows horizontal tiles', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const user = await account()
  await login(page, user)
  const card = page.getByRole('region', { name: 'Collections', exact: true })
  for (const name of ['Weekend cafes', 'Dinner ideas', 'Friends night out']) {
    await card.getByRole('button', { name: 'New collection' }).click()
    await card.getByLabel('Collection name').fill(name)
    await card.getByRole('button', { name: 'Create collection' }).click()
    await expect(card.getByRole('link', { name, exact: true })).toBeVisible()
  }
  const tiles = card.getByRole('list', { name: 'Your collections' })
  const boxes = await tiles.locator('li').evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect()
    return { x: rect.x, y: rect.y }
  }))
  expect(boxes[0].x).toBeLessThan(boxes[1].x)
  expect(boxes[0].y).toBe(boxes[1].y)
  expect(await tiles.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await stubPlaces(page)
  await page.goto('/')
  const trigger = page.getByRole('button', { name: `Add ${places[0].name} to a collection`, exact: true })
  const filledBookmark = page.getByRole('button', { name: `Remove ${places[0].name} from all collections`, exact: true })
  await page.getByRole('button', { name: `Save ${places[0].name}`, exact: true }).click()
  await expect(page.getByRole('button', { name: `Unsave ${places[0].name}`, exact: true })).toBeVisible()
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Choose a collection' })
  await expect(picker).toBeVisible()
  const popup = await picker.boundingBox()
  expect(popup.x).toBeGreaterThanOrEqual(0)
  expect(popup.x + popup.width).toBeLessThanOrEqual(375)
  await picker.getByRole('button', { name: 'Add to Weekend cafes', exact: true }).click()
  await expect(filledBookmark).toHaveAttribute('aria-pressed', 'true')
  await expect(picker).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  const { data: collections } = await admin.schema('community').from('collections').select('id,name').eq('user_id', user.id)
  const dinner = collections.find((collection) => collection.name === 'Dinner ideas')
  // Set up a second membership so one click must remove the place everywhere.
  expect((await admin.schema('community').from('collection_places').insert({ collection_id: dinner.id, place_id: places[0].id })).error).toBeNull()
  await page.reload()
  await expect(filledBookmark).toHaveAttribute('aria-pressed', 'true')
  await filledBookmark.click()
  await expect(trigger).toHaveAttribute('aria-pressed', 'false')
  const { data: memberships } = await admin.schema('community').from('collection_places').select('*').eq('place_id', places[0].id).in('collection_id', collections.map((collection) => collection.id))
  expect(memberships).toHaveLength(0)
  await expect(page.getByRole('button', { name: `Unsave ${places[0].name}`, exact: true })).toBeVisible()
  await trigger.click()
  await expect(picker.getByRole('button', { name: 'Add to Weekend cafes', exact: true })).toBeEnabled()
  await picker.getByRole('button', { name: 'Add to Dinner ideas', exact: true }).click()
  await expect(filledBookmark).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/profile')
  await card.getByRole('link', { name: 'Dinner ideas', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Places in collection' }).getByRole('link', { name: places[0].name, exact: true })).toBeVisible()
})

test('Discover picker handles guests, empty collections, failed loads and failed adds', async ({ page }) => {
  await stubPlaces(page)
  await page.goto('/')
  const trigger = page.getByRole('button', { name: `Add ${places[0].name} to a collection`, exact: true })
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Choose a collection' })
  await expect(picker.getByText('Log in to add places to a collection.')).toBeVisible()
  await picker.getByRole('link', { name: 'Log in', exact: true }).click()
  const user = await account()
  await login(page, user)
  await page.goto('/')
  await trigger.click()
  await expect(picker.getByText('No collections yet.')).toBeVisible()
  await picker.getByRole('link', { name: 'Create a collection' }).click()
  await create(page, 'Retry picker')
  await page.goto('/')
  await page.route(`${API}/collections?*`, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await trigger.click()
  await expect(picker.getByRole('alert')).toContainText('Could not load collections')
  await page.unroute(`${API}/collections?*`)
  await picker.getByRole('button', { name: 'Retry collections' }).click()
  const choice = picker.getByRole('button', { name: 'Add to Retry picker', exact: true })
  const { data } = await admin.schema('community').from('collections').select('id').eq('user_id', user.id).single()
  const endpoint = `${API}/collections/${data.id}/places/${places[0].id}`
  await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await choice.click()
  await expect(picker.getByRole('alert')).toContainText('Could not add this place')
  await expect(choice).toBeEnabled()
  await page.unroute(endpoint)
  await choice.click()
  const filledBookmark = page.getByRole('button', { name: `Remove ${places[0].name} from all collections`, exact: true })
  await expect(filledBookmark).toHaveAttribute('aria-pressed', 'true')
  const removeEndpoint = `${API}/collections/places/${places[0].id}`
  await page.route(removeEndpoint, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await filledBookmark.click()
  await expect(page.getByRole('alert')).toContainText('Could not remove this place from all collections')
  await expect(filledBookmark).toHaveAttribute('aria-pressed', 'true')
  await page.unroute(removeEndpoint)
  await filledBookmark.click()
  await expect(trigger).toHaveAttribute('aria-pressed', 'false')
})
