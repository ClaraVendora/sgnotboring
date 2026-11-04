import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const places = Array.from({ length: 105 }, (_, index) => ({
  id: `place-${index + 1}`, name: `Pagination place ${index + 1}`,
  tags: ['Cafe'], opening_hours: { weekdayDescriptions: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => `${day}: Open 24 hours`) },
}))
const cards = (page) => page.getByRole('link', { name: /^Pagination place \d+$/ })

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/tags`, (route) => route.fulfill({ json: ['Cafe'] }))
  await page.route(`${API}/places?*`, (route) => {
    const query = new URL(route.request().url()).searchParams
    return route.fulfill({ json: query.get('q') ? places.slice(0, 3) : places })
  })
})

test('page sizes, navigation, history and filter changes', async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(30)
  const nav = page.getByRole('navigation', { name: 'Places pagination' })
  await expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await nav.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(cards(page).first()).toHaveText('Pagination place 31')
  await expect(page).toHaveURL(/page=2/)
  await page.goBack()
  await expect(cards(page).first()).toHaveText('Pagination place 1')
  const size = page.getByLabel('Rows per page')
  await expect(size.locator('option')).toHaveText(['10', '20', '30'])
  await size.selectOption('20')
  await expect(cards(page)).toHaveCount(60)
  await nav.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(cards(page)).toHaveCount(45)
  await expect(nav.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await size.selectOption('30')
  await expect(cards(page)).toHaveCount(90)
  await expect(nav.getByText('Page 1 of 2')).toBeVisible()
  await nav.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(cards(page)).toHaveCount(15)
  await page.getByRole('button', { name: 'Open now', exact: true }).click()
  await expect(cards(page)).toHaveCount(90)
  await page.getByRole('searchbox', { name: 'Search by name or area' }).fill('cafe')
  await expect(cards(page)).toHaveCount(3)
  await expect(nav.getByText('Page 1 of 1')).toBeVisible()
})

test('invalid URL values are safe and controls fit mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?page=999&rows_per_page=15')
  await expect(cards(page)).toHaveCount(15)
  await expect(page.getByText('Page 4 of 4', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Rows per page')).toHaveValue('10')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/?page=-2&rows_per_page=30')
  await expect(cards(page)).toHaveCount(90)
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible()
})

test('alphabetical sorting covers the full result set before pagination and resets the page', async ({ page }) => {
  await page.goto('/?page=2')
  await expect(cards(page).first()).toHaveText('Pagination place 31')
  const sort = page.getByLabel('Sort by')
  await sort.selectOption('za')
  await expect(cards(page).first()).toHaveText('Pagination place 105')
  await expect(page.getByText('Page 1 of 4', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/sort=za/)
  const nav = page.getByRole('navigation', { name: 'Places pagination' })
  await nav.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(cards(page).first()).toHaveText('Pagination place 75')
  await sort.selectOption('az')
  await expect(cards(page).first()).toHaveText('Pagination place 1')
  await expect(page.getByText('Page 1 of 4', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(sort).toHaveValue('za')
  await expect(cards(page).first()).toHaveText('Pagination place 75')
  await page.reload()
  await expect(cards(page).first()).toHaveText('Pagination place 75')
  await expect(page.getByRole('heading', { name: 'Places to visit', exact: true })).toBeVisible()
})
