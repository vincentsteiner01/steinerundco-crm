import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Login einmal, Session als storageState (e2e/.auth/, ignoriert). Passcode kommt aus der Umgebung:
//   E2E_PASSCODE="$(security find-generic-password -s crm-e2e -w)" npm run e2e
// Ohne E2E_PASSCODE läuft nur der Login-Smoke ohne Anmeldung (leerer storageState); angemeldete Specs überspringen sich selbst.
export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_EMAIL ?? 'vincent@steinerundco.de'
  const passcode = process.env.E2E_PASSCODE
  mkdirSync('e2e/.auth', { recursive: true })
  if (!passcode) {
    writeFileSync('e2e/.auth/state.json', JSON.stringify({ cookies: [], origins: [] }))
    console.warn('E2E_PASSCODE fehlt – nur Login-Smoke ohne Anmeldung (architektur § 8.2)')
    return
  }
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://127.0.0.1:8768'
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto('/anmelden')
  await page.getByRole('button', { name: email.startsWith('mike') ? /Mike/ : /Vincent/ }).click()
  await page.getByLabel('Passcode', { exact: true }).fill(passcode)
  await page.getByRole('button', { name: /Anmelden/ }).click()
  await page.waitForURL('**/heute')
  await page.context().storageState({ path: 'e2e/.auth/state.json' })
  await browser.close()
}
