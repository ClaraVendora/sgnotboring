import { test, expect } from '@playwright/test'

// SGN-020: Home loads 24 places at a time as you scroll.
const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const allDay = { weekdayDescriptions: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => `${day}: Open 24 hours`) }
// Every fifth place has no hours, so Open now keeps 84 of the 105.
const places = Array.from({ length: 105 }, (_, index) => ({
  id: `place-${index + 1}`, name: `Pagination place ${index + 1}`,
  tags: ['Cafe'], opening_hours: (index + 1) % 5 === 0 ? null : allDay,
}))
const cards = (page) => page.getByRole('link', { name: /^Pagination place \d+$/ })
const scrollToEnd = (page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

// Mimics GET /places: with ?limit= it returns { places, total }, otherwise the full array.
async function stubPlaces(page, { failOffset } = {}) {
  const requests = []
  await page.route(`${API}/tags`, (route) => route.fulfill({ json: ['Cafe'] }))
  await page.route(`${API}/places?*`, (route) => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query)
    const matches = query.get('q') ? places.slice(0, 3) : places
    if (!query.has('limit')) return route.fulfill({ json: matches })
    const offset = Number(query.get('offset'))
    if (offset === failOffset) {
      failOffset = undefined
      return route.fulfill({ status: 500, json: { error: 'Could not load places' } })
    }
    const sorted = query.get('sort') === 'za' ? [...matches].reverse() : matches
    return route.fulfill({ json: { places: sorted.slice(offset, offset + Number(query.get('limit'))), total: matches.length } })
  })
  return requests
}

test('loads 24 at a time on scroll, counts the full total and ends cleanly', async ({ page }) => {
  const requests = await stubPlaces(page)
  await page.goto('/')
  await expect(cards(page)).toHaveCount(24)
  await expect(page.getByText('Showing 24 of 105 food places')).toBeVisible()
  await expect(page.getByText("You've seen everything")).toHaveCount(0)
  for (const count of [48, 72, 96, 105]) {
    await scrollToEnd(page)
    await expect(cards(page)).toHaveCount(count)
  }
  await expect(page.getByText("You've seen everything")).toBeVisible()
  await expect(page.getByText('Showing 105 of 105 food places')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load more places' })).toHaveCount(0)
  // Every request is one batch of 24, each offset fetched once (StrictMode may repeat the first).
  expect(requests.every((query) => query.get('limit') === '24')).toBe(true)
  expect(requests.map((query) => query.get('offset')).filter((offset) => offset !== '0')).toEqual(['24', '48', '72', '96'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('sorting and search reset to the first batch and stay in the URL', async ({ page }) => {
  await stubPlaces(page)
  await page.goto('/')
  await expect(cards(page)).toHaveCount(24)
  await scrollToEnd(page)
  await expect(cards(page)).toHaveCount(48)
  await page.getByLabel('Sort by').selectOption('za')
  await expect(page).toHaveURL(/sort=za/)
  await expect(cards(page).first()).toHaveText('Pagination place 105')
  await expect(page.getByText('Showing 24 of 105 food places')).toBeVisible()
  await page.reload()
  await expect(cards(page).first()).toHaveText('Pagination place 105')
  await page.getByRole('searchbox', { name: 'Search by name or area' }).fill('cafe')
  await expect(cards(page)).toHaveCount(3)
  await expect(page).toHaveURL(/q=cafe/)
  await expect(page.getByText("You've seen everything")).toBeVisible()
})

test('a failed batch offers Retry, which loads it', async ({ page }) => {
  await stubPlaces(page, { failOffset: 24 })
  await page.goto('/')
  await expect(cards(page)).toHaveCount(24)
  await scrollToEnd(page)
  await expect(page.getByText('Could not load more places. Please retry.')).toBeVisible()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(cards(page)).toHaveCount(48)
  await expect(page.getByText('Could not load more places. Please retry.')).toHaveCount(0)
})

test('Open now fetches the full list without paging and filters in the browser', async ({ page }) => {
  const requests = await stubPlaces(page)
  await page.goto('/?open_now=1')
  await expect(cards(page)).toHaveCount(84)
  await expect(page.getByText('Showing 84 of 84 food places')).toBeVisible()
  await expect(page.getByText("You've seen everything")).toBeVisible()
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.every((query) => !query.has('limit') && !query.has('open_now'))).toBe(true)
  await page.getByRole('button', { name: 'Open now', exact: true }).click()
  await expect(cards(page)).toHaveCount(24)
  await expect(page.getByText('Showing 24 of 105 food places')).toBeVisible()
})
