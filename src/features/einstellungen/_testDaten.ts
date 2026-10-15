// Test-Daten M8: supabase-Antworten je Tabelle (synthetisch), veränderlicher Testzustand, Aufruf-Suche im Mock.
import { vi } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { SEQUENZEN } from '@/test/fixtures/sequenzen'
import { SETTINGS } from '@/test/fixtures/settings'
import { kette, supabaseMock } from '@/test/supabaseMock'
import type { Member, SperrlisteEintrag } from '@/types/domain'

export { MEMBER_M, MEMBER_V }

export const MEMBERS: Member[] = [
  {
    id: MEMBER_V,
    email: 'v@example.test',
    display_name: 'Vincent',
    short_name: 'VS',
    initial: 'V',
    linkedin_plan: 'premium',
    linkedin_url: null,
    weekly_budget: 150,
    daily_target: 30,
    caller_number_e164: '+4940123456',
    email_address: null,
    signature: 'Vincent Steiner\nSteiner & Co.',
    calendly_url: null,
    preferences: { kanaele: { linkedin: true, telefon: false, email: true }, realtime_toasts: true },
    created_at: '2026-10-01T09:00:00+02:00',
  },
  {
    id: MEMBER_M,
    email: 'm@example.test',
    display_name: 'Mike',
    short_name: 'MM',
    initial: 'M',
    linkedin_plan: 'basic',
    linkedin_url: null,
    weekly_budget: 100,
    daily_target: 20,
    caller_number_e164: null,
    email_address: null,
    signature: null,
    calendly_url: null,
    preferences: {},
    created_at: '2026-10-01T09:00:00+02:00',
  },
]

export const SPERRLISTE: SperrlisteEintrag[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Test Gesperrt',
    company: 'Solar 99 GmbH',
    channels: ['linkedin', 'telefon', 'email'],
    // `reason` wie die DB (check widerspruch|abmeldung|bounce|manuell), Freitext in `note`
    reason: 'widerspruch',
    created_at: '2026-10-05T10:00:00+02:00',
    created_by: MEMBER_M,
    email: 'gesperrt@example.test',
    phone_e164: null,
    linkedin_url_norm: 'linkedin.com/in/test-gesperrt',
    lead_id: '10000000-0000-4000-8000-000000000001',
    note: 'Widerspruch per Telefon',
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    name: null,
    company: null,
    channels: ['email'],
    reason: 'manuell',
    created_at: '2026-10-02T10:00:00+02:00',
    created_by: MEMBER_V,
    email: 'info@example.test',
    phone_e164: null,
    linkedin_url_norm: null,
    lead_id: null,
    note: 'Sammeladresse',
  },
]

export const ENROLLMENTS_LAUFEND = [
  { sequence_id: SEQUENZEN[0]!.id, status: 'aktiv' },
  { sequence_id: SEQUENZEN[0]!.id, status: 'pausiert' },
  { sequence_id: SEQUENZEN[4]!.id, status: 'aktiv' },
]

/** Veränderlicher Testzustand (der Mock liefert sonst immer dieselben Zeilen, auch nach einem Upsert). */
export const testZustand: { backup: { last_at: string; by: string } | null } = { backup: null }

/** Antworten je Tabelle – wird von `vi.mock('@/data/supabase', …)` in den Tests benutzt. */
export function supabaseAntworten() {
  return supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'members':
        return { data: MEMBERS, error: null }
      case 'settings': {
        const s = testZustand.backup ? { ...SETTINGS, backup: testZustand.backup } : SETTINGS
        return { data: Object.entries(s).map(([key, value]) => ({ key, value })), error: null }
      }
      case 'sequences':
        return { data: SEQUENZEN.map(({ steps, ...s }) => ({ ...s, sequence_steps: steps })), error: null }
      case 'enrollments':
        return { data: ENROLLMENTS_LAUFEND, error: null }
      case 'sperrliste':
        return { data: SPERRLISTE, error: null }
      case 'member_profiles':
        return { data: { member_id: MEMBER_V }, error: null }
      case 'activities':
        return { data: { id: 1, lead_id: SPERRLISTE[0]!.lead_id, type: 'notiz' }, error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
}

type From = ReturnType<typeof vi.fn> & { mock: { calls: unknown[][]; results: { value: ReturnType<typeof kette> }[] } }

/** Erstes Argument des letzten `tabelle.methode(…)`-Aufrufs, oder null. */
export function letzterAufruf(from: unknown, tabelle: string, methode: string): unknown {
  const f = from as From
  for (let i = f.mock.calls.length - 1; i >= 0; i--) {
    if (f.mock.calls[i]?.[0] !== tabelle) continue
    const k = f.mock.results[i]?.value
    const m = k?.[methode] as { mock: { calls: unknown[][] } } | undefined
    if (m?.mock.calls.length) return m.mock.calls[0]?.[0]
  }
  return null
}

/** Anzahl der `tabelle.methode(…)`-Aufrufe über alle Ketten. */
export function anzahlAufrufe(from: unknown, tabelle: string, methode: string): number {
  const f = from as From
  let n = 0
  for (let i = 0; i < f.mock.calls.length; i++) {
    if (f.mock.calls[i]?.[0] !== tabelle) continue
    const k = f.mock.results[i]?.value
    const m = k?.[methode] as { mock: { calls: unknown[][] } } | undefined
    n += m?.mock.calls.length ?? 0
  }
  return n
}
