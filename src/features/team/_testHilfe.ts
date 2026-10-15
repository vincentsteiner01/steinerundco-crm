// Test-Hilfen Team: synthetische Fixtures (keine echten Personen) für Do 15.10.2026, KW 42, und eine Render-Hülle mit Router +
// QueryClient. Der supabase-Mock mit echten Filtern kommt aus features/kpis/_testHilfe (eq/in/gte/lte/lt/range/limit).
// Hinweis: `order` sortiert im Mock nicht – Aktivitäten stehen deshalb schon absteigend nach occurred_at.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { Tabellen } from '@/features/kpis/_testHilfe'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'

export { MEMBER_M, MEMBER_V }
export const JETZT = new Date('2026-10-15T11:30:00+02:00')
export const LEAD_1 = '10000000-0000-4000-8000-000000000091'
export const LEAD_2 = '10000000-0000-4000-8000-000000000092'

type Zeile = Record<string, unknown>

const ev = (member_id: string, day: string, metric: string, value: number, period = 'tag', source = 'ereignis') => ({
  member_id,
  day,
  metric,
  value,
  period,
  source,
})

/** v_metric_events Oktober 2026: Vincent mit Sheet-Monatswerten + Tageszähler, Mike mit Ereignissen. */
export const METRIK_ZEILEN: Zeile[] = [
  ev(MEMBER_V, '2026-10-01', 'vernetzungen_versendet', 305, 'monat', 'zaehler'),
  ev(MEMBER_V, '2026-10-01', 'dm_beantwortet', 19, 'monat', 'zaehler'),
  ev(MEMBER_V, '2026-10-03', 'erstgespraeche_vereinbart', 1),
  ev(MEMBER_V, '2026-10-12', 'gespraeche_eroeffnet', 17, 'tag', 'zaehler'),
  ev(MEMBER_M, '2026-10-08', 'dm_beantwortet', 1),
  ev(MEMBER_M, '2026-10-13', 'vernetzungen_angenommen', 2),
  ev(MEMBER_M, '2026-10-14', 'gespraeche_eroeffnet', 3),
  ev(MEMBER_M, '2026-10-14', 'anrufe', 5),
  ev(MEMBER_M, '2026-10-14', 'anrufe_erreicht', 2),
]

const lead = (id: string) =>
  id === LEAD_1
    ? {
        full_name: 'Test Person 91',
        company_name: 'Windparkentwicklung Norddeutschland Projektgesellschaft mbH',
        deleted_at: null,
      }
    : { full_name: 'Test Person 92', company_name: null, deleted_at: null }

const akt = (id: number, member_id: string | null, type: string, occurred_at: string, patch: Zeile = {}): Zeile => ({
  id,
  lead_id: patch.lead_id ?? LEAD_1,
  member_id,
  channel: 'linkedin',
  type,
  occurred_at,
  created_at: occurred_at,
  source: 'app',
  template_id: null,
  outcome: null,
  reply_label: null,
  enrollment_id: null,
  step_id: null,
  email_id: null,
  note: null,
  metadata: {},
  kpi_relevant: true,
  lead: lead((patch.lead_id as string | undefined) ?? LEAD_1),
  ...patch,
})

/** Absteigend nach occurred_at (der Mock sortiert nicht). */
export const AKTIVITAETEN: Zeile[] = [
  akt(10, MEMBER_M, 'nachricht_gesendet', '2026-10-15T08:15:00.000Z', { lead_id: LEAD_2, enrollment_id: 'en2' }),
  akt(9, MEMBER_V, 'gespraech_eroeffnet', '2026-10-15T07:05:00.000Z', { template_id: 't-opener' }),
  akt(5, null, 'import', '2026-10-15T06:00:00.000Z', { channel: 'sonstiges', source: 'import_sheet' }),
  akt(8, MEMBER_V, 'stage_wechsel', '2026-10-14T15:00:00.000Z', {
    channel: 'sonstiges',
    metadata: { from: 'vernetzt', to: 'gespraech_eroeffnet' },
  }),
  akt(7, MEMBER_M, 'nachricht_erhalten', '2026-10-12T09:00:00.000Z', {
    lead_id: LEAD_2,
    reply_label: 'interessiert',
    source: 'import_sheet',
  }),
  akt(6, MEMBER_M, 'nachricht_gesendet', '2026-10-05T09:00:00.000Z', { lead_id: LEAD_2, source: 'import_sheet' }),
]

const q = (member_id: string, section: string, n: number): Zeile[] =>
  Array.from({ length: n }, (_, i) => ({
    member_id,
    section,
    item_kind: section === 'antworten' ? 'antworten' : 'sequenz_schritt',
    item_id: `${member_id}-${section}-${i}`,
    lead_id: LEAD_1,
    channel: 'linkedin',
  }))

export function tabellen(ueberschreiben: Partial<Tabellen> = {}): Tabellen {
  return {
    members: [
      // echte Daten seit Runde 2: Kürzel „VS“ – angezeigt wird der Vorname
      { id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent', short_name: 'VS' },
      { id: MEMBER_M, email: 'mike@steinerundco.de', display_name: 'Mike', short_name: 'Mike' },
    ],
    settings: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })),
    templates: [{ id: 't-opener', key: 'vorlage_eroeffnung', name: 'Eröffnung V1', channel: 'linkedin', phase: 'x' }],
    v_metric_events: METRIK_ZEILEN,
    activities: AKTIVITAETEN,
    v_today_queue: [
      ...q(MEMBER_V, 'antworten', 2),
      ...q(MEMBER_V, 'ueberfaellig', 3),
      ...q(MEMBER_M, 'heute', 1),
      ...q(MEMBER_M, 'ueberfaellig', 4),
    ],
    ...ueberschreiben,
  }
}

export function rendern(start = '/team') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/team', lazy: () => import('./TeamSeite'), HydrateFallback: () => null },
      { path: '/heute', element: createElement('p', { 'data-testid': 'heute' }, 'Heute') },
      { path: '/kpis', element: createElement('p', { 'data-testid': 'kpis' }, 'KPIs') },
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
