// Test-Hilfen M2 (leads + pipeline): Render-Hülle (QueryClient + Tooltip + Router + angemeldete Person), Rücksetzen, Tasten.
// Supabase-Ersatz und Fixturen stehen in _supabaseM2.ts (Mock-Fabrik ohne Zyklus). Fixturen synthetisch (BAUPLAN § 3.0 Nr. 9).
import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { DB, MEMBER_V } from './_supabaseM2'
import { TestHuelle } from './_TestOrt'

export {
  aktivitaet,
  DB,
  erstesArg,
  FIRMA_GESPERRT,
  FIRMA_GESPERRT_ID,
  leadMitBezug,
  NEUE_FIRMA_ID,
  MEMBER_M,
  MEMBER_V,
  MEMBERS,
  supabaseM2,
  vollerLead,
  zugriffeMit,
  type Aufruf,
  type Zugriff,
} from './_supabaseM2'

export function zuruecksetzen(): void {
  DB.leads = []
  DB.details = []
  DB.dubletten = []
  DB.suche = []
  DB.activities = []
  DB.companies = []
  DB.sperrliste = []
  DB.tags = []
  DB.importBatches = []
  DB.queue = []
  DB.pipeline = []
  DB.calls = []
  DB.emails = []
  DB.meetings = []
  DB.konflikt = false
  DB.leadsFehler = null
  DB.zugriffe = []
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: MEMBER_V, email: 'vincent@beispiel.de', display_name: 'Vincent Steiner' },
  })
  useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null, peekListe: [] })
  _akkordZuruecksetzen()
  try {
    localStorage.clear()
  } catch {
    /* kein Storage */
  }
}

export function rendern(ui: ReactElement, opts: { route?: string; pfad?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ergebnis = render(createElement(TestHuelle, { ui, qc, route: opts.route, pfad: opts.pfad }))
  return { ...ergebnis, qc }
}

export const taste = (key: string, extra: KeyboardEventInit = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })

/** `⌥<Buchstabe>` wie auf macOS: `event.key` ist ein Sonderzeichen, erkannt wird über `event.code`. */
export const optionTaste = (buchstabe: string, sonderzeichen = '˜') =>
  fireEvent.keyDown(document.body, { key: sonderzeichen, code: `Key${buchstabe.toUpperCase()}`, altKey: true })
