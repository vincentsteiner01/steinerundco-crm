// Headless-Prüfung der gebauten Erweiterung (dist/) in Playwright-Chromium – ohne echtes LinkedIn und ohne echtes CRM:
//  1. Erweiterung lädt (Service Worker, Popup, Optionen) ohne Fehler.
//  2. https://www.linkedin.com/in/e2e-test/ wird per page.route mit einer synthetischen Profilseite beantwortet; die Seitenleiste
//     (als Tab geöffnet, ?tab=<id>) liest die Seite per chrome.scripting und zeigt den Namen.
//  3. Falls Playwright die Anfragen des Service Workers abfangen kann: Supabase komplett gemockt (Fake-Sitzung, erfundene Daten),
//     dann Lead-Ansicht mit nächster Nachricht, Kopieren → Gesendet → Rückgängig-Leiste, und „Als Lead anlegen“-Formular.
//  4. Eingang (LinkedIn-Mails): unbekannte Mail per Suche einem Lead zuordnen; Einstellungen: Eingangs-Schlüssel erzeugen.
// Aufruf: npm run build && npm run e2e
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const hier = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const DIST = hier('dist')
const AUSGABE = process.env.E2E_AUSGABE ?? hier('test-results')
mkdirSync(AUSGABE, { recursive: true })
if (!existsSync(join(DIST, 'manifest.json'))) throw new Error('dist/ fehlt – erst npm run build')

const SUPABASE = 'https://ekaqkfgvisdngsskzbai.supabase.co'
const PROFIL = readFileSync(hier('tests/fixtures/profil-de.html'), 'utf8').replaceAll('tilda-testfall-4a2b', 'e2e-test')
const PROFIL_NEU = readFileSync(hier('tests/fixtures/profil-gehasht.html'), 'utf8').replaceAll('jonas-beispielmann', 'e2e-neu')
const GESPRAECH = readFileSync(hier('tests/fixtures/nachrichten.html'), 'utf8').replaceAll('tilda-testfall-4a2b', 'e2e-test')
const ICH = '00000000-0000-4000-8000-0000000000e2'
const MIKE = '00000000-0000-4000-8000-0000000000e3'
const LEAD_ID = '00000000-0000-4000-8000-00000000e2e1'
const NEU_ID = '00000000-0000-4000-8000-00000000e2e2'

let fehler = 0
const pruefe = (bedingung, text) => {
  console.log(`${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler += 1
}

// ── Supabase-Mock (nur erfundene Daten) ────────────────────────────────────
const jetzt = new Date()
const heuteIso = new Date(jetzt.getTime() - 60_000).toISOString()
const MITGLIEDER = [
  { id: ICH, display_name: 'Vincent Steiner', short_name: 'Vincent', email: 'vincent@steinerundco.de', signature: null, calendly_url: null, caller_number_e164: null },
  { id: MIKE, display_name: 'Mike Muster', short_name: 'Mike', email: 'mike@steinerundco.de', signature: null, calendly_url: null, caller_number_e164: null },
]
const LEAD = {
  id: LEAD_ID, salutation: 'frau', title: null, first_name: 'Tilda', last_name: 'Testfall', full_name: 'Tilda Testfall',
  role: 'geschaeftsfuehrer', role_title: 'Geschäftsführerin', company_name: 'Sonnenfeld Solartechnik GmbH', city: 'Lüneburg',
  stage: 'vernetzt', ended_reason: null, owner_id: ICH, do_not_contact: false, do_not_contact_channels: null,
  linkedin_url_norm: 'linkedin.com/in/e2e-test', email: null, phone_e164: null, inbound_unanswered_since: null,
  call_basis: null, call_basis_note: null, deleted_at: null, companies: { do_not_contact: false },
}
const NEU = {
  ...LEAD, id: NEU_ID, salutation: 'herr', title: 'Dr.', first_name: 'Jonas', last_name: 'Beispielmann', full_name: 'Jonas Beispielmann',
  role: 'inhaber', role_title: 'Inhaber', company_name: 'Nordlicht Energie GmbH & Co. KG', city: 'Bremen', stage: 'neu',
  linkedin_url_norm: 'linkedin.com/in/e2e-neu',
}
const SCHRITTE = [
  { id: 's1', position: 1, name: 'Opener', template_id: 't0', is_opener: true },
  { id: 's2', position: 2, name: 'Kurzfristig 1', template_id: 't1', is_opener: false },
  { id: 's3', position: 3, name: 'Kurzfristig 2', template_id: 't2', is_opener: false },
]
let schritt = 's2'
let neuAngelegt = false
let eingangZugeordnet = false
const anfragen = []
const koerper = {}

function rest(url, methode, body) {
  const u = new URL(url)
  const tabelle = u.pathname.replace('/rest/v1/', '')
  const q = decodeURIComponent(u.search)
  anfragen.push(`${methode} ${tabelle}${q}`)
  if (body) koerper[tabelle] = JSON.parse(body)
  if (tabelle === 'rpc/log_reply') return 4711
  if (tabelle === 'rpc/eingang_zuordnen') {
    eingangZugeordnet = true
    return { id: 'ein-1', status: 'verarbeitet', ergebnis: 'Antwort verbucht – Sequenz gestoppt' }
  }
  if (tabelle === 'rpc/eingang_token_erzeugen') return 'E2eSchluessel_' + 'x'.repeat(29)
  if (tabelle === 'rpc/import_leads') {
    neuAngelegt = true
    return { batch_id: 'batch-e2e', dry_run: false, inserted: 1, rows: [{ status: 'neu', existing_id: null }] }
  }
  if (tabelle === 'rpc/log_request') return { id: 'c-e2e', lead_id: NEU_ID, member_id: ICH, status: 'ausstehend' }
  if (tabelle === 'rpc/complete_step') {
    schritt = 's3'
    return { status: 'aktiv', current_step_id: 's3', next_due_at: new Date(jetzt.getTime() + 2 * 86_400_000).toISOString() }
  }
  if (tabelle === 'rpc/undo_activity') {
    schritt = 's2'
    return { activity_id: 77, type: 'nachricht_gesendet', restored: ['enrollment'] }
  }
  switch (tabelle) {
    case 'members':
      return MITGLIEDER
    case 'eingang':
      return eingangZugeordnet ? [] : [{
        id: 'ein-1', member_id: ICH, art: 'nachricht', status: 'unbekannt', empfangen_at: new Date(jetzt.getTime() - 3_600_000).toISOString(),
        absender_name: 'Erika Probe', linkedin_slug: null, text: 'Klingt gut, erzähl mehr.', ergebnis: 'Kein passender Lead gefunden – bitte zuordnen', lead_id: null,
      }]
    case 'eingang_tokens':
      return [{ created_at: '2026-10-15T07:00:00Z', last_used_at: new Date(jetzt.getTime() - 4 * 60_000).toISOString() }]
    case 'member_profiles':
      return [{ linkedin_url: null }]
    case 'leads':
      if (q.includes('ilike') && q.includes('Erika')) return [{ ...LEAD }]
      if (q.includes('source_batch_id=eq.batch-e2e')) return [{ id: NEU_ID }]
      if (q.includes('linkedin_url_norm=eq.linkedin.com/in/e2e-neu')) return neuAngelegt ? [{ ...NEU, deleted_at: null }] : []
      if (new RegExp(`[?&]id=eq\\.${NEU_ID}`).test(q)) return [NEU]
      if (q.includes('linkedin_url_norm=eq.linkedin.com/in/e2e-test')) return [LEAD]
      if (new RegExp(`[?&]id=eq\\.${LEAD_ID}`).test(q)) return [LEAD]
      return []
    case 'linkedin_connections':
      if (new RegExp(`lead_id=eq\\.${NEU_ID}`).test(q)) return neuAngelegt ? [{ member_id: ICH, status: 'ausstehend', requested_at: new Date().toISOString(), accepted_at: null }] : []
      return [{ member_id: ICH, status: 'angenommen', requested_at: '2026-10-01T07:00:00Z', accepted_at: '2026-10-03T10:00:00Z' }]
    case 'enrollments':
      if (new RegExp(`lead_id=eq\\.${NEU_ID}`).test(q)) return []
      return [{ id: 'enr-e2e', sequence_id: 'seq-a', member_id: ICH, status: 'aktiv', current_step_id: schritt, next_due_at: heuteIso, sequences: { key: 'linkedin_standard', name: 'LinkedIn Standard (ohne Notiz)' } }]
    case 'sequence_steps':
      if (/[?&]id=eq\./.test(q)) return SCHRITTE.filter((s) => new RegExp(`[?&]id=eq\\.${s.id}(&|$)`).test(q))
      return SCHRITTE
    case 'templates':
      if (/[?&]id=eq\.t2(&|$)/.test(q)) return [{ id: 't2', key: 'li_fu_kurz_2', name: 'Kurzfristig 2', body: 'Hallo [Vorname], noch einmal kurz.', phase: 'follow_up' }]
      return [{ id: 't1', key: 'li_fu_kurz_1', name: 'Kurzfristig 1', body: 'Hallo [Vorname], kurz nachgefasst – passt es diese Woche bei [Unternehmen]?', phase: 'follow_up' }]
    case 'activities': {
      // Verlauf (17.10.2026): erfundene Einträge, neueste zuerst
      if (q.includes('select=*,templates(name)')) {
        const vor = (h) => new Date(jetzt.getTime() - h * 3_600_000).toISOString()
        const a = (id, type, h, x = {}) => ({ id, lead_id: LEAD_ID, member_id: ICH, channel: 'linkedin', type, occurred_at: vor(h), template_id: null, outcome: null, reply_label: null, note: null, metadata: {}, source: 'app', templates: null, ...x })
        return [
          a(906, 'nachricht_erhalten', 1, { note: 'Klingt spannend – schicken Sie mir gern zwei Termine.', reply_label: 'interessiert' }),
          a(905, 'nachricht_gesendet', 26, { note: 'Hallo Frau Testfall, kurz nachgefasst – passt es diese Woche?', templates: { name: 'Kurzfristig 1' } }),
          a(904, 'anruf', 50, { channel: 'telefon', outcome: 'no_answer', note: 'Mailbox, keine Nachricht hinterlassen.' }),
          a(903, 'notiz', 74, { channel: 'sonstiges', note: 'Kennt uns von der Intersolar.' }),
          a(902, 'stage_wechsel', 98, { channel: 'sonstiges', metadata: { from: 'vernetzt', to: 'gespraech_eroeffnet' } }),
          a(901, 'vernetzung_angenommen', 120),
        ]
      }
      if (q.includes('type=eq.angelegt')) return []
      return [{ id: 77, created_at: new Date().toISOString(), member_id: ICH }]
    }
    case 'v_today_queue':
      return [
        { section: 'heute', item_kind: 'sequenz_schritt', channel: 'linkedin' },
        { section: 'ueberfaellig', item_kind: 'sequenz_schritt', channel: 'linkedin' },
        { section: 'antworten', item_kind: 'antworten', channel: 'linkedin' },
      ]
    default:
      return []
  }
}

const profilDir = mkdtempSync(join(tmpdir(), 'suco-e2e-'))
const context = await chromium.launchPersistentContext(profilDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 380, height: 1100 },
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
})

try {
  await context.route(/^https?:\/\//, async (route) => {
    const url = route.request().url()
    if (url.startsWith('https://www.linkedin.com/in/e2e-test')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PROFIL })
    if (url.startsWith('https://www.linkedin.com/in/e2e-neu')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PROFIL_NEU })
    if (url.startsWith('https://www.linkedin.com/messaging/thread/e2e')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: GESPRAECH })
    if (url.startsWith(`${SUPABASE}/rest/v1/__probe`)) return route.fulfill({ status: 200, contentType: 'text/plain', body: 'PROBE' })
    if (url.startsWith(`${SUPABASE}/rest/v1/`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rest(url, route.request().method(), route.request().postData())) })
    }
    // alles andere (auch echtes LinkedIn/Supabase) bleibt gesperrt
    return route.abort()
  })

  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }))
  const id = new URL(sw.url()).host
  pruefe(/^[a-p]{32}$/.test(id), `Service Worker läuft (Erweiterung ${id})`)
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest())
  pruefe(manifest.name === 'Steiner & Co. CRM für LinkedIn' && !manifest.content_scripts, 'Manifest geladen, keine Content-Scripts')

  const konsolenfehler = []
  const beobachte = (seite, name) => {
    seite.on('pageerror', (e) => konsolenfehler.push(`${name}: ${e.message}`))
    seite.on('console', (m) => {
      if (m.type() === 'error') konsolenfehler.push(`${name}: ${m.text()}`)
    })
  }

  // Popup + Optionen
  const popup = await context.newPage()
  beobachte(popup, 'popup')
  await popup.goto(`chrome-extension://${id}/popup.html`)
  await popup.getByRole('heading', { name: 'Wer bist du?' }).waitFor({ timeout: 10_000 })
  pruefe(await popup.getByRole('button', { name: /Vincent/ }).isVisible(), 'Popup zeigt die Anmeldung mit Personenkacheln')
  const foto = await popup.locator('.kachel img').first().evaluate((img) => img.complete && img.naturalWidth > 0)
  pruefe(foto, 'Profilfoto im Popup geladen')
  await popup.screenshot({ path: join(AUSGABE, 'e2e-popup-abgemeldet.png') })
  const optionen = await context.newPage()
  beobachte(optionen, 'optionen')
  await optionen.goto(`chrome-extension://${id}/optionen.html`)
  pruefe(await optionen.getByRole('heading', { name: 'Einstellungen' }).isVisible(), 'Optionsseite lädt')
  await optionen.close()

  // LinkedIn-Profil (Route) + Seitenleiste
  const linkedin = await context.newPage()
  await linkedin.goto('https://www.linkedin.com/in/e2e-test/')
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.linkedin.com/*' }))[0]?.id)
  pruefe(typeof tabId === 'number', `LinkedIn-Tab gefunden (${tabId})`)

  const leiste = await context.newPage()
  beobachte(leiste, 'seitenleiste')
  await leiste.goto(`chrome-extension://${id}/sidepanel.html?tab=${tabId}`)
  await leiste.getByRole('heading', { name: 'Tilda Testfall' }).waitFor({ timeout: 10_000 })
  const leisteText = await leiste.locator('body').innerText()
  pruefe(leisteText.includes('Geschäftsführerin bei Sonnenfeld Solartechnik GmbH'), 'Headline gelesen')
  pruefe(leisteText.includes('Sonnenfeld Solartechnik GmbH · Lüneburg, Niedersachsen, Deutschland'), 'Firma und Ort gelesen')
  pruefe(leisteText.includes('in/e2e-test'), 'Profil-URL normiert (in/e2e-test)')
  pruefe(leisteText.includes('Melde dich an'), 'ohne Sitzung: Anmeldung in der Leiste')
  await leiste.screenshot({ path: join(AUSGABE, 'e2e-seitenleiste-abgemeldet.png'), fullPage: true })

  // LinkedIn-Seite unverändert (kein eingefügtes Element, keine Klicks)
  const unveraendert = await linkedin.evaluate(() => document.querySelectorAll('[id*="suco"], [class*="suco"]').length === 0 && document.body.children.length)
  pruefe(unveraendert > 0, 'LinkedIn-DOM unverändert (nichts eingefügt)')

  // ── Teil 3: mit gemocktem Supabase ────────────────────────────────────────
  const probe = await sw.evaluate((u) => fetch(`${u}/rest/v1/__probe`).then((r) => r.text()).catch((e) => `ERR ${e}`), SUPABASE)
  if (probe !== 'PROBE') {
    console.log(`hinweis Service-Worker-Anfragen nicht abfangbar (${probe}) – Teil 3 übersprungen`)
  } else {
    const ablauf = Math.floor(Date.now() / 1000) + 3600
    await sw.evaluate(
      ({ ich, ablauf }) =>
        chrome.storage.local.set({
          'crm.bleiben': 'ja',
          'sb-ekaqkfgvisdngsskzbai-auth-token': JSON.stringify({
            access_token: 'e2e.fake.token',
            refresh_token: 'e2e-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: ablauf,
            user: { id: ich, aud: 'authenticated', role: 'authenticated', email: 'vincent@steinerundco.de', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
          }),
        }),
      { ich: ICH, ablauf },
    )
    await popup.reload()
    await popup.getByText('fällige LinkedIn-Schritte').waitFor({ timeout: 10_000 })
    const popupText = await popup.locator('body').innerText()
    pruefe(/2\s*fällige LinkedIn-Schritte/.test(popupText) && popupText.includes('davon 1 überfällig') && /1\s*Antworten offen/.test(popupText), 'Popup: Zahlen für heute')
    pruefe(popupText.includes('Vincent Steiner') && popupText.includes('Seitenleiste öffnen'), 'Popup: angemeldete Person und Aktionen')
    await popup.screenshot({ path: join(AUSGABE, 'e2e-popup-angemeldet.png') })

    await leiste.reload()
    await leiste.getByRole('heading', { name: 'Tilda Testfall' }).first().waitFor({ timeout: 10_000 })
    await leiste.getByText('Im CRM', { exact: true }).waitFor({ timeout: 10_000 })
    const crmText = await leiste.locator('body').innerText()
    pruefe(crmText.includes('LinkedIn Standard (ohne Notiz) · 2 von 3 · Kurzfristig 1'), 'Sequenz und Schritt angezeigt')
    pruefe(crmText.includes('Hallo Tilda, kurz nachgefasst – passt es diese Woche bei Sonnenfeld Solartechnik GmbH?'), 'nächste Nachricht gefüllt')
    pruefe(crmText.includes('Vernetzt') && crmText.includes('vernetzt seit 03.10.2026'), 'Stufe und Vernetzung')
    pruefe(/2\s+fällig · 1 Antw\./.test(crmText), 'Heute-Zahlen im Kopf')
    await leiste.screenshot({ path: join(AUSGABE, 'e2e-seitenleiste-crm.png'), fullPage: true })

    const gesendet = leiste.getByRole('button', { name: /Gesendet/ })
    pruefe(await gesendet.isDisabled(), 'Gesendet gesperrt, solange nicht kopiert')
    await leiste.getByRole('button', { name: /Kopieren/ }).click()
    await leiste.getByText(/jetzt in LinkedIn einfügen/).waitFor({ timeout: 5000 })
    await gesendet.click()
    await leiste.getByText(/Erledigt – Kurzfristig 2 am/).waitFor({ timeout: 10_000 })
    pruefe(anfragen.some((a) => a.startsWith('POST rpc/complete_step')), 'complete_step aufgerufen')
    pruefe(await leiste.getByRole('button', { name: /Rückgängig/ }).isVisible(), 'Rückgängig-Leiste sichtbar')
    await leiste.screenshot({ path: join(AUSGABE, 'e2e-seitenleiste-erledigt.png'), fullPage: true })
    await leiste.keyboard.press('z')
    await leiste.getByText('Rückgängig gemacht.').waitFor({ timeout: 10_000 })
    pruefe(anfragen.some((a) => a.startsWith('POST rpc/undo_activity')), 'undo_activity aufgerufen (Taste Z)')

    // Profil, das nicht im CRM ist → vorbefülltes Formular
    await linkedin.goto('https://www.linkedin.com/in/e2e-neu/')
    await leiste.getByRole('heading', { name: 'Dr. Jonas Beispielmann' }).waitFor({ timeout: 10_000 })
    await leiste.getByRole('form', { name: 'Als Lead anlegen' }).waitFor({ timeout: 10_000 })
    const wert = (label) => leiste.getByRole('form', { name: 'Als Lead anlegen' }).getByLabel(label, { exact: true }).inputValue()
    pruefe((await wert('Vorname')) === 'Jonas' && (await wert('Nachname')) === 'Beispielmann', 'Formular: Vor- und Nachname')
    pruefe((await wert('Titel')) === 'Dr.' && (await wert('Unternehmen')) === 'Nordlicht Energie GmbH & Co. KG', 'Formular: Titel und Unternehmen')
    pruefe((await leiste.getByRole('button', { name: 'Herr' }).getAttribute('aria-pressed')) === 'true', 'Anrede-Vorschlag Herr')
    await leiste.screenshot({ path: join(AUSGABE, 'e2e-seitenleiste-anlegen.png'), fullPage: true })

    await leiste.getByLabel('Vernetzungsanfrage gerade gesendet').check()
    await leiste.getByRole('button', { name: /Als Lead anlegen/ }).click()
    await leiste.getByText(/Als Lead angelegt · Anfrage erfasst/).waitFor({ timeout: 10_000 })
    const imp = koerper['rpc/import_leads']
    pruefe(
      imp?.p_source === 'schnellimport' && imp?.p_owner === ICH && imp?.p_rows?.[0]?.linkedin_url === 'https://www.linkedin.com/in/e2e-neu/' &&
        imp.p_rows[0].salutation === 'herr' && imp.p_rows[0].title === 'Dr.' && imp.p_rows[0].first_name === 'Jonas',
      'Als Lead anlegen → import_leads (Schnellimport-Weg) mit Formularwerten',
    )
    pruefe(koerper['rpc/log_request']?.p_lead_id === NEU_ID && koerper['rpc/log_request']?.p_member_id === ICH, '… und log_request für mich')
    await leiste.getByText('Im CRM', { exact: true }).waitFor({ timeout: 10_000 })
    pruefe((await leiste.locator('body').innerText()).includes('Du · angefragt'), 'danach Lead-Ansicht mit offener Anfrage')

    // Unterhaltung: Partner aus dem Kopf, „Antwort erhalten“ mit der letzten Nachricht vorbefüllt
    await linkedin.goto('https://www.linkedin.com/messaging/thread/e2e/')
    await leiste.getByText('Unterhaltung mit', { exact: true }).waitFor({ timeout: 10_000 })
    await leiste.getByText('Im CRM', { exact: true }).waitFor({ timeout: 10_000 })
    await leiste.getByRole('button', { name: /Antwort erhalten/ }).click()
    const zitat = leiste.getByRole('form', { name: 'Antwort erhalten' }).locator('textarea')
    await leiste.waitForFunction(() => document.querySelector('form[aria-label="Antwort erhalten"] textarea')?.value.includes('Innendienst'), null, { timeout: 5000 })
    pruefe((await zitat.inputValue()) === 'Wie läuft das genau ab?\nWir sind zu dritt im Innendienst.', 'Zitat = letzte Nachricht der anderen Person')
    await leiste.keyboard.press('Escape')
    await leiste.getByRole('button', { name: /Antwort erhalten/ }).click()
    await leiste.getByRole('button', { name: /^Ja/ }).click()
    await leiste.screenshot({ path: join(AUSGABE, 'e2e-seitenleiste-antwort.png'), fullPage: true })
    await leiste.getByRole('button', { name: /Antwort speichern/ }).click()
    await leiste.getByText(/Antwort erfasst|Antwort erhalten – Vorlage/).first().waitFor({ timeout: 10_000 })
    const reply = koerper['rpc/log_reply']
    pruefe(reply?.p_label === 'interessiert' && reply?.p_channel === 'linkedin' && reply?.p_lead_id === LEAD_ID && reply?.p_note?.includes('Innendienst'), 'log_reply mit Label und Zitat')

    // ── Teil 4: Eingang und Eingangs-Schlüssel ─────────────────────────────
    await popup.reload()
    await popup.getByText('aus LinkedIn-Mails offen').waitFor({ timeout: 10_000 })
    pruefe(true, 'Popup: Eingang offen angezeigt')
    const eingang = await context.newPage()
    await eingang.goto(`chrome-extension://${id}/eingang.html`)
    await eingang.getByText('Erika Probe').waitFor({ timeout: 10_000 })
    pruefe((await eingang.locator('body').innerText()).includes('zuletzt gemeldet'), 'Eingang: Eintrag und Apps-Script-Status')
    await eingang.getByRole('button', { name: /Lead zuordnen/ }).click()
    await eingang.getByRole('button', { name: /^Suchen/ }).click()
    await eingang.getByText('Tilda Testfall').waitFor({ timeout: 10_000 })
    await eingang.screenshot({ path: join(AUSGABE, 'e2e-eingang.png'), fullPage: true })
    await eingang.getByRole('button', { name: /^Zuordnen/ }).click()
    await eingang.getByText(/Antwort verbucht/).waitFor({ timeout: 10_000 })
    const zu = koerper['rpc/eingang_zuordnen']
    pruefe(zu?.p_id === 'ein-1' && zu?.p_lead_id === LEAD_ID, 'Eingang: eingang_zuordnen mit gewähltem Lead')
    await eingang.getByText('Nichts offen.').waitFor({ timeout: 10_000 })
    pruefe(true, 'Eingang: danach leer')

    const einstellungen = await context.newPage()
    einstellungen.on('dialog', (d) => void d.accept())
    await einstellungen.goto(`chrome-extension://${id}/optionen.html`)
    await einstellungen.getByRole('button', { name: /Neuen Schlüssel erzeugen/ }).click()
    const feld = einstellungen.getByLabel('Neuer Eingangs-Schlüssel')
    await feld.waitFor({ timeout: 10_000 })
    pruefe((await feld.inputValue()) === 'E2eSchluessel_' + 'x'.repeat(29) && !!koerper['rpc/eingang_token_erzeugen'], 'Einstellungen: Schlüssel erzeugt und einmal angezeigt')
    await einstellungen.screenshot({ path: join(AUSGABE, 'e2e-optionen.png'), fullPage: true })
  }

  pruefe(konsolenfehler.length === 0, `keine Konsolenfehler${konsolenfehler.length ? `: ${konsolenfehler.join(' | ')}` : ''}`)
} finally {
  await context.close()
  rmSync(profilDir, { recursive: true, force: true })
}

console.log(fehler === 0 ? 'E2E bestanden.' : `E2E: ${fehler} Fehler.`)
process.exit(fehler === 0 ? 0 : 1)
