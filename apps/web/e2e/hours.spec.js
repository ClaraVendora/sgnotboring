import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const week = () => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => `${day}: 9 am–5 pm`)

test('Discover uses clear hours today even when another day has a holiday note', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+08:00'))
  const clearToday = week()
  clearToday[0] += ' (Diwali might affect these hours)'
  clearToday[4] += ' (Diwali might affect these hours)'
  const uncertainToday = week()
  uncertainToday[3] += ' (Diwali hours)'
  await page.route(`${API}/tags`, (route) => route.fulfill({ json: [] }))
  await page.route(`${API}/places?*`, (route) => route.fulfill({ json: [
    { id: 'clear', name: 'Clear Thursday hours', tags: [], opening_hours: { weekdayDescriptions: clearToday } },
    { id: 'holiday', name: 'Holiday hours uncertain', tags: [], opening_hours: { weekdayDescriptions: uncertainToday } },
    { id: 'missing', name: 'No hours supplied', tags: [], opening_hours: null },
  ] }))
  await page.goto('/')
  await expect(page.getByText('OPEN', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Hours unknown', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Open now', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Clear Thursday hours', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Holiday hours uncertain', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'No hours supplied', exact: true })).toHaveCount(0)
})
