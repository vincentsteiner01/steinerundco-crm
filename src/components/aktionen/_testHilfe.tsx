// Test-Hilfen der Lead-Aktionen: Render-Hülle (QueryClient + TooltipProvider), supabase-Antworten je Tabelle, Aufruf-Suche.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { kette, supabaseMock } from '@/test/supabaseMock'

export const LEAD = vollerLead(1, { owner_id: MEMBER_V, updated_at: '2026-10-14T08:00:00.000Z' })
export const LEAD_FREMD = vollerLead(2, { owner_id: MEMBER_M, updated_at: '2026-10-14T08:00:00.000Z' })
export const AKTIVITAET_ID = 77

/** Antworten je Tabelle – `leads` liefert LEAD (bzw. LEAD_FREMD, wenn `fremd`), `activities` eine frische Trigger-Zeile. */
export function supabaseAntworten(opts: { fremd?: boolean } = {}) {
  const lead = opts.fremd ? LEAD_FREMD : LEAD
  return supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'leads':
        return { data: lead, error: null }
      case 'activities':
        return {
          data: [{ id: AKTIVITAET_ID, lead_id: lead.id, type: 'stage_wechsel', created_at: new Date().toISOString() }],
          error: null,
        }
      case 'members':
        return {
          data: [
            { id: MEMBER_V, display_name: 'Vincent', short_name: 'Vincent', preferences: {} },
            { id: MEMBER_M, display_name: 'Mike', short_name: 'Mike', preferences: {} },
          ],
          error: null,
        }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      case 'templates':
        return {
          data: [
            {
              id: 't1',
              key: 'li_bedarf_ja_v1',
              name: 'Ja (V1)',
              channel: 'linkedin',
              phase: 'bedarfsermittlung',
              body: 'x',
            },
            {
              id: 't2',
              key: 'li_bedarf_nein_mit_grund',
              name: 'Nein (mit Grund)',
              channel: 'linkedin',
              phase: 'bedarfsermittlung',
              body: 'y',
            },
          ],
          error: null,
        }
      case 'enrollments':
        return { data: [{ id: 'e1', lead_id: lead.id, status: 'aktiv', snooze_count: 0 }], error: null }
      case 'tasks':
        return { data: [{ id: 't9', lead_id: lead.id, status: 'offen', snooze_count: 0 }], error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
}

export function rendern(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  )
}

export const taste = (key: string, extra: Record<string, unknown> = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })

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
