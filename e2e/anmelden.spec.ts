import { test, expect } from '@playwright/test'

// Login-Smoke (architektur § 8.2, BAUPLAN § 3.1.1); weitere Specs v1.1. Läuft gegen das echte Projekt (ein Fehlversuch).
test.use({ storageState: { cookies: [], origins: [] } })

test('Karte → falscher Passcode → Meldung', async ({ page }) => {
  await page.goto('/anmelden')
  await expect(page.getByRole('heading', { name: 'Wer bist du?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Vincent/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mike/ })).toBeVisible()
  await page.getByRole('button', { name: /Vincent/ }).click()
  await expect(page.getByRole('button', { name: /Vincent/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Passcode', { exact: true }).fill('zehn-zeichen-falsch')
  await page.getByRole('button', { name: /Anmelden/ }).click()
  await expect(page.getByText('Passcode stimmt nicht – versuch es nochmal.')).toBeVisible()
  await expect(page).toHaveURL(/\/anmelden/)
})

test('Karte → Passcode → /heute', async ({ page }) => {
  test.skip(!process.env.E2E_PASSCODE, 'E2E_PASSCODE fehlt')
  await page.goto('/anmelden')
  await page.getByRole('button', { name: /Vincent/ }).click()
  await page.getByLabel('Passcode', { exact: true }).fill(process.env.E2E_PASSCODE ?? '')
  await page.getByRole('button', { name: /Anmelden/ }).click()
  await expect(page).toHaveURL(/\/heute$/)
})
