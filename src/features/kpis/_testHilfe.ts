// Test-Hilfen M5: supabase-Mock mit echten Filtern (eq/gte/lte/lt/in auf den Fixture-Zeilen, range, single), synthetische
// Fixtures für Oktober 2026 (BAUPLAN § 1.5 Nr. 30, § 7.2 Referenzwerte), Render-Hülle mit Router + QueryClient.
// `.ts` statt `.tsx` (createElement): Lint-Regel react/only-export-components gilt nur für JSX-Dateien.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { kette, supabaseMock } from '@/test/supabaseMock'

type Zeile = Record<string, unknown>
export type Tabellen = Record<string, Zeile[]>

/** Kette, die Filter wirklich anwendet (eq, in, gte, lte, lt, gt) und `range`/`limit`/`single` respektiert. */
export function filterKette(zeilen: Zeile[]) {
  const k = kette({ data: zeilen, error: null })
  const filter: ((z: Zeile) => boolean)[] = []
  let von = 0
  let bis = Infinity
  const f = (fn: (z: Zeile) => boolean) => {
    filter.push(fn)
    return k
  }
  k['eq'] = vi.fn((feld: string, wert: unknown) => f((z) => z[feld] === wert))
  k['in'] = vi.fn((feld: string, werte: unknown[]) => f((z) => werte.includes(z[feld])))
  k['gte'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') >= wert))
  k['lte'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') <= wert))
  k['lt'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') < wert))
  k['gt'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') > wert))
  k['range'] = vi.fn((a: number, b: number) => {
    von = a
    bis = b
    return k
  })
  k['limit'] = vi.fn((n: number) => {
    bis = von + n - 1
    return k
  })
  const ergebnis = () => zeilen.filter((z) => filter.every((fn) => fn(z))).slice(von, bis + 1)
  k['then'] = (res: (a: { data: unknown; error: null }) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data: ergebnis(), error: null }).then(res, rej)
  k['single'] = vi.fn(async () => ({ data: ergebnis()[0] ?? null, error: null }))
  k['maybeSingle'] = vi.fn(async () => ({ data: ergebnis()[0] ?? null, error: null }))
  return k
}

/** Tabellen, deren Abfragen mit einem PostgREST-Fehler antworten (Fehlerzustand). */
export const FEHLER = new Set<string>()

export function fehlerKette(meldung = 'kaputt') {
  const k = kette({ data: null, error: { message: meldung } })
  const antwort = { data: null, error: { message: meldung } }
  k['then'] = (res: (a: typeof antwort) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(antwort).then(res, rej)
  k['single'] = vi.fn(async () => antwort)
  k['maybeSingle'] = vi.fn(async () => antwort)
  return k
}

/**
 * Mock-Modul für `vi.mock('@/data/supabase', …)`. Hinweis: `@/data/supabase` im Test NICHT statisch importieren (die Seite lädt
 * dann nicht mehr – Modulreihenfolge mit dem asynchronen Factory); `await import('@/data/supabase')` nach dem Rendern geht.
 */
export function supabaseMitTabellen(tabellen: () => Tabellen) {
  const basis = supabaseMock()
  const from = vi.fn((tabelle: string) =>
    FEHLER.has(tabelle) ? fehlerKette() : filterKette(tabellen()[tabelle] ?? []),
  )
  return { ...basis, supabase: { ...basis.supabase, from, schema: vi.fn(() => ({ from })) } }
}

export const HEUTE = '2026-10-14'
export const JETZT = new Date('2026-10-14T09:41:00+02:00')

const ev = (member_id: string, day: string, metric: string, value: number, period: 'tag' | 'monat' = 'tag') => ({
  member_id,
  day,
  metric,
  value,
  source: 'zaehler',
  period,
})

/** v_metric_events Okt/Sept 2026 (Vincent) + Mike (§ 7.2 Referenzwerte, gekürzt). */
export const METRIC_EVENTS: Zeile[] = [
  // Vincent Oktober: Sheet-Monatswerte + Tageswerte Gespräche eröffnet (28/9/28/17 → 82)
  ev(MEMBER_V, '2026-10-01', 'vernetzungen_versendet', 305, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'vernetzungen_angenommen', 93, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'ausstehend', 212, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'dm_beantwortet', 19, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'gespraeche_eroeffnet', 28),
  ev(MEMBER_V, '2026-10-02', 'gespraeche_eroeffnet', 9),
  ev(MEMBER_V, '2026-10-03', 'gespraeche_eroeffnet', 28),
  ev(MEMBER_V, '2026-10-12', 'gespraeche_eroeffnet', 17),
  { ...ev(MEMBER_V, '2026-10-12', 'erstgespraeche', 1), source: 'ereignis' },
  { ...ev(MEMBER_V, '2026-10-05', 'erstgespraeche_vereinbart', 1), source: 'ereignis' },
  { ...ev(MEMBER_V, '2026-10-09', 'erstgespraeche_vereinbart', 1), source: 'ereignis' },
  // Vincent September (Vorperiode)
  ev(MEMBER_V, '2026-09-01', 'vernetzungen_versendet', 288, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'vernetzungen_angenommen', 55, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'gespraeche_eroeffnet', 51, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'dm_beantwortet', 10, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'erstgespraech_gepitcht', 1, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'erstgespraeche', 1, 'monat'),
  // Mike Oktober (Ereignisse)
  { ...ev(MEMBER_M, '2026-10-06', 'gespraeche_eroeffnet', 4), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'anrufe', 12), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'anrufe_erreicht', 4), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'entscheider_gespraeche', 2), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'termine_telefon', 1), source: 'ereignis' },
]

const funnel = (member_id: string, month_key: string, w: Zeile): Zeile => ({
  member_id,
  month: `${month_key}-01`,
  month_key,
  vernetzungen_versendet: 0,
  vernetzungen_angenommen: 0,
  ausstehend: 0,
  gespraeche_eroeffnet: 0,
  dm_beantwortet: 0,
  erstgespraech_gepitcht: 0,
  erstgespraeche_vereinbart: 0,
  erstgespraeche: 0,
  strategiegespraeche: 0,
  kunden_gewonnen: 0,
  erstgespraech_no_show: 0,
  erstgespraech_abgesagt: 0,
  strategiegespraech_no_show: 0,
  strategiegespraech_abgesagt: 0,
  anrufe: 0,
  anrufe_erreicht: 0,
  entscheider_gespraeche: 0,
  termine_telefon: 0,
  emails_gesendet: 0,
  annahme_quote: null,
  antwort_quote: null,
  pitch_quote: null,
  erstgespraech_quote: null,
  strategiegespraech_quote: null,
  kunden_quote: null,
  connect_rate: null,
  entscheider_quote: null,
  termine_pro_100_anrufe: null,
  ...w,
})

export const FUNNEL_MONATLICH: Zeile[] = [
  funnel(MEMBER_V, '2026-10', {
    vernetzungen_versendet: 305,
    vernetzungen_angenommen: 93,
    ausstehend: 212,
    gespraeche_eroeffnet: 82,
    dm_beantwortet: 19,
    erstgespraeche_vereinbart: 2,
    erstgespraeche: 1,
    annahme_quote: 0.3049,
    antwort_quote: 0.2317,
    pitch_quote: 0,
  }),
  funnel(MEMBER_V, '2026-09', {
    vernetzungen_versendet: 288,
    vernetzungen_angenommen: 55,
    gespraeche_eroeffnet: 51,
    dm_beantwortet: 10,
    erstgespraech_gepitcht: 1,
    erstgespraeche: 1,
    annahme_quote: 0.191,
    antwort_quote: 0.1961,
    pitch_quote: 0.1,
    erstgespraech_quote: 1,
  }),
  funnel(MEMBER_M, '2026-10', {
    gespraeche_eroeffnet: 4,
    anrufe: 12,
    anrufe_erreicht: 4,
    entscheider_gespraeche: 2,
    termine_telefon: 1,
    connect_rate: 0.3333,
    entscheider_quote: 0.1667,
    termine_pro_100_anrufe: 8.33,
  }),
]

const tagZeile = (member_id: string, day: string, w: Zeile): Zeile => ({
  member_id,
  day,
  week_start: day,
  month_key: day.slice(0, 7),
  vernetzungen_versendet: 0,
  vernetzungen_angenommen: 0,
  gespraeche_eroeffnet: 0,
  dm_beantwortet: 0,
  erstgespraech_gepitcht: 0,
  erstgespraeche: 0,
  strategiegespraeche: 0,
  anrufe: 0,
  anrufe_erreicht: 0,
  entscheider_gespraeche: 0,
  termine_telefon: 0,
  emails_gesendet: 0,
  ...w,
})

/** v_daily_activity Oktober 2026: 01.10. 28 · 02.10. 9 · 03.10. 28 · 12.10. 17 (Vincent), Mike 06.10. */
export const DAILY: Zeile[] = [
  tagZeile(MEMBER_V, '2026-10-01', { gespraeche_eroeffnet: 28, vernetzungen_versendet: 40 }),
  tagZeile(MEMBER_V, '2026-10-02', { gespraeche_eroeffnet: 9 }),
  tagZeile(MEMBER_V, '2026-10-03', { gespraeche_eroeffnet: 28 }),
  tagZeile(MEMBER_V, '2026-10-12', { gespraeche_eroeffnet: 17, dm_beantwortet: 3 }),
  tagZeile(MEMBER_M, '2026-10-06', { gespraeche_eroeffnet: 4, anrufe: 12, anrufe_erreicht: 4 }),
]

export const LEAD_A = '10000000-0000-4000-8000-000000000081'
export const LEAD_B = '10000000-0000-4000-8000-000000000082'

export function tabellen(ueberschreiben: Partial<Tabellen> = {}): Tabellen {
  return {
    members: [
      {
        id: MEMBER_V,
        email: 'vincent@steinerundco.de',
        display_name: 'Vincent',
        // echte Daten seit Runde 2: Kürzel „VS“ – angezeigt wird der Vorname
        short_name: 'VS',
        preferences: {},
      },
      { id: MEMBER_M, email: 'mike@steinerundco.de', display_name: 'Mike', short_name: 'Mike', preferences: {} },
    ],
    settings: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })),
    v_metric_events: METRIC_EVENTS,
    v_funnel_monthly: FUNNEL_MONATLICH,
    v_daily_activity: DAILY,
    v_antwortzeit: [
      {
        member_id: MEMBER_V,
        lead_id: LEAD_A,
        inbound_at: '2026-10-05T10:00:00Z',
        outbound_at: '2026-10-06T10:00:00Z',
        werktage: 1,
      },
      {
        member_id: MEMBER_V,
        lead_id: LEAD_B,
        inbound_at: '2026-10-07T10:00:00Z',
        outbound_at: '2026-10-09T10:00:00Z',
        werktage: 2,
      },
    ],
    daily_counters: [
      {
        member_id: MEMBER_V,
        date: '2026-10-12',
        metric: 'vernetzungen_versendet',
        period: 'tag',
        source: 'manuell',
        value: 30,
      },
    ],
    calls: [
      {
        id: 'c1',
        member_id: MEMBER_M,
        direction: 'out',
        started_at: '2026-10-06T09:00:00Z',
        outcome: 'dm_interest',
        duration_sec: 180,
        corrected: false,
      },
      {
        id: 'c2',
        member_id: MEMBER_M,
        direction: 'out',
        started_at: '2026-10-06T09:30:00Z',
        outcome: 'no_answer',
        duration_sec: 5,
        corrected: false,
      },
      {
        id: 'c3',
        member_id: MEMBER_M,
        direction: 'out',
        started_at: '2026-10-06T10:00:00Z',
        outcome: 'meeting_booked',
        duration_sec: 300,
        corrected: false,
      },
    ],
    call_outcome_defs: [
      { outcome: 'dm_interest', label: 'Entscheider – Interesse', is_connect: true, is_dm: true, sort_order: 1 },
      { outcome: 'meeting_booked', label: 'Termin gebucht', is_connect: true, is_dm: true, sort_order: 2 },
      { outcome: 'no_answer', label: 'Nicht erreicht', is_connect: false, is_dm: false, sort_order: 3 },
    ],
    emails: [
      { id: 'e1', member_id: MEMBER_V, direction: 'out', sent_at: '2026-10-08T08:00:00Z', status: 'replied' },
      { id: 'e2', member_id: MEMBER_V, direction: 'out', sent_at: '2026-10-09T08:00:00Z', status: 'sent' },
    ],
    activities: [
      {
        id: 1,
        lead_id: LEAD_A,
        member_id: MEMBER_V,
        channel: 'linkedin',
        type: 'gespraech_eroeffnet',
        occurred_at: '2026-10-01T08:00:00Z',
        template_id: 't-opener',
        outcome: null,
        reply_label: null,
        enrollment_id: 'en1',
        step_id: 'st1',
      },
      {
        id: 2,
        lead_id: LEAD_A,
        member_id: MEMBER_V,
        channel: 'linkedin',
        type: 'nachricht_erhalten',
        occurred_at: '2026-10-05T10:00:00Z',
        template_id: null,
        outcome: null,
        reply_label: 'interessiert',
        enrollment_id: null,
        step_id: null,
      },
      {
        id: 3,
        lead_id: LEAD_B,
        member_id: MEMBER_V,
        channel: 'email',
        type: 'widerspruch',
        occurred_at: '2026-10-09T10:00:00Z',
        template_id: null,
        outcome: null,
        reply_label: null,
        enrollment_id: null,
        step_id: null,
      },
    ],
    linkedin_connections: [
      {
        id: 'lc1',
        lead_id: LEAD_A,
        member_id: MEMBER_V,
        requested_at: '2026-10-01T07:00:00Z',
        accepted_at: '2026-10-03T07:00:00Z',
        status: 'angenommen',
        note_variant: 'ohne',
        kpi_relevant: true,
      },
      {
        id: 'lc2',
        lead_id: LEAD_B,
        member_id: MEMBER_V,
        requested_at: '2026-10-02T07:00:00Z',
        accepted_at: null,
        status: 'ausstehend',
        note_variant: 'note_v1',
        kpi_relevant: true,
      },
    ],
    v_template_performance: [
      {
        template_id: 't-opener',
        key: 'vorlage_eroeffnung',
        name: 'Eröffnung V1',
        channel: 'linkedin',
        phase: 'eroeffnung',
        active: true,
        gesendet: 82,
        beantwortet: 19,
        termine: 1,
        antwort_quote: 0.2317,
        termin_quote: 0.0122,
        zuletzt_verwendet: '2026-10-12T08:00:00Z',
      },
      {
        template_id: 't-leer',
        key: 'vorlage_nie',
        name: 'Nie gesendet',
        channel: 'linkedin',
        phase: 'pitch',
        active: true,
        gesendet: 0,
        beantwortet: 0,
        termine: 0,
        antwort_quote: null,
        termin_quote: null,
        zuletzt_verwendet: null,
      },
    ],
    v_leads_ohne_bewegung: [
      {
        lead_id: LEAD_B,
        full_name: 'Test Person 82',
        company_name: 'Solar 82 GmbH',
        stage: 'dm_beantwortet',
        owner_id: MEMBER_V,
        last_activity_at: '2026-10-01T08:00:00Z',
        tage_ohne_bewegung: 9,
      },
    ],
    meetings: [
      {
        id: 'm1',
        lead_id: LEAD_A,
        member_id: MEMBER_V,
        type: 'erstgespraech',
        scheduled_at: '2026-10-16T08:00:00Z',
        status: 'geplant',
        booked_at: '2026-10-09T08:00:00Z',
      },
    ],
    sequences: [
      {
        id: 's1',
        key: 'linkedin_a',
        name: 'A',
        channel: 'linkedin',
        active: true,
        sequence_steps: [
          {
            id: 'st1',
            sequence_id: 's1',
            position: 1,
            name: 'Opener',
            kind: 'nachricht',
            delay_days: 0,
            is_opener: true,
          },
          {
            id: 'st2',
            sequence_id: 's1',
            position: 2,
            name: 'Follow-up 1',
            kind: 'nachricht',
            delay_days: 3,
            is_opener: false,
          },
        ],
      },
    ],
    leads: [
      {
        id: LEAD_A,
        full_name: 'Test Person 81',
        company_name: 'Solar 81 GmbH',
        stage: 'erstgespraech_vereinbart',
        owner_id: MEMBER_V,
        updated_at: '2026-10-10T08:00:00Z',
      },
    ],
    ...ueberschreiben,
  }
}

export function rendern(start = '/kpis?zeitraum=2026-10&person=vincent') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      // HydrateFallback wie im App-Router (keine React-Router-Warnung beim ersten Lazy-Laden)
      { path: '/kpis', lazy: () => import('./KpisSeite'), HydrateFallback: () => null },
      { path: '/leads', element: createElement('p', { 'data-testid': 'leads' }, 'Leads') },
    ],
    { initialEntries: [start] },
  )
  const r = render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(TooltipProvider, null, createElement(RouterProvider, { router })),
    ),
  )
  return { ...r, router, qc }
}

export const taste = (key: string, ziel: Element = document.body) => fireEvent.keyDown(ziel, { key })
