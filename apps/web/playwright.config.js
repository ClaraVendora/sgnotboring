import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  workers: 1,
  reporter: 'list',
  use: {
    // E2E_BASE_URL / E2E_API_URL point the suites at other ports than `npm run dev`.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    // Auth tokens travel in requests/callback URLs; do not record traces.
    trace: 'off',
  },
})
