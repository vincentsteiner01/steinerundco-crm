// Test-Daten Eingang (synthetisch, erfundene Namen): Zeilen beider Postfächer, Leads für Zuordnung und Suche.
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { supabaseMock } from '@/test/supabaseMock'
import type { EingangZeile } from './logik'

export { MEMBER_M, MEMBER_V }

export const LEAD_A = {
  id: '20000000-0000-4000-8000-0000000000a1',
  full_name: 'Anna Beispielfrau',
  company_name: 'Sonnenstrom Test GmbH',
  stage: 'vernetzt',
  owner_id: MEMBER_V,
  linkedin_url: null,
  deleted_at: null,
}

const basis = {
  quelle: 'gmail_linkedin',
  created_at: '2026-10-15T10:00:00Z',
  linkedin_slug: null,
  text: null,
  ergebnis: null,
  lead_id: null,
  activity_id: null,
}

export const ZEILEN: EingangZeile[] = [
  {
    ...basis,
    id: 'e-unbekannt',
    member_id: MEMBER_V,
    art: 'nachricht',
    status: 'unbekannt',
    empfangen_at: '2026-10-15T09:41:00Z',
    absender_name: 'Bernd Testmann',
    linkedin_slug: 'bernd-testmann-123',
    text: 'Danke für die Nachricht, klingt spannend.',
    ergebnis: 'Kein passender Lead gefunden – bitte zuordnen',
  },
  {
    ...basis,
    id: 'e-fehler',
    member_id: MEMBER_M,
    art: 'annahme',
    status: 'fehler',
    empfangen_at: '2026-10-15T08:00:00Z',
    absender_name: 'Carla Probe',
    ergebnis: 'Firma gesperrt',
  },
  {
    ...basis,
    id: 'e-verarbeitet',
    member_id: MEMBER_V,
    art: 'annahme',
    status: 'verarbeitet',
    empfangen_at: '2026-10-14T16:00:00Z',
    absender_name: 'Anna Beispielfrau',
    lead_id: LEAD_A.id,
    ergebnis: 'Annahme verbucht – Sequenz gestartet',
  },
  {
    ...basis,
    id: 'e-ignoriert',
    member_id: MEMBER_M,
    art: 'sonstiges',
    status: 'ignoriert',
    empfangen_at: '2026-10-14T12:00:00Z',
    absender_name: null,
    ergebnis: 'Keine Aktion nötig',
  },
]

export const MEMBERS = [
  { id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent', short_name: 'VS', linkedin_url: null },
  { id: MEMBER_M, email: 'mike@steinerundco.de', display_name: 'Mike', short_name: 'MM', linkedin_url: null },
]

export const zustand: { zeilen: EingangZeile[]; offen: number } = { zeilen: ZEILEN, offen: 2 }

export function supabaseEingang() {
  return supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'eingang':
        return { data: zustand.zeilen, error: null, count: zustand.offen }
      case 'leads':
        return { data: [LEAD_A], error: null }
      case 'members':
        return { data: MEMBERS, error: null }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
}
