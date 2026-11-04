import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

const env = dotenv.parse(readFileSync(new URL('../../api/.env', import.meta.url)))
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(env.SUPABASE_URL)) throw new Error('Local Supabase only')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const users = []
const testEmails = new Set()
const MAIL = 'http://127.0.0.1:54324'

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  const results = await Promise.all(users.splice(0).map((user) => admin.auth.admin.deleteUser(user.id)))
  const inbox = await fetch(`${MAIL}/api/v1/messages`).then((response) => response.json())
  const ids = (inbox.messages ?? []).filter((message) => message.To.some((to) => testEmails.has(to.Address))).map((message) => message.ID)
  if (ids.length) await fetch(`${MAIL}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) })
  testEmails.clear()
  expect(results.every(({ error }) => !error)).toBe(true)
})
async function login(page) {
  const email = `profile-edit-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Profile Test' } })
  expect(error).toBeNull()
  const user = { id: data.user.id, email }
  users.push(user)
  testEmails.add(email)
  await page.goto('/profile')
  await page.getByLabel('Email', { exact: false }).fill(email)
  await page.getByLabel('Password', { exact: false }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  return user
}

test('name and icon persist, Cancel discards edits, and errors keep the draft', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const user = await login(page)
  const profile = page.getByRole('region', { name: 'Your profile', exact: true })
  await profile.getByRole('button', { name: 'Edit profile' }).click()
  await profile.getByLabel('Display name', { exact: true }).fill('Kai Coffee')
  await profile.getByRole('radio', { name: 'Coffee', exact: true }).check()
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByRole('heading', { name: 'Kai Coffee', exact: true })).toBeVisible()
  await expect(profile.getByRole('img', { name: 'Profile icon: Coffee', exact: true })).toBeVisible()
  await page.reload()
  await expect(profile.getByRole('heading', { name: 'Kai Coffee', exact: true })).toBeVisible()
  await expect(profile.getByRole('img', { name: 'Profile icon: Coffee', exact: true })).toBeVisible()
  await profile.getByRole('button', { name: 'Edit profile' }).click()
  await profile.getByLabel('Display name', { exact: true }).fill('Cancelled name')
  await profile.getByRole('radio', { name: 'Dog', exact: true }).check()
  await profile.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(profile.getByRole('heading', { name: 'Kai Coffee', exact: true })).toBeVisible()
  await profile.getByRole('button', { name: 'Edit profile' }).click()
  await profile.getByLabel('Email', { exact: false }).fill('invalid')
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByRole('alert')).toContainText('Enter a valid email')
  await profile.getByLabel('Email', { exact: false }).fill(user.email)
  await profile.getByLabel('Display name', { exact: true }).fill('Retry name')
  await page.route(`${env.SUPABASE_URL}/auth/v1/user*`, (route) => route.request().method() === 'PUT'
    ? route.fulfill({ status: 400, json: { error_code: 'unexpected_failure', msg: 'Test failure' } }) : route.continue())
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByLabel('Display name', { exact: true })).toHaveValue('Retry name')
  await expect(profile.getByRole('alert')).toContainText('Could not complete')
  await page.unroute(`${env.SUPABASE_URL}/auth/v1/user*`)
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByRole('heading', { name: 'Retry name', exact: true })).toBeVisible()
  const saved = await admin.auth.admin.getUserById(user.id)
  expect(saved.data.user.user_metadata.display_name).toBe('Retry name')
  expect(saved.data.user.user_metadata.avatar_icon).toBe('coffee')
  expect(saved.data.user.email).toBe(user.email)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('email changes keep the current email active until confirmation', async ({ page }) => {
  const user = await login(page)
  const profile = page.getByRole('region', { name: 'Your profile', exact: true })
  const nextEmail = `profile-new-${randomUUID()}@example.com`
  testEmails.add(nextEmail)
  await profile.getByRole('button', { name: 'Edit profile' }).click()
  await profile.getByLabel('Email', { exact: false }).fill(nextEmail)
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByRole('status').filter({ hasText: 'confirm the email change' })).toBeVisible()
  await expect(profile.getByText(user.email, { exact: true })).toBeVisible()
  await expect(profile.getByText(/is awaiting confirmation/)).toContainText(nextEmail)
  const current = await admin.auth.admin.getUserById(user.id)
  expect(current.data.user.email).toBe(user.email)
  expect(current.data.user.new_email).toBe(nextEmail)
  await expect.poll(async () => {
    const inbox = await fetch(`${MAIL}/api/v1/messages`).then((response) => response.json())
    return new Set(inbox.messages.flatMap((message) => message.To.map((to) => to.Address)).filter((address) => testEmails.has(address))).size
  }).toBe(2)
  const inbox = await fetch(`${MAIL}/api/v1/messages`).then((response) => response.json())
  let callback
  for (const address of [user.email, nextEmail]) {
    const message = inbox.messages.find((message) => message.To.some((to) => to.Address === address))
    const contents = await fetch(`${MAIL}/api/v1/message/${message.ID}`).then((response) => response.json())
    const link = contents.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll('&amp;', '&')
    expect(new URL(link).origin).toBe(new URL(env.SUPABASE_URL).origin)
    const confirmed = await fetch(link, { redirect: 'manual' })
    expect(confirmed.status).toBe(303)
    callback = confirmed.headers.get('location')
  }
  await page.goto(callback)
  await expect(page).toHaveURL(/\/profile$/)
  await expect(profile.getByText(nextEmail, { exact: true })).toBeVisible()
  expect((await admin.auth.admin.getUserById(user.id)).data.user.email).toBe(nextEmail)
})
