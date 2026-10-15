// useAnruf: Parameter je Ergebnis-Taste, Pflichtfelder, send_info setzt Erlaubnis VOR log_call, p_task_id aus dem Rückruf-Task,
// Wrap-up-Text „(Wiederholung n)“, Entwurf in localStorage (BAUPLAN § 3.4 useAnruf.test.ts, T-05/T-08/T-09/T-10/T-15)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_M } from '@/test/fixtures/leads'

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  const lead = h.leadMitBezug(h.LEAD_A)
  return supabaseMock(h.antworten({ leads: { data: lead, error: null } }))
})
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
}))

import { supabase } from '@/data/supabase'
import { kette } from '@/test/supabaseMock'
import { ANRUF_KEY, entwurfLesen, folgeText, useAnruf } from './useAnruf'
import {
  ERGEBNISSE,
  ergebnisNachTaste,
  logCallParameter,
  lokalNachIso,
  pruefeWrapUp,
  WRAPUP_LEER,
  type WrapUpWerte,
} from './ergebnisse'
import { call, leadMitBezug, LEAD_A, TASK_RUECKRUF } from './_testHilfe'

const START = '2026-10-14T08:00:00.000Z'
const def = (t: string) => {
  const d = ergebnisNachTaste(t)
  if (!d) throw new Error(`Taste ${t}`)
  return d
}
const basis = {
  leadId: LEAD_A.id,
  startedAt: START,
  dauerSec: 41,
  notiz: 'Notiz',
  enrollmentId: 'enr-1',
  taskId: null,
  templateId: 'tpl-1',
  toNumber: '+494131220418',
  fromNumber: '+4940999002',
}
const werte = (p: Partial<WrapUpWerte> = {}): WrapUpWerte => ({ ...WRAPUP_LEER, ...p })

describe('logCallParameter – Parameter je Ergebnis-Taste (BAUPLAN § 3.4 Tabelle)', () => {
  it('immer dabei: started/ended/duration/note/enrollment/task/template/direction out', () => {
    const p = logCallParameter({ ...basis, def: def('1'), werte: werte(), taskId: 't-1' })
    expect(p).toMatchObject({
      leadId: LEAD_A.id,
      outcome: 'no_answer',
      note: 'Notiz',
      reachedPerson: 'niemand',
      reachedName: null,
      startedAt: START,
      endedAt: '2026-10-14T08:00:41.000Z',
      durationSec: 41,
      enrollmentId: 'enr-1',
      taskId: 't-1',
      templateId: 'tpl-1',
      toNumber: '+494131220418',
      fromNumber: '+4940999002',
      direction: 'out',
      callbackAt: null,
      meetingAt: null,
      endedReason: null,
    })
  })

  it('5 Zentrale: reached zentrale + Name, Rückruf-Zeitpunkt, Notiz mit Durchwahl/Zeitfenster', () => {
    const p = logCallParameter({
      ...basis,
      def: def('5'),
      werte: werte({
        zentraleName: 'Frau Behrens',
        zentraleDurchwahl: '−12',
        zentraleZeitpunkt: 'morgens vor 11',
        callbackAt: '2026-10-15T10:30',
      }),
    })
    expect(p.reachedPerson).toBe('zentrale')
    expect(p.reachedName).toBe('Frau Behrens')
    expect(p.callbackAt).toBe(lokalNachIso('2026-10-15T10:30'))
    expect(p.note).toBe('Notiz\nZentrale: Frau Behrens · Durchwahl −12 · bester Zeitpunkt: morgens vor 11')
  })

  it('7 Rückruf: p_callback_at Pflicht; 9 Termin: p_meeting_at + Gesprächspartner; 8/0/W Entscheider', () => {
    expect(pruefeWrapUp(def('7'), werte())).toEqual(['callback_at'])
    expect(
      logCallParameter({ ...basis, def: def('7'), werte: werte({ callbackAt: '2026-10-19T10:30' }) }).callbackAt,
    ).toBe('2026-10-19T08:30:00.000Z')
    expect(pruefeWrapUp(def('9'), werte())).toEqual(['gespraechspartner', 'meeting_at'])
    const neun = logCallParameter({
      ...basis,
      def: def('9'),
      werte: werte({ reachedName: 'Lukas Feldhaus', reachedRolle: 'GF', meetingAt: '2026-10-16T10:00' }),
    })
    expect(neun).toMatchObject({
      outcome: 'meeting_booked',
      reachedPerson: 'entscheider',
      reachedName: 'Lukas Feldhaus (GF)',
      meetingAt: '2026-10-16T08:00:00.000Z',
    })
    expect(
      logCallParameter({ ...basis, def: def('8'), werte: werte({ reachedName: 'X', reachedPerson: 'assistenz' }) })
        .reachedPerson,
    ).toBe('assistenz')
    expect(
      logCallParameter({ ...basis, def: def('W'), werte: werte({ reachedName: 'X', callbackAt: '2027-01-14' }) })
        .callbackAt,
    ).toBe(lokalNachIso('2027-01-14', '09:00'))
  })

  it('T-15: 0 ohne Zitat lässt sich nicht speichern; K/Q liefern p_ended_reason mit Vorgabe', () => {
    expect(pruefeWrapUp(def('0'), werte({ reachedName: 'X', callbackAt: '2026-10-19T10:30' }))).toEqual(['zitat'])
    expect(
      pruefeWrapUp(def('0'), werte({ reachedName: 'X', callbackAt: '2026-10-19T10:30', zitat: 'Schicken Sie was' })),
    ).toEqual([])
    expect(logCallParameter({ ...basis, def: def('K'), werte: werte({ reachedName: 'X' }) }).endedReason).toBe(
      'kein_interesse',
    )
    expect(
      logCallParameter({
        ...basis,
        def: def('Q'),
        werte: werte({ reachedName: 'X', endedReason: 'nicht_qualifiziert' }),
      }).endedReason,
    ).toBe('nicht_qualifiziert')
    expect(pruefeWrapUp(def('K'), werte({ reachedName: 'X' }))).toEqual(['ended_reason'])
  })

  it('⌘↵ (ohne Wrap-up) überspringt nur weiche Felder: Gesprächspartner und Grund, nie Datum/Zitat', () => {
    expect(pruefeWrapUp(def('9'), werte(), false)).toEqual(['meeting_at'])
    expect(pruefeWrapUp(def('K'), werte(), false)).toEqual([])
    expect(pruefeWrapUp(def('D'), werte(), false)).toEqual(['zitat'])
  })

  it('D Widerspruch: Zitat landet in p_note (objection_note); Gruppe C ohne Namen bleibt null', () => {
    const p = logCallParameter({ ...basis, def: def('D'), werte: werte({ zitat: 'Nie wieder anrufen' }), notiz: '' })
    expect(p.note).toBe('Widerspruch: ‚Nie wieder anrufen‘')
    expect(p.reachedName).toBeNull()
    expect(ERGEBNISSE.find((e) => e.taste === 'D')?.danger).toBe(true)
  })
})

describe('folgeText', () => {
  const kadenz = { feiertage: ['2026-10-31'], dueTime: '09:00', maxVersuche: 5 }
  it('Wrap-up-Text „(Wiederholung n)“ aus dem Rückruf-Task, sonst nächster Versuch laut Kadenz; Besetzt +45 min', () => {
    expect(folgeText(def('1'), { task: TASK_RUECKRUF, kadenz, versuch: 2 }, START)).toBe(
      'Nächster Rückruf Do 15.10. 10:00 (Wiederholung 1)',
    )
    expect(folgeText(def('3'), { task: null, kadenz, versuch: 1 }, START)).toContain(
      'Fr 16.10. · Versuch 2 von 5 · Slot B',
    )
    expect(folgeText(def('2'), { task: null, kadenz, busyMinuten: 30, versuch: 1 }, START)).toBe('Erneut in 30 min')
    expect(folgeText(def('X'), { task: null, kadenz, versuch: 1 }, START)).toBe('Aufgabe „Telefonnummer recherchieren“')
  })
})

describe('useAnruf (Hook)', () => {
  let qc: QueryClient
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const CALL = call(LEAD_A.id, 'no_answer', { id: 'call-1' })
  const optionen = (patch: Partial<Parameters<typeof useAnruf>[1]> = {}) => ({
    lead: leadMitBezug(LEAD_A, { tasks: [TASK_RUECKRUF] }),
    enrollmentId: null,
    taskId: TASK_RUECKRUF.id,
    task: TASK_RUECKRUF,
    templateId: 'tpl-einstieg',
    fromNumber: '+4940999002',
    kadenz: { dueTime: '09:00', maxVersuche: 5 },
    versuch: 1,
    ...patch,
  })

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    localStorage.clear()
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(supabase.from).mockClear()
    vi.mocked(supabase.rpc).mockImplementation(async () => ({ data: CALL, error: null }))
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    // Mi 14.10.2026 10:00 Berlin – Referenztag der Kadenz-Beispiele (BAUPLAN § 5.3)
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-14T08:00:00.000Z') })
  })

  it('Anrufen legt den Entwurf in localStorage an (überlebt App-Wechsel), Timer läuft, Notiz wird nach 2 s gesichert', async () => {
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen()), { wrapper })
    expect(result.current.laeuft).toBe(false)
    act(() => result.current.anrufen())
    expect(result.current.laeuft).toBe(true)
    expect(entwurfLesen(LEAD_A.id)?.leadId).toBe(LEAD_A.id)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.dauerSec).toBeGreaterThanOrEqual(3)
    act(() => result.current.notizSetzen('Hallo'))
    expect(entwurfLesen(LEAD_A.id)?.notiz).toBe('')
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(entwurfLesen(LEAD_A.id)?.notiz).toBe('Hallo')
    act(() => result.current.dauerKorrigieren(90))
    expect(result.current.dauerSec).toBe(90)
    act(() => result.current.verwerfen())
    expect(result.current.laeuft).toBe(false)
    expect(localStorage.getItem(ANRUF_KEY)).toBeNull()
    vi.useRealTimers()
  })

  it('T-19: Ergebnis 1 aus einem Rückruf-Task gibt p_task_id mit; Toast-Text nennt die Wiederholung', async () => {
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen()), { wrapper })
    act(() => result.current.anrufen())
    act(() => result.current.ergebnisSetzen('1'))
    let r: Awaited<ReturnType<typeof result.current.speichern>> = null
    await act(async () => {
      r = await result.current.speichern(def('1'), werte())
    })
    expect(r?.text).toBe('Nächster Rückruf Do 15.10. 10:00 (Wiederholung 1)')
    const [name, args] = vi.mocked(supabase.rpc).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(name).toBe('log_call')
    expect(args).toMatchObject({
      p_lead_id: LEAD_A.id,
      p_outcome: 'no_answer',
      p_task_id: TASK_RUECKRUF.id,
      p_direction: 'out',
      p_to_number: LEAD_A.phone_e164,
      p_from_number: '+4940999002',
      p_template_id: 'tpl-einstieg',
    })
    expect(args.p_started_at).toBeTypeOf('string')
    expect(localStorage.getItem(ANRUF_KEY)).toBeNull()
    vi.useRealTimers()
  })

  it('T-09: 0 setzt die Erlaubnis „requested_phone“ mit Zitat VOR log_call und hängt danach die Call-ID an', async () => {
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen()), { wrapper })
    act(() => result.current.anrufen())
    await act(async () => {
      await result.current.speichern(
        def('0'),
        werte({ reachedName: 'Lukas Feldhaus', callbackAt: '2026-10-19T10:30', zitat: 'Schicken Sie mal was' }),
      )
    })
    const from = vi.mocked(supabase.from)
    const updates = from.mock.results
      .map((r, i) => ({ k: r.value as ReturnType<typeof kette>, tabelle: from.mock.calls[i]?.[0] }))
      .filter((x) => x.tabelle === 'leads' && (x.k.update as ReturnType<typeof vi.fn>).mock.calls.length)
    expect(updates.length).toBe(2)
    const erstes = updates[0]!.k.update as ReturnType<typeof vi.fn>
    expect(erstes.mock.calls[0]?.[0]).toMatchObject({
      email_consent_basis: 'requested_phone',
      email_consent_note: 'Schicken Sie mal was',
      email_consent_ref: { call: 'pending' },
    })
    const rpcOrder = vi.mocked(supabase.rpc).mock.invocationCallOrder[0] ?? 0
    expect(erstes.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(rpcOrder)
    const zweites = updates[1]!.k.update as ReturnType<typeof vi.fn>
    expect(zweites.mock.calls[0]?.[0]).toEqual({ email_consent_ref: { call_id: 'call-1' } })
    expect(zweites.mock.invocationCallOrder[0] ?? 0).toBeGreaterThan(rpcOrder)
    vi.useRealTimers()
  })

  it('T-09: scheitert log_call, wird die vorab gesetzte Erlaubnis zurückgenommen (Review – keine Erlaubnis ohne Anruf)', async () => {
    vi.mocked(supabase.rpc).mockImplementationOnce(async () => ({
      data: null,
      error: { code: 'P0001', message: 'Firma ist gesperrt' },
    }))
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen()), { wrapper })
    act(() => result.current.anrufen())
    let r: unknown = 'x'
    await act(async () => {
      r = await result.current.speichern(
        def('0'),
        werte({ reachedName: 'Lukas Feldhaus', callbackAt: '2026-10-19T10:30', zitat: 'Schicken Sie mal was' }),
      )
    })
    expect(r).toBeNull()
    const from = vi.mocked(supabase.from)
    const updates = from.mock.results
      .map((x, i) => ({ k: x.value as ReturnType<typeof kette>, tabelle: from.mock.calls[i]?.[0] }))
      .filter((x) => x.tabelle === 'leads' && (x.k.update as ReturnType<typeof vi.fn>).mock.calls.length)
      .map((x) => (x.k.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>)
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({ email_consent_basis: 'requested_phone' })
    expect(updates[1]).toEqual({
      email_consent_basis: LEAD_A.email_consent_basis,
      email_consent_at: LEAD_A.email_consent_at,
      email_consent_note: LEAD_A.email_consent_note,
      email_consent_ref: LEAD_A.email_consent_ref,
    })
    vi.useRealTimers()
  })

  it('T-10: D setzt den Kanal-Umfang vor log_call (do_not_contact selbst setzt log_call); Pflichtfeld Zitat blockt', async () => {
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen()), { wrapper })
    act(() => result.current.anrufen())
    let r: unknown = 'x'
    await act(async () => {
      r = await result.current.speichern(def('D'), werte())
    })
    expect(r).toBeNull()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.speichern(
        def('D'),
        werte({
          reachedName: 'Lukas Feldhaus',
          zitat: 'Nie wieder',
          widerspruchKanaele: ['linkedin', 'telefon', 'email'],
        }),
      )
    })
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1))
    const from = vi.mocked(supabase.from)
    const update = from.mock.results
      .map((r, i) => ({ k: r.value as ReturnType<typeof kette>, t: from.mock.calls[i]?.[0] }))
      .find((x) => x.t === 'leads' && (x.k.update as ReturnType<typeof vi.fn>).mock.calls.length)
    if (!update) throw new Error('kein Lead-Update')
    expect((update.k.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual({
      do_not_contact_channels: ['linkedin', 'telefon', 'email'],
    })
    const args = vi.mocked(supabase.rpc).mock.calls[0]?.[1] as Record<string, unknown>
    expect(args).toMatchObject({ p_outcome: 'do_not_call', p_note: 'Widerspruch: ‚Nie wieder‘' })
    vi.useRealTimers()
  })

  it('T-08: 9 liefert Vorschlag „Terminbestätigung per E-Mail“; 4 liefert „LinkedIn-DM Kurzfristig 1 senden?“', async () => {
    const { result } = renderHook(() => useAnruf(LEAD_A.id, optionen({ task: null, taskId: null })), { wrapper })
    act(() => result.current.anrufen())
    let r: Awaited<ReturnType<typeof result.current.speichern>> = null
    await act(async () => {
      r = await result.current.speichern(
        def('9'),
        werte({ reachedName: 'Lukas Feldhaus', meetingAt: '2026-10-16T10:00' }),
      )
    })
    expect(r?.vorschlag?.label).toBe('Terminbestätigung per E-Mail')
    expect(r?.vorschlag?.pfad).toContain('/email/verfassen?lead=')
    expect(r?.vorschlag?.pfad).toContain('vorlage=em_terminbestaetigung_erstgespraech')
    act(() => result.current.anrufen())
    await act(async () => {
      r = await result.current.speichern(def('4'), werte())
    })
    expect(r?.vorschlag).toEqual({
      label: 'LinkedIn-DM Kurzfristig 1 senden?',
      pfad: `/heute?lead=${encodeURIComponent(LEAD_A.id)}`,
    })
    vi.useRealTimers()
  })
})
