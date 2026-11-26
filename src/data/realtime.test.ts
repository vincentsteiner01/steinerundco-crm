// BAUPLAN § 3.1.6: Invalidierungs-Tabelle (Publikation, seit Migration 13 mit Umsatz) + Kanal crm:sync + Status → uiStore.
// Neustart 25.11.2026: die Realtime-Toasts (Übergabe, Termin) sind entfallen – geprüft wird, dass keiner mehr erscheint.
// 26.11.2026: Änderungen an `leads` laden auch die KPIs neu (Board-Züge ändern die Zahlen des KPI-Reiters).
// 26.11.2026: Reiter „Ziele“ (OKR) – vier Tabellen mehr; sie laden OKR_KEY neu, außer der Reiter schreibt gerade selbst.
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
import { OKR_KEY, OKR_SCHREIBEN } from './okr'
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
    leads: [qk.leads.all, qk.leads.detail(L), qk.queue.all, qk.nav, qk.kpis.all],
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
    emails: [qk.emails.lead(L), ['emails', 'zeitraum'], qk.queue.all, qk.kpis.all],
    daily_counters: [['counters'], qk.kpis.all],
    templates: [qk.templates.all],
    settings: [qk.settings],
    contracts: [qk.umsatz],
    payments: [qk.umsatz],
    okr_ziele: [OKR_KEY],
    okr_ergebnisse: [OKR_KEY],
    okr_eintraege: [OKR_KEY],
    okr_todos: [OKR_KEY],
  }

  it('deckt genau die Tabellen der Publikation ab', () => {
    expect([...REALTIME_TABELLEN].sort()).toEqual(Object.keys(faelle).sort())
  })

  for (const t of Object.keys(faelle) as RealtimeTabelle[]) {
    it(`${t}`, () => {
      expect(invalidierungsKeys(t, { id: L, lead_id: L })).toEqual(faelle[t])
    })
  }

  it('Reiter „Ziele“: die vier okr_-Tabellen stehen in der Liste und laden genau OKR_KEY neu – auch ohne Zeile', () => {
    const okr = ['okr_ziele', 'okr_ergebnisse', 'okr_eintraege', 'okr_todos'] as const
    expect(REALTIME_TABELLEN.filter((t) => t.startsWith('okr_'))).toEqual(okr)
    expect(REALTIME_TABELLEN).toHaveLength(17)
    expect(OKR_KEY).toEqual(['okr'])
    for (const t of okr) expect(invalidierungsKeys(t, {}), t).toEqual([OKR_KEY])
  })

  it('ohne lead_id (DELETE mit leerem old) fällt auf Präfixe zurück', () => {
    expect(invalidierungsKeys('tasks', {})).toEqual([['tasks'], qk.queue.all, qk.nav, qk.leads.telefon])
    expect(invalidierungsKeys('leads', {})).toEqual([qk.leads.all, qk.queue.all, qk.nav, qk.kpis.all])
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

  // 26.11.2026: Der KPI-Reiter zählt aus dem Board. Verschiebt die andere Person eine Karte, müssen die Zahlen bei mir nachziehen.
  it('ein Board-Zug (leads) lädt jede KPI-Abfrage neu – das Board selbst bleibt beim eigenen Schreiben außen vor', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const kpiZeilen = [...qk.kpis.all, 'tage', 'team', '2026-11-01', '2026-11-30']
    const tageszaehler = [...qk.kpis.all, 'tageszaehler', ME, '2026-11-26']
    qc.setQueryData(kpiZeilen, [])
    qc.setQueryData(tageszaehler, { versendet: null, angenommen: null })
    qc.setQueryData(BOARD_KEY, [])
    const zug = qc.getMutationCache().build(qc, {
      mutationKey: BOARD_SCHREIBEN,
      networkMode: 'always',
      mutationFn: () => new Promise<void>(() => {}),
    })
    void zug.execute(undefined)
    const b = invalidierungsBuendler(qc, 400, 2000)
    b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: L, board_liste: 'gespraech' }, alt: {} })
    vi.advanceTimersByTime(400)
    expect(qc.getQueryState(kpiZeilen)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(tageszaehler)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(BOARD_KEY)?.isInvalidated).toBe(false)
    qc.getMutationCache().clear()
    b.stop()
  })

  // „E-Mails gesendet“ und „Antworten“ des KPI-Reiters zählen aus crm.emails – auch ohne Lead an der Mail
  it('eine gesendete oder eingegangene E-Mail lädt die KPI-Abfragen neu', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const kpiZeilen = [...qk.kpis.all, 'tage', ME, '2026-11-01', '2026-11-30']
    qc.setQueryData(kpiZeilen, [])
    const b = invalidierungsBuendler(qc, 400, 2000)
    b.add({ tabelle: 'emails', eventType: 'INSERT', neu: { id: 'm1', direction: 'in' }, alt: {} })
    vi.advanceTimersByTime(400)
    expect(qc.getQueryState(kpiZeilen)?.isInvalidated).toBe(true)
    expect(invalidierungsKeys('emails', {})).toContainEqual(qk.kpis.all)
    b.stop()
  })

  // 26.11.2026: Reiter „Ziele“. Was die andere Person zählt, abhakt oder ändert, erscheint bei mir von selbst.
  it('jede Änderung an einer der vier okr_-Tabellen lädt die Ziele neu – sonst nichts', () => {
    vi.useFakeTimers()
    const veraltet = (qc: QueryClient, key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated
    const ereignisse = [
      { tabelle: 'okr_ziele', eventType: 'UPDATE', neu: { id: 'z1', titel: 'Sales' }, alt: {} },
      { tabelle: 'okr_ergebnisse', eventType: 'INSERT', neu: { id: 'e1', ziel_id: 'z1' }, alt: {} },
      {
        tabelle: 'okr_eintraege',
        eventType: 'UPDATE',
        neu: { ergebnis_id: 'e1', member_id: ANDERE, wert: 2 },
        alt: {},
      },
      { tabelle: 'okr_todos', eventType: 'DELETE', neu: {}, alt: { id: 't1', ergebnis_id: 'e1' } },
    ] as const
    for (const e of ereignisse) {
      const qc = new QueryClient()
      const kpiZeilen = [...qk.kpis.all, 'tage', 'team', '2026-11-01', '2026-11-30']
      qc.setQueryData(OKR_KEY, { ziele: [], ergebnisse: [], eintraege: [], todos: [] })
      qc.setQueryData(kpiZeilen, [])
      qc.setQueryData(BOARD_KEY, [])
      const b = invalidierungsBuendler(qc, 400, 2000)
      b.add(e)
      expect(veraltet(qc, OKR_KEY), e.tabelle).toBe(false) // gebündelt: erst nach der Ruhezeit
      vi.advanceTimersByTime(400)
      expect(veraltet(qc, OKR_KEY), e.tabelle).toBe(true)
      expect(veraltet(qc, kpiZeilen), e.tabelle).toBe(false)
      expect(veraltet(qc, BOARD_KEY), e.tabelle).toBe(false)
      b.stop()
    }
  })

  // Wie beim Board: Das Ereignis zum ersten Klick auf +1 lüde die Ziele neu, während der zweite Klick noch unterwegs ist –
  // der Zähler spränge kurz zurück. Solange der Reiter schreibt, wartet Realtime; der letzte Schreibvorgang lädt selbst neu.
  it('schreibt der Reiter „Ziele“ gerade, bleiben die Ziele außen vor – alles andere lädt neu; danach wieder mit Zielen', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const kpiZeilen = [...qk.kpis.all, 'tage', 'team', '2026-11-01', '2026-11-30']
    qc.setQueryData(OKR_KEY, { ziele: [], ergebnisse: [], eintraege: [], todos: [] })
    qc.setQueryData(kpiZeilen, [])
    qc.setQueryData(BOARD_KEY, [])
    const veraltet = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated
    const b = invalidierungsBuendler(qc, 400, 2000)
    const zaehlen = qc.getMutationCache().build(qc, {
      mutationKey: OKR_SCHREIBEN,
      networkMode: 'always',
      mutationFn: () => new Promise<void>(() => {}),
    })
    void zaehlen.execute(undefined)
    b.add({
      tabelle: 'okr_eintraege',
      eventType: 'INSERT',
      neu: { ergebnis_id: 'e1', member_id: ME, wert: 1 },
      alt: {},
    })
    b.add({ tabelle: 'okr_todos', eventType: 'UPDATE', neu: { id: 't1', ergebnis_id: 'e1' }, alt: {} })
    // ein Board-Zug der anderen Person in derselben Welle: Board und KPIs laden wie immer
    b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: L, board_liste: 'gespraech' }, alt: {} })
    vi.advanceTimersByTime(400)
    expect(veraltet(OKR_KEY)).toBe(false)
    expect(veraltet(kpiZeilen)).toBe(true)
    expect(veraltet(BOARD_KEY)).toBe(true)

    // der Schreibvorgang ist durch: das nächste Ereignis lädt die Ziele wieder neu
    qc.getMutationCache().clear()
    b.add({
      tabelle: 'okr_eintraege',
      eventType: 'UPDATE',
      neu: { ergebnis_id: 'e1', member_id: ANDERE, wert: 3 },
      alt: {},
    })
    vi.advanceTimersByTime(400)
    expect(veraltet(OKR_KEY)).toBe(true)
    b.stop()
  })

  it('Board und Ziele warten getrennt: ein Board-Zug hält die Ziele nicht auf, ein Klick im Reiter „Ziele“ das Board nicht', () => {
    vi.useFakeTimers()
    const haengt = { networkMode: 'always', mutationFn: () => new Promise<void>(() => {}) } as const
    const welle = (mutationKey: readonly string[]) => {
      const qc = new QueryClient()
      qc.setQueryData(OKR_KEY, { ziele: [], ergebnisse: [], eintraege: [], todos: [] })
      qc.setQueryData(BOARD_KEY, [])
      void qc
        .getMutationCache()
        .build(qc, { mutationKey, ...haengt })
        .execute(undefined)
      const b = invalidierungsBuendler(qc, 400, 2000)
      b.add({ tabelle: 'okr_ziele', eventType: 'UPDATE', neu: { id: 'z1' }, alt: {} })
      b.add({ tabelle: 'leads', eventType: 'UPDATE', neu: { id: L }, alt: {} })
      vi.advanceTimersByTime(400)
      const stand = {
        ziele: qc.getQueryState(OKR_KEY)?.isInvalidated,
        board: qc.getQueryState(BOARD_KEY)?.isInvalidated,
      }
      qc.getMutationCache().clear()
      b.stop()
      return stand
    }
    expect(welle(BOARD_SCHREIBEN)).toEqual({ ziele: true, board: false })
    expect(welle(OKR_SCHREIBEN)).toEqual({ ziele: false, board: true })
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
