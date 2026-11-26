// BAUPLAN § 3.1.6: Invalidierungs-Tabelle (Publikation, seit Migration 13 mit Umsatz) + Kanal crm:sync + Status → uiStore.
// Neustart 25.11.2026: die Realtime-Toasts (Übergabe, Termin) sind entfallen – geprüft wird, dass keiner mehr erscheint.
import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastUndo: vi.fn(),
  toastFehler: vi.fn(),
  UNDO_MS: 6000,
}))

import * as toasts from '@/components/toast'
import { BOARD_KEY, BOARD_SCHREIBEN } from './boardKeys'
import { qk } from './queryKeys'
import {
  invalidiere,
  invalidierungsBuendler,
  invalidierungsKeys,
  REALTIME_TABELLEN,
  type RealtimeTabelle,
} from './realtime'

const L = '11111111-1111-4111-8111-111111111111'
const ME = '00000000-0000-4000-8000-000000000001'
const ANDERE = '00000000-0000-4000-8000-000000000002'

describe('invalidierungsKeys – Tabelle § 3.1.6 wörtlich', () => {
  const faelle: Record<RealtimeTabelle, unknown[][]> = {
    leads: [qk.leads.all, qk.leads.detail(L), qk.queue.all, qk.nav],
    activities: [
      qk.activities(L),
      ['activities', 'zeitraum'],
      qk.leads.detail(L),
      qk.kpis.all,
      qk.templates.perf,
      [...qk.leads.telefon, 'notizen'],
    ],
    enrollments: [
      qk.enrollments(L),
      ['enrollments', 'kanal'],
      qk.enrollmentsLaufend,
      qk.leads.detail(L),
      qk.queue.all,
      qk.nav,
    ],
    tasks: [qk.tasks.lead(L), ['tasks', 'faellig'], qk.queue.all, qk.nav, qk.leads.telefon],
    meetings: [qk.meetings.lead(L), qk.queue.all, qk.kpis.all, qk.leads.telefon],
    linkedin_connections: [qk.connections.lead(L), qk.queue.all, qk.kpis.all],
    calls: [
      qk.calls.lead(L),
      ['calls', 'letzte'],
      ['calls', 'zeitraum'],
      qk.kpis.all,
      [...qk.leads.telefon, 'notizen'],
    ],
    emails: [qk.emails.lead(L), ['emails', 'zeitraum'], qk.queue.all],
    daily_counters: [['counters'], qk.kpis.all],
    templates: [qk.templates.all],
    settings: [qk.settings],
    contracts: [qk.umsatz],
    payments: [qk.umsatz],
  }

  it('deckt genau die Tabellen der Publikation ab', () => {
    expect([...REALTIME_TABELLEN].sort()).toEqual(Object.keys(faelle).sort())
  })

  for (const t of Object.keys(faelle) as RealtimeTabelle[]) {
    it(`${t}`, () => {
      expect(invalidierungsKeys(t, { id: L, lead_id: L })).toEqual(faelle[t])
    })
  }

  it('ohne lead_id (DELETE mit leerem old) fällt auf Präfixe zurück', () => {
    expect(invalidierungsKeys('tasks', {})).toEqual([['tasks'], qk.queue.all, qk.nav, qk.leads.telefon])
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

describe('invalidierungsBuendler', () => {
  afterEach(() => vi.useRealTimers())

  it('37 Annahmen à 7 Ereignisse → jeder Key einmal, nach der Ruhezeit', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const b = invalidierungsBuendler(qc, 400, 2000)
    for (let i = 0; i < 37; i++) {
      const lead = `lead-${i % 3}`
      b.add({ tabelle: 'linkedin_connections', eventType: 'INSERT', neu: { id: `c${i}`, lead_id: lead }, alt: {} })
      for (let a = 0; a < 3; a++)
        b.add({ tabelle: 'activities', eventType: 'INSERT', neu: { id: `a${i}${a}`, lead_id: lead }, alt: {} })
      b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: lead }, alt: {} })
      b.add({ tabelle: 'enrollments', eventType: 'INSERT', neu: { id: `e${i}`, lead_id: lead }, alt: {} })
      b.add({ tabelle: 'tasks', eventType: 'INSERT', neu: { id: `t${i}`, lead_id: lead }, alt: {} })
    }
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(new Set(keys).size).toBe(keys.length) // keine Doppelten
    expect(keys.filter((k) => k === JSON.stringify(qk.queue.all))).toHaveLength(1)
    expect(keys.filter((k) => k === JSON.stringify(qk.kpis.all))).toHaveLength(1)
  })

  // Abnahme 26.11.2026: Das Ereignis zum ersten Zug lud das Board neu, während der zweite noch unterwegs war – dessen Karte
  // sprang kurz zurück. Solange das Board schreibt, lädt Realtime alles andere neu, das Board nicht.
  it('schreibt das Board gerade, bleibt es außen vor – alles andere unter „leads“ lädt neu; danach wieder mit Board', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const liste = [...qk.leads.all, 'liste']
    qc.setQueryData(BOARD_KEY, [])
    qc.setQueryData(liste, [])
    const veraltet = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated
    const b = invalidierungsBuendler(qc, 400, 2000)
    const zug = qc.getMutationCache().build(qc, {
      mutationKey: BOARD_SCHREIBEN,
      networkMode: 'always',
      mutationFn: () => new Promise<void>(() => {}),
    })
    void zug.execute(undefined)
    b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: L }, alt: {} })
    vi.advanceTimersByTime(400)
    expect(veraltet(liste)).toBe(true)
    expect(veraltet(BOARD_KEY)).toBe(false)

    qc.getMutationCache().clear()
    b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: L }, alt: {} })
    vi.advanceTimersByTime(400)
    expect(veraltet(BOARD_KEY)).toBe(true)
    b.stop()
  })

  it('Dauerfeuer: spätestens nach maxMs wird geladen; stop() verwirft Offenes', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const b = invalidierungsBuendler(qc, 400, 2000)
    for (let t = 0; t < 2000; t += 200) {
      b.add({ tabelle: 'tasks', eventType: 'INSERT', neu: { id: `t${t}`, lead_id: L }, alt: {} })
      vi.advanceTimersByTime(200)
    }
    expect(spy).toHaveBeenCalled()
    spy.mockClear()
    b.add({ tabelle: 'settings', eventType: 'UPDATE', neu: {}, alt: {} })
    b.stop()
    vi.advanceTimersByTime(5000)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useRealtimeSync – Kanal', () => {
  it('abonniert crm:sync mit postgres_changes auf allen Tabellen und setzt den Status', async () => {
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
    // gebündelt: erst nach der Ruhezeit
    expect(spy).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
        qk.tasks.lead(L),
        ['tasks', 'faellig'],
        qk.queue.all,
        qk.nav,
        qk.leads.telefon,
      ]),
    )
    unmount()
    expect(supabase.removeChannel).toHaveBeenCalled()
    expect(useUiStore.getState().realtime).toBe('getrennt')
  })
})

describe('Neustart 25.11.2026: keine Realtime-Toasts mehr', () => {
  it('Übergabe an mich und Termin der anderen Person invalidieren nur noch', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { QueryClientProvider } = await import('@tanstack/react-query')
    const { createElement } = await import('react')
    const { useAuth } = await import('@/features/auth/authStore')
    const { supabase } = await import('@/data/supabase')
    const { useRealtimeSync } = await import('./realtime')
    useAuth.setState({ status: 'mitglied', member: { user_id: ME, email: 'v@x', display_name: 'Vincent' } })
    const qc = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper })
    const k = (
      supabase as unknown as {
        __kanaele: { handler: { filter: { table: string }; cb: (p: unknown) => void }[] }[]
      }
    ).__kanaele.at(-1)!
    k.handler
      .find((h) => h.filter.table === 'leads')!
      .cb({
        eventType: 'UPDATE',
        new: { id: L, owner_id: ME, full_name: 'Petra Probelauf' },
        old: { owner_id: ANDERE },
      })
    k.handler
      .find((h) => h.filter.table === 'meetings')!
      .cb({
        eventType: 'INSERT',
        new: { id: 'm', member_id: ANDERE, lead_id: L, scheduled_at: '2026-11-26T08:00:00Z' },
        old: {},
      })
    await vi.waitFor(() => expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toContainEqual(qk.leads.all))
    for (const t of [toasts.toast, toasts.toastUndo, toasts.toastFehler]) expect(t).not.toHaveBeenCalled()
    unmount()
  })
})
