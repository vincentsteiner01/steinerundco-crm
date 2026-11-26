// Test-Daten der Einstellungen: supabase-Antworten je Tabelle (synthetisch), veränderlicher Testzustand, Aufruf-Suche im Mock.
import { vi } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
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
    // Werte der entfallenen Profil-Felder: müssen jedes Speichern überleben (Profil.test)
    linkedin_plan: 'premium',
    linkedin_url: 'https://www.linkedin.com/in/test-vincent/',
    weekly_budget: 150,
    daily_target: 30,
    caller_number_e164: '+4940123456',
    email_address: 'absender@example.test',
    signature: 'Vincent Muster\nMusterfirma',
    calendly_url: null,
    preferences: {
      kanaele: { linkedin: true, telefon: false, email: true },
      realtime_toasts: false,
      onboarding_v1: '2026-10-14',
    },
    created_at: '2026-10-01T09:00:00+02:00',
  },
  {
    id: MEMBER_M,
    email: 'm@example.test',
    display_name: 'Mike',
    // wie in der echten Datenbank: hier steht noch der Vorname statt eines Kürzels (4 Zeichen)
    short_name: 'Mike',
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

/**
 * Veränderlicher Testzustand (der Mock liefert sonst immer dieselben Zeilen, auch nach einem Upsert).
 * `settingsOhne`: Keys, deren Zeile in crm.settings fehlt – oder 'alle' für eine leere Tabelle.
 * `feiertage`: Die Feiertage speichern sofort (25.11.2026) – diesen einen Upsert merkt sich der Mock, damit das Neuladen
 * danach den neuen Stand bringt und nicht wieder die Ausgangsliste.
 * `profil`: ebenso der Upsert der eigenen member_profiles-Zeile – `members` liefert ihn beim Neuladen zurück.
 * `membersHalt`: solange gesetzt, wartet jede Antwort auf `members` darauf (das Neuladen nach dem Speichern anhalten).
 */
export const testZustand: {
  backup: { last_at: string; by: string } | null
  settingsOhne: readonly string[] | 'alle'
  sperrlisteLeer: boolean
  feiertage: string[] | null
  profil: Record<string, unknown> | null
  membersHalt: Promise<void> | null
} = { backup: null, settingsOhne: [], sperrlisteLeer: false, feiertage: null, profil: null, membersHalt: null }

export function testZustandZuruecksetzen() {
  testZustand.backup = null
  testZustand.settingsOhne = []
  testZustand.sperrlisteLeer = false
  testZustand.feiertage = null
  testZustand.profil = null
  testZustand.membersHalt = null
}

/** Die Mitglieder, wie die Datenbank sie nach einem gemerkten Profil-Upsert liefert. */
function mitgliederJetzt(): Member[] {
  const p = testZustand.profil
  if (!p) return MEMBERS
  return MEMBERS.map((m) =>
    m.id === p.member_id
      ? {
          ...m,
          short_name: p.short_name as string | null,
          signature: p.signature as string | null,
          calendly_url: p.calendly_url as string | null,
        }
      : m,
  )
}

/** Antworten je Tabelle – wird von `vi.mock('@/data/supabase', …)` in den Tests benutzt. */
export function supabaseAntworten() {
  const mock = supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'members':
        return { data: mitgliederJetzt(), error: null }
      case 'settings': {
        const ohne = testZustand.settingsOhne
        const gemerkt = testZustand.feiertage ? [{ key: 'feiertage', value: testZustand.feiertage }] : []
        if (ohne === 'alle') return { data: gemerkt, error: null }
        const s: Record<string, unknown> = testZustand.backup ? { ...SETTINGS, backup: testZustand.backup } : SETTINGS
        return {
          data: [
            ...Object.entries(s)
              .filter(([key]) => !ohne.includes(key) && !(key === 'feiertage' && gemerkt.length > 0))
              .map(([key, value]) => ({ key, value })),
            ...gemerkt,
          ],
          error: null,
        }
      }
      case 'sperrliste':
        return { data: testZustand.sperrlisteLeer ? [] : SPERRLISTE, error: null }
      case 'member_profiles':
        return { data: { member_id: MEMBER_V }, error: null }
      case 'activities':
        return { data: { id: 1, lead_id: SPERRLISTE[0]!.lead_id, type: 'notiz' }, error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
  const from = mock.supabase.from
  const bauen = from.getMockImplementation()
  from.mockImplementation((tabelle: string) => {
    const k = (bauen ? bauen(tabelle) : kette()) as ReturnType<typeof kette>
    if (tabelle === 'settings') {
      const upsert = k['upsert'] as (...a: unknown[]) => unknown
      k['upsert'] = vi.fn((zeile: { key?: string; value?: unknown }, ...rest: unknown[]) => {
        if (zeile?.key === 'feiertage' && Array.isArray(zeile.value)) testZustand.feiertage = zeile.value as string[]
        return upsert(zeile, ...rest)
      })
    }
    if (tabelle === 'member_profiles') {
      const upsert = k['upsert'] as (...a: unknown[]) => unknown
      k['upsert'] = vi.fn((zeile: Record<string, unknown>, ...rest: unknown[]) => {
        testZustand.profil = zeile
        return upsert(zeile, ...rest)
      })
    }
    if (tabelle === 'members' && testZustand.membersHalt) {
      const halt = testZustand.membersHalt
      // die Antwort entsteht erst nach dem Halt – sie trägt dann den Stand von diesem Zeitpunkt
      k['then'] = (res: (a: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        halt.then(() => ({ data: mitgliederJetzt(), error: null })).then(res, rej)
    }
    return k
  })
  return mock
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
