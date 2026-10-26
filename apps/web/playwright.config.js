import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    // Auth tokens travel in requests/callback URLs; do not record traces.
    trace: 'off',
  },
})
