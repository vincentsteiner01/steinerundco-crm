import { defineConfig, devices } from '@playwright/test'

// Nur lokal gegen das echte Projekt (architektur § 8.2) – nicht in CI.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: 'e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:8768',
    storageState: 'e2e/.auth/state.json',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:8768', reuseExistingServer: true },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'] }, testMatch: /heute\.spec\.ts/ },
  ],
})
