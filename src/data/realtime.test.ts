// BAUPLAN § 3.1.6: Invalidierungs-Tabelle (11 Tabellen) + Kanal crm:sync + Status → uiStore + Realtime-Toast-Regeln.
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({
  toastRealtime: vi.fn(),
  UNDO_MS: 6000,
}))

import { toastRealtime } from '@/components/toast'
import { qk } from './queryKeys'
import {
  _toastBegrenzerZuruecksetzen,
  invalidiere,
  invalidierungsKeys,
  realtimeToast,
  REALTIME_TABELLEN,
  type RealtimeTabelle,
} from './realtime'

const L = '11111111-1111-4111-8111-111111111111'
const ME = '00000000-0000-4000-8000-000000000001'
const ANDERE = '00000000-0000-4000-8000-000000000002'

describe('invalidierungsKeys – Tabelle § 3.1.6 wörtlich', () => {
  const faelle: Record<RealtimeTabelle, unknown[][]> = {
    leads: [qk.leads.all, qk.leads.detail(L), qk.queue.all, qk.nav],
    activities: [qk.activities(L), ['activities', 'zeitraum'], qk.leads.detail(L), qk.kpis.all, qk.templates.perf],
    enrollments: [
      qk.enrollments(L),
      ['enrollments', 'kanal'],
      qk.enrollmentsLaufend,
      qk.leads.detail(L),
      qk.queue.all,
      qk.nav,
    ],
    tasks: [qk.tasks.lead(L), ['tasks', 'faellig'], qk.queue.all, qk.nav],
    meetings: [qk.meetings.lead(L), qk.queue.all, qk.kpis.all],
    linkedin_connections: [qk.connections.lead(L), qk.queue.all, qk.kpis.all],
    calls: [qk.calls.lead(L), ['calls', 'letzte'], ['calls', 'zeitraum'], qk.kpis.all],
    emails: [qk.emails.lead(L), ['emails', 'zeitraum'], qk.queue.all],
    daily_counters: [['counters'], qk.kpis.all],
    templates: [qk.templates.all],
    settings: [qk.settings],
  }

  it('deckt genau die 11 Tabellen der Publikation ab', () => {
    expect([...REALTIME_TABELLEN].sort()).toEqual(Object.keys(faelle).sort())
  })

  for (const t of Object.keys(faelle) as RealtimeTabelle[]) {
    it(`${t}`, () => {
      expect(invalidierungsKeys(t, { id: L, lead_id: L })).toEqual(faelle[t])
    })
  }

  it('ohne lead_id (DELETE mit leerem old) fällt auf Präfixe zurück', () => {
    expect(invalidierungsKeys('tasks', {})).toEqual([['tasks'], qk.queue.all, qk.nav])
    expect(invalidierungsKeys('leads', {})).toEqual([qk.leads.all, qk.queue.all, qk.nav])
  })

  it('invalidiere() ruft invalidateQueries je Key (new ∪ old)', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidiere(qc, { tabelle: 'enrollments', eventType: 'DELETE', neu: {}, alt: { id: 'e', lead_id: L } })
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
      qk.enrollments(L),
      ['enrollments', 'kanal'],
      qk.enrollmentsLaufend,
      qk.leads.detail(L),
      qk.queue.all,
      qk.nav,
    ])
  })
})

describe('useRealtimeSync – Kanal', () => {
  it('abonniert crm:sync mit postgres_changes auf allen 11 Tabellen und setzt den Status', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { QueryClientProvider } = await import('@tanstack/react-query')
    const { createElement } = await import('react')
    const { useAuth } = await import('@/features/auth/authStore')
    const { useUiStore } = await import('@/app/uiStore')
    const { supabase } = await import('@/data/supabase')
    const { useRealtimeSync } = await import('./realtime')
    useAuth.setState({ status: 'mitglied', member: { user_id: ME, email: 'v@x', display_name: 'Vincent' } })
    const qc = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper })
    const kanaele = (
      supabase as unknown as {
        __kanaele: { name: string; handler: { filter: { table: string }; cb: (p: unknown) => void }[] }[]
      }
    ).__kanaele
    expect(kanaele).toHaveLength(1)
    const k = kanaele[0]!
    expect(k.name).toBe('crm:sync')
    expect(k.handler.map((h) => h.filter.table).sort()).toEqual([...REALTIME_TABELLEN].sort())
    expect(useUiStore.getState().realtime).toBe('live')
    k.handler
      .find((h) => h.filter.table === 'tasks')!
      .cb({ eventType: 'UPDATE', new: { id: 't', lead_id: L }, old: {} })
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
      qk.tasks.lead(L),
      ['tasks', 'faellig'],
      qk.queue.all,
      qk.nav,
    ])
    unmount()
    expect(supabase.removeChannel).toHaveBeenCalled()
    expect(useUiStore.getState().realtime).toBe('getrennt')
  })
})

describe('Realtime-Toasts', () => {
  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient()
    qc.setQueryData(qk.members, [
      { id: ME, display_name: 'Vincent', short_name: 'Vincent', preferences: {} },
      { id: ANDERE, display_name: 'Mike', short_name: 'Mike', preferences: {} },
    ])
    vi.mocked(toastRealtime).mockClear()
    _toastBegrenzerZuruecksetzen()
  })
  afterEach(() => vi.useRealTimers())

  it('leads.owner_id → ich: „Mike hat dir … übergeben.“', async () => {
    await realtimeToast(
      qc,
      {
        tabelle: 'leads',
        eventType: 'UPDATE',
        neu: { id: L, owner_id: ME, full_name: 'Test Person 01' },
        alt: { owner_id: ANDERE },
      },
      ME,
    )
    expect(toastRealtime).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toastRealtime).mock.calls[0]?.[0]).toBe('Mike hat dir Test Person 01 übergeben.')
    expect(vi.mocked(toastRealtime).mock.calls[0]?.[2]).toBe(L)
  })

  it('kein Toast, wenn der Lead schon mir gehörte oder an die andere Person geht', async () => {
    await realtimeToast(
      qc,
      { tabelle: 'leads', eventType: 'UPDATE', neu: { id: L, owner_id: ME }, alt: { owner_id: ME } },
      ME,
    )
    await realtimeToast(
      qc,
      { tabelle: 'leads', eventType: 'UPDATE', neu: { id: L, owner_id: ANDERE }, alt: { owner_id: ME } },
      ME,
    )
    expect(toastRealtime).not.toHaveBeenCalled()
  })

  it('meetings-Insert der anderen Person → „Mike: Termin mit … am Fr 16.10.“; eigener Insert nicht', async () => {
    await realtimeToast(
      qc,
      {
        tabelle: 'meetings',
        eventType: 'INSERT',
        neu: { id: 'm', member_id: ANDERE, lead_id: L, scheduled_at: '2026-10-16T08:00:00Z' },
        alt: {},
      },
      ME,
    )
    expect(toastRealtime).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toastRealtime).mock.calls[0]?.[0]).toMatch(/^Mike: Termin mit .* am Fr 16\.10\.$/)
    await realtimeToast(
      qc,
      {
        tabelle: 'meetings',
        eventType: 'INSERT',
        neu: { id: 'm2', member_id: ME, lead_id: L, scheduled_at: '2026-10-16T08:00:00Z' },
        alt: {},
      },
      ME,
    )
    expect(toastRealtime).toHaveBeenCalledTimes(1)
  })

  it('abschaltbar über preferences.realtime_toasts = false', async () => {
    qc.setQueryData(qk.members, [{ id: ME, display_name: 'Vincent', preferences: { realtime_toasts: false } }])
    await realtimeToast(
      qc,
      {
        tabelle: 'leads',
        eventType: 'UPDATE',
        neu: { id: L, owner_id: ME, full_name: 'X' },
        alt: { owner_id: ANDERE },
      },
      ME,
    )
    expect(toastRealtime).not.toHaveBeenCalled()
  })

  it('maximal 2 Realtime-Toasts innerhalb von 6 s', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-14T10:00:00Z') })
    for (let i = 0; i < 4; i++)
      await realtimeToast(
        qc,
        {
          tabelle: 'leads',
          eventType: 'UPDATE',
          neu: { id: `${L}${i}`, owner_id: ME, full_name: 'X' },
          alt: { owner_id: ANDERE },
        },
        ME,
      )
    expect(toastRealtime).toHaveBeenCalledTimes(2)
    vi.setSystemTime(new Date('2026-10-14T10:00:07Z'))
    await realtimeToast(
      qc,
      {
        tabelle: 'leads',
        eventType: 'UPDATE',
        neu: { id: L, owner_id: ME, full_name: 'X' },
        alt: { owner_id: ANDERE },
      },
      ME,
    )
    expect(toastRealtime).toHaveBeenCalledTimes(3)
  })
})
