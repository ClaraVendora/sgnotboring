import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const env = dotenv.parse(readFileSync(new URL('../../places/.env', import.meta.url)))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('Local Supabase only')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const accounts = []
let placeId

test.beforeAll(async () => {
  const { data, error } = await admin.schema('catalog').from('places').select('id').limit(1)
  expect(error).toBeNull()
  placeId = data[0].id
})
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const results = await Promise.all(accounts.splice(0).map((account) => admin.auth.admin.deleteUser(account.id)))
  expect(results.every(({ error }) => !error)).toBe(true)
})

async function account(name) {
  const email = `review-ui-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } })
  expect(error).toBeNull()
  const user = { id: data.user.id, email, password }
  accounts.push(user)
  return user
}
async function login(page, user) {
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(user.email)
  await page.getByLabel('Password', { exact: false }).fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto(`/places/${placeId}`)
}

test('authors post and edit reviews; guests and another user can read them', async ({ page, browser }) => {
  const alice = await account('Review Author')
  await login(page, alice)
  const section = page.getByRole('region', { name: /Community reviews/ })
  await section.getByLabel('Write a review').fill('Great coffee and friendly service.')
  await section.getByRole('radio', { name: '4 stars', exact: true }).check()
  await section.getByRole('button', { name: 'Post review' }).click()
  await expect(section.getByText('Great coffee and friendly service.', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Post review' })).toHaveCount(0)
  await section.getByRole('button', { name: 'Edit review' }).click()
  await section.getByLabel('Edit your review').fill('Great coffee, friendly service, and lovely cake.')
  await section.getByRole('radio', { name: '5 stars', exact: true }).check()
  await section.getByRole('button', { name: 'Save changes' }).click()
  await expect(section.getByText('Great coffee, friendly service, and lovely cake.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(section.getByRole('button', { name: 'Edit review' })).toBeVisible()

  const context = await browser.newContext()
  try {
    const visitor = await context.newPage()
    await visitor.goto(`${new URL(page.url()).origin}/places/${placeId}`)
    const guestReviews = visitor.getByRole('region', { name: /Community reviews/ })
    await expect(guestReviews.getByText('Great coffee, friendly service, and lovely cake.', { exact: true })).toBeVisible()
    await expect(guestReviews.getByRole('button', { name: 'Edit review' })).toHaveCount(0)
    await expect(guestReviews.getByLabel('5 out of 5 stars')).toBeVisible()
    await expect(guestReviews.getByRole('link', { name: 'Log in' })).toBeVisible()
    const bob = await account('Review Reader')
    await login(visitor, bob)
    await expect(guestReviews.getByLabel('Write a review')).toBeVisible()
    await expect(guestReviews.getByRole('button', { name: 'Edit review' })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('failed submissions keep the draft and can be retried', async ({ page }) => {
  await login(page, await account('Review Retry'))
  const section = page.getByRole('region', { name: /Community reviews/ })
  await page.route(`${API}/places/${placeId}/review`, (route) => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await section.getByLabel('Write a review').fill('A review that should survive an error.')
  await section.getByRole('radio', { name: '3 stars', exact: true }).check()
  await section.getByRole('button', { name: 'Post review' }).click()
  await expect(section.getByRole('alert')).toContainText('Could not save')
  await expect(section.getByLabel('Write a review')).toHaveValue('A review that should survive an error.')
  await page.unroute(`${API}/places/${placeId}/review`)
  await section.getByRole('button', { name: 'Post review' }).click()
  await expect(section.getByRole('button', { name: 'Edit review' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Account links to rated review history with dates, author edits, and confirmed deletion', async ({ page, browser }) => {
  await login(page, await account('Review History'))
  const section = page.getByRole('region', { name: /Community reviews/ })
  await section.getByLabel('Write a review').fill('My review history example.')
  await section.getByRole('radio', { name: '4 stars', exact: true }).check()
  await section.getByRole('button', { name: 'Post review' }).click()
  await expect(section.getByRole('button', { name: 'Edit review' })).toBeVisible()
  await page.goto('/profile')
  await page.getByRole('link', { name: 'View my reviews' }).click()
  await expect(page).toHaveURL(/\/profile\/reviews$/)
  await page.reload()
  const review = page.getByRole('article').first()
  await expect(review.getByText('My review history example.', { exact: true })).toBeVisible()
  await expect(review.getByRole('link')).toBeVisible()
  await expect(review.getByLabel('4 out of 5 stars')).toBeVisible()
  await expect(review.getByText(/Reviewed .+SGT/)).toBeVisible()
  await review.getByRole('button', { name: 'Edit review' }).click()
  await review.getByRole('radio', { name: '2 stars', exact: true }).check()
  await review.getByLabel('Edit your review').fill('Updated from my review history.')
  await review.getByRole('button', { name: 'Save changes' }).click()
  const edited = page.getByRole('article').first()
  await expect(edited.getByText('Updated from my review history.', { exact: true })).toBeVisible()
  await expect(edited.getByLabel('2 out of 5 stars')).toBeVisible()
  await expect(edited.getByText(/Edited .+SGT/)).toBeVisible()
  await edited.getByRole('button', { name: 'Delete review' }).click()
  await edited.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(edited).toBeVisible()

  const context = await browser.newContext()
  try {
    const visitor = await context.newPage()
    const base = new URL(page.url()).origin
    await visitor.goto(`${base}/profile/reviews`)
    await expect(visitor.getByText('Log in to see your reviews and ratings.')).toBeVisible()
    const bob = await account('Different Reviewer')
    await login(visitor, bob)
    await visitor.goto(`${base}/profile/reviews`)
    await expect(visitor.getByText('You haven’t reviewed any places yet.')).toBeVisible()
    await expect(visitor.getByRole('article')).toHaveCount(0)
  } finally { await context.close() }

  await edited.getByRole('button', { name: 'Delete review' }).click()
  await edited.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByText('You haven’t reviewed any places yet.')).toBeVisible()
  await page.goto(`/places/${placeId}`)
  await expect(section.getByText('Updated from my review history.', { exact: true })).toHaveCount(0)
  await expect(section.getByLabel('Write a review')).toBeVisible()
})
