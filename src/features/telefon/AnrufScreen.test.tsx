// AnrufScreen: Kontext/Nummer/Skript/15 Tasten, tel:-Link + Timer (T-03), Ergebnis-Pflicht (T-04), 7 → Rückruf (T-07),
// 0 ohne Zitat (T-15), p_task_id aus dem Rückruf-Task (T-19), Esc-Dialog, Mobil-Ergebnis-Modus (MO-04)
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_M } from '@/test/fixtures/leads'

const stand = vi.hoisted(() => ({ lead: null as unknown, calls: [] as unknown[] }))

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => {
    if (tabelle === 'leads') return { data: stand.lead, error: null }
    if (tabelle === 'calls') return { data: stand.calls, error: null }
    return h.antworten()(tabelle)
  })
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
import { toast } from '@/components/toast'
import { Component as AnrufScreen } from './AnrufScreen'
import { ANRUF_KEY } from './useAnruf'
import { BLOCK_KEY, _blockCacheZuruecksetzen } from './CallBlock'
import { call, leadMitBezug, LEAD_A, rendern, TASK_RUECKRUF, taste } from './_testHilfe'

const PFAD = `/telefon/anruf/${LEAD_A.id}`
const weiterKnopf = (wrap: HTMLElement) => {
  const b = within(wrap)
    .getAllByRole('button', { name: /^Weiter/ })
    .find((x) => !/ohne/.test(x.textContent ?? ''))
  if (!b) throw new Error('Weiter fehlt')
  return b
}
const ROUTE = '/telefon/anruf/:leadId'

describe('AnrufScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    _blockCacheZuruecksetzen()
    _akkordZuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], online: true })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(toast).mockClear()
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(supabase.rpc).mockImplementation(async () => ({
      data: call(LEAD_A.id, 'callback_scheduled', { id: 'call-7', duration_sec: 41, attempt_no: 2 }),
      error: null,
    }))
    stand.lead = leadMitBezug(LEAD_A, { tasks: [TASK_RUECKRUF] })
    stand.calls = [call(LEAD_A.id, 'voicemail', { started_at: '2026-10-09T08:00:00.000Z', duration_sec: 20 })]
  })

  it('rendert Kontext, Nummer mit tel:-Link, Timer 00:00, Skript-Tabs und 15 Ergebnis-Tasten; Scope anruf', async () => {
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Lukas Feldhaus' })).toBeInTheDocument())
    expect(useUiStore.getState().hotkeyScope).toBe('anruf')
    expect(screen.getByTestId('nummer')).toHaveTextContent('+49 4131 220418')
    expect(screen.getByTestId('anrufen')).toHaveAttribute('href', 'tel:+494131220418')
    expect(screen.getByTestId('timer')).toHaveTextContent('00:00')
    expect(screen.getByText('Anrufgrund · LinkedIn vernetzt + Antwort')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Zentrale' })).toHaveAttribute('aria-selected', 'true') // Nummerntyp Zentrale
    expect(within(screen.getByRole('group', { name: 'Ergebnis' })).getAllByRole('button')).toHaveLength(15)
    // der `calls`-Mock liefert auch „heute“: 1 Mailbox-Anruf = 1 Dial, nicht erreicht
    expect(screen.getByTestId('callbar')).toHaveTextContent('Heute: 1 Dials · 0 Erreicht · 0 Entscheider · 0 Termine')
    expect(screen.getByText(/Telefon-Verlauf · Versuch 2 von 5/)).toBeInTheDocument()
    expect(screen.getByText(/Mailbox – keine Nachricht/)).toBeInTheDocument()
    // Tab/⇧Tab wechseln die Skript-Phase
    taste('Tab')
    expect(screen.getByRole('tab', { name: 'Einstieg' })).toHaveAttribute('aria-selected', 'true')
    taste('Tab', { shiftKey: true })
    expect(screen.getByRole('tab', { name: 'Zentrale' })).toHaveAttribute('aria-selected', 'true')
  })

  it('T-03/MO-04: Anrufen startet den Timer und legt den Entwurf in localStorage an; Mailbox-Tab bei Versuch 2', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('anrufen'))
    expect(JSON.parse(localStorage.getItem(ANRUF_KEY) ?? '{}')).toMatchObject({ leadId: LEAD_A.id })
    expect(screen.getByRole('tab', { name: 'Mailbox' })).toHaveAttribute('aria-selected', 'true')
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByTestId('timer')).toHaveTextContent(/00:0[2-3]/)
    vi.useRealTimers()
  })

  it('T-07/T-19: Taste 7 zeigt den Rückruf-Picker vorbelegt; Enter speichert mit p_callback_at und p_task_id und lädt die Liste', async () => {
    const { router } = rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    expect(localStorage.getItem(ANRUF_KEY)).not.toBeNull()
    taste('7')
    const wrap = await screen.findByRole('group', { name: 'Wrap-up' })
    expect(wrap).toHaveAttribute('data-ergebnis', '7')
    expect(screen.getByTestId('folgeaktion')).toHaveTextContent('Rückruf oben in der Queue')
    expect(screen.getByRole('button', { name: /Rückruf vereinbart/ })).toHaveAttribute('aria-pressed', 'true')
    taste('Enter')
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1))
    const [name, args] = vi.mocked(supabase.rpc).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(name).toBe('log_call')
    expect(args).toMatchObject({
      p_outcome: 'callback_scheduled',
      p_task_id: TASK_RUECKRUF.id,
      p_reached_person: 'zentrale',
      p_direction: 'out',
    })
    expect(args.p_callback_at).toMatch(/T\d\d:30:00\.000Z$/)
    await waitFor(() => expect(router.state.location.pathname).toBe('/telefon'))
    expect(localStorage.getItem(ANRUF_KEY)).toBeNull()
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.stringMatching(/^Anruf · Rückruf vereinbart · Versuch 2\/5 · 00:41\.$/),
    )
  })

  it('T-15: Taste 0 ohne Zitat lässt sich nicht speichern – Fehlertext, kein RPC', async () => {
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    taste('0')
    await screen.findByRole('group', { name: 'Wrap-up' })
    const weiter = screen.getAllByRole('button', { name: /^Weiter/ }).find((b) => !/ohne/.test(b.textContent ?? ''))
    if (!weiter) throw new Error('Weiter fehlt')
    fireEvent.click(weiter)
    expect(await screen.findByText('Zitat ist Pflicht.')).toBeInTheDocument()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
  })

  it('T-04: Esc während eines Anrufs fragt „Anruf ohne Ergebnis verwerfen?“; Verwerfen löscht den Entwurf und verlässt den Screen', async () => {
    const { router } = rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    taste('Escape')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Anruf ohne Ergebnis verwerfen?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Behalten' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localStorage.getItem(ANRUF_KEY)).not.toBeNull()
    taste('Escape')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Verwerfen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/telefon'))
    expect(localStorage.getItem(ANRUF_KEY)).toBeNull()
  })

  it('T-04: Navigation weg vom Screen mit offenem Anruf wird blockiert und erst nach „Verwerfen“ ausgeführt', async () => {
    const { router } = rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    await act(async () => {
      await router.navigate('/heute')
    })
    expect(router.state.location.pathname).toBe(PFAD)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verwerfen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/heute'))
  })

  it('D: Widerspruch-Dialog mit Umfang und Zitat-Pflicht; Umfang landet vor log_call am Lead', async () => {
    vi.mocked(supabase.rpc).mockImplementation(async () => ({
      data: call(LEAD_A.id, 'do_not_call', { id: 'call-d' }),
      error: null,
    }))
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    taste('d')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Werbewiderspruch für Lukas Feldhaus erfassen?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Widerspruch erfassen' }))
    expect(await within(dialog).findByText('Zitat ist Pflicht.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: /alle Kanäle/ }))
    fireEvent.change(within(dialog).getByLabelText('Zitat'), { target: { value: 'Bitte nie wieder' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Widerspruch erfassen' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(supabase.rpc).mock.calls[0]?.[1]).toMatchObject({
      p_outcome: 'do_not_call',
      p_note: 'Widerspruch: ‚Bitte nie wieder‘',
    })
  })

  it('Mobil: `?ergebnis=modus` schaltet in den Ergebnis-Modus (48-px-Buttons, Skript eingeklappt)', async () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('767'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      rendern(<AnrufScreen />, `${PFAD}?ergebnis=modus`, ROUTE)
      await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
      expect(document.querySelector('[data-anruf-screen]')).toHaveAttribute('data-modus', 'ergebnis')
      expect(screen.getByRole('button', { name: /Nicht erreicht$/ })).toHaveClass('h-12')
      expect(screen.getByRole('button', { name: /Skript/ })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('anrufen')).toHaveClass('h-14')
    } finally {
      window.matchMedia = mm
    }
  })

  it('Gate: ohne Anrufgrund zeigt der Screen den Grund und „Anrufgrund setzen“', async () => {
    stand.lead = leadMitBezug({ ...LEAD_A, call_basis: null })
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nummer ohne Anrufgrund'))
    expect(screen.getByRole('button', { name: 'Anrufgrund setzen' })).toBeInTheDocument()
  })

  it('D: Esc im Widerspruch-Dialog nimmt das Ergebnis zurück, der Anruf bleibt offen', async () => {
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    taste('d')
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: /Werbewiderspruch/ })).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(ANRUF_KEY) ?? '{}')).toMatchObject({ ergebnis: null })
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
  })

  it('T-05/T-06: 1 meldet Versuch und nächsten Versuch im Toast; 2 Besetzt ohne Pflichtfelder', async () => {
    stand.lead = leadMitBezug(LEAD_A)
    vi.mocked(supabase.rpc).mockImplementation(async () => ({
      data: call(LEAD_A.id, 'no_answer', { id: 'call-1', attempt_no: 2, duration_sec: 12 }),
      error: null,
    }))
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    taste('Enter')
    taste('1')
    expect(await screen.findByTestId('folgeaktion')).toHaveTextContent(
      /^Nächster Versuch .* · Versuch 3 von 5 · Slot C/,
    )
    taste('Enter')
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalled())
    expect(vi.mocked(toast).mock.calls[0]?.[0]).toMatch(
      /^Anruf · Nicht erreicht · Versuch 2\/5 · 00:12 – Nächster Versuch /,
    )
    expect(vi.mocked(supabase.rpc).mock.calls[0]?.[1]).toMatchObject({ p_outcome: 'no_answer', p_task_id: null })
  })

  it('T-08: 9 verlangt Gesprächspartner und Termin; danach Vorschlag „Terminbestätigung per E-Mail“ und Weiter', async () => {
    // Deterministisch (Runde 3, flackerte auf langsamen Runnern): jeder Schritt wartet auf einen sichtbaren Zustand mit festem
    // Zeitlimit statt auf Laufzeit; vor dem Öffnen der Datumsauswahl ist der 50-ms-Fokus der Wrap-up-Zeile abgeschlossen.
    const BIS = { timeout: 5000 }
    stand.lead = leadMitBezug(LEAD_A)
    vi.mocked(supabase.rpc).mockImplementation(async () => ({
      data: call(LEAD_A.id, 'meeting_booked', { id: 'call-9' }),
      error: null,
    }))
    const { router } = rendern(<AnrufScreen />, PFAD, ROUTE)
    const anrufen = await screen.findByTestId('anrufen', {}, BIS)
    await waitFor(() => expect(anrufen).toHaveAttribute('href', 'tel:+494131220418'), BIS) // Gate offen, Lead geladen
    taste('Enter')
    await waitFor(() => expect(localStorage.getItem(ANRUF_KEY)).not.toBeNull(), BIS)
    taste('9')
    const wrap = await screen.findByRole('group', { name: 'Wrap-up' }, BIS)
    const partner = within(wrap).getByLabelText(/Gesprächspartner/)
    await waitFor(() => expect(partner).toHaveValue('Lukas Feldhaus'), BIS)
    await waitFor(() => expect(partner).toHaveFocus(), BIS) // 20-s-Fokus erledigt – kein Timer mehr offen
    fireEvent.click(weiterKnopf(wrap))
    expect(await within(wrap).findByText('Termin (Datum und Uhrzeit) ist Pflicht.', {}, BIS)).toBeInTheDocument()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
    const termin = within(wrap).getByLabelText(/Erstgespräch/)
    fireEvent.click(termin)
    const auswahl = await screen.findByRole('dialog', {}, BIS)
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Morgen' }))
    await waitFor(() => expect(termin).toHaveTextContent(/\d{2}\.\d{2}\. 09:00/), BIS)
    await waitFor(() => expect(within(wrap).queryByText('Termin (Datum und Uhrzeit) ist Pflicht.')).toBeNull(), BIS)
    fireEvent.click(weiterKnopf(wrap))
    const nach = await screen.findByTestId('nach-anruf', {}, BIS)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.rpc).mock.calls[0]?.[1]).toMatchObject({
      p_outcome: 'meeting_booked',
      p_reached_person: 'entscheider',
      p_reached_name: 'Lukas Feldhaus (Geschäftsführer)',
    })
    const meetingArgs = vi.mocked(supabase.rpc).mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(meetingArgs?.p_meeting_at).toBeTypeOf('string')
    expect(within(nach).getByRole('button', { name: 'Terminbestätigung per E-Mail' })).toBeInTheDocument()
    taste('Enter')
    await waitFor(() => expect(router.state.location.pathname).toBe('/telefon'), BIS)
  })

  it('`?ergebnis=7` (Schnell-Ergebnis der Heute-Karte) wählt das Ergebnis vor; offline ist Weiter gesperrt', async () => {
    useUiStore.setState({ online: false })
    rendern(<AnrufScreen />, `${PFAD}?ergebnis=7`, ROUTE)
    const wrap = await screen.findByRole('group', { name: 'Wrap-up' })
    expect(wrap).toHaveAttribute('data-ergebnis', '7')
    expect(weiterKnopf(wrap)).toBeDisabled()
    expect(screen.getByText('offline – wird nachgetragen')).toBeInTheDocument()
  })

  it('`?ergebnis=no_answer` (Heute schickt den Outcome, BAUPLAN § 3.2) wählt „Nicht erreicht“ (Taste 1) vor – Review', async () => {
    rendern(<AnrufScreen />, `${PFAD}?ergebnis=no_answer`, ROUTE)
    const wrap = await screen.findByRole('group', { name: 'Wrap-up' })
    expect(wrap).toHaveAttribute('data-ergebnis', '1')
  })

  it('§ 8.2 Nr. 2: ohne Anrufgrund kein Wählen – Anrufen deaktiviert ohne tel:, Enter und Ergebnis-Tasten wirkungslos', async () => {
    stand.lead = leadMitBezug({ ...LEAD_A, call_basis: null })
    rendern(<AnrufScreen />, `${PFAD}?ergebnis=no_answer`, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    expect(screen.getByTestId('anrufen')).toBeDisabled()
    expect(screen.getByTestId('anrufen')).not.toHaveAttribute('href')
    expect(screen.getByLabelText('Nummer ohne Anrufgrund')).toBeInTheDocument()
    expect(
      screen.getAllByRole('alert').some((a) => /Anrufen und Ergebnisse sind gesperrt/.test(a.textContent ?? '')),
    ).toBe(true)
    taste('Enter')
    expect(localStorage.getItem(ANRUF_KEY)).toBeNull()
    taste('7')
    expect(screen.queryByRole('group', { name: 'Wrap-up' })).toBeNull()
    for (const b of within(screen.getByRole('group', { name: 'Ergebnis' })).getAllByRole('button'))
      expect(b).toBeDisabled()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
  })

  it('Enter wählt wie der Klick: tel:-Link wird ausgelöst, nach 2 s „Kein Telefon verbunden? Nummer kopieren“ (Review)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    const klick = vi.fn((e: Event) => e.preventDefault()) // jsdom navigiert nicht zu tel:
    screen.getByTestId('anrufen').addEventListener('click', klick)
    taste('Enter')
    expect(klick).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(ANRUF_KEY)).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByText('Kein Telefon verbunden? Nummer kopieren')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Call-Block: Kopfzeile „Anruf n von m“, ⌘⇧X überspringt ans Listenende, ohne Anruf kein Versuch', async () => {
    localStorage.setItem(
      BLOCK_KEY,
      JSON.stringify({
        id: 'b1',
        start: new Date().toISOString(),
        listeIds: [LEAD_A.id, 'lead-2', 'lead-3'],
        position: 0,
        uebersprungen: [],
      }),
    )
    const { router } = rendern(<AnrufScreen />, `${PFAD}?block=b1`, ROUTE)
    await waitFor(() => expect(screen.getByTestId('callbar')).toHaveTextContent('Anruf 1 von 3'))
    expect(screen.getByTestId('callbar')).toHaveTextContent(/Block 00:0\d \/ 2:00/) // Ziel steht dabei (DESIGN § 5.13)
    fireEvent.keyDown(document.body, { key: 'x', code: 'KeyX', metaKey: true, shiftKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/telefon/anruf/lead-2'))
    expect(JSON.parse(localStorage.getItem(BLOCK_KEY) ?? '{}')).toMatchObject({
      listeIds: ['lead-2', 'lead-3', LEAD_A.id],
      uebersprungen: [LEAD_A.id],
    })
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
  })

  it('Call-Block nach 2 h: „2 Stunden – weitermachen oder beenden?“', async () => {
    localStorage.setItem(
      BLOCK_KEY,
      JSON.stringify({
        id: 'b1',
        start: new Date(Date.now() - 2 * 3_600_000 - 5_000).toISOString(),
        listeIds: [LEAD_A.id],
        position: 0,
        uebersprungen: [],
      }),
    )
    rendern(<AnrufScreen />, PFAD, ROUTE)
    const dialog = await screen.findByRole('dialog', { name: '2 Stunden – weitermachen oder beenden?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weitermachen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(JSON.parse(localStorage.getItem(BLOCK_KEY) ?? '{}')).toMatchObject({ hinweisGezeigt: true })
  })

  it('Runde 3 (1024 × 768): Ergebnisleiste klebt unter 1180 px erst mit laufendem Anruf; Nummer/Anrufen rechts oben im Raster', async () => {
    rendern(<AnrufScreen />, PFAD, ROUTE)
    await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
    const leiste = screen.getByTestId('ergebnis-leiste')
    expect(leiste).toHaveAttribute('data-klebt', 'breit')
    expect(leiste).toHaveClass('wide:sticky')
    expect(leiste).not.toHaveClass('sticky')
    // zwei Spalten unter 1180 px: Mitte (Nummer, Anrufen, Timer) rechts über zwei Zeilen, Skript unter dem Kontext
    const raster = screen.getByTestId('anruf-raster')
    expect(raster).toHaveClass('max-wide:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]')
    const mitte = screen.getByTestId('nummer').closest('.grid') as HTMLElement
    expect(mitte).toHaveClass('max-wide:col-start-2', 'max-wide:row-span-2')
    fireEvent.click(screen.getByTestId('anrufen'))
    await waitFor(() => expect(screen.getByTestId('ergebnis-leiste')).toHaveAttribute('data-klebt', 'immer'))
    expect(screen.getByTestId('ergebnis-leiste')).toHaveClass('sticky', 'bottom-0', 'max-md:static')
  })

  it('Runde 3 (390 × 844): mobil stehen Nummer und Anrufen direkt unter dem Namen, Verlauf und Skript danach', async () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('767'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      rendern(<AnrufScreen />, PFAD, ROUTE)
      await waitFor(() => expect(screen.getByTestId('anrufen')).toBeInTheDocument())
      const name = screen.getByRole('heading', { name: 'Lukas Feldhaus' })
      const anrufen = screen.getByTestId('anrufen')
      const verlauf = screen.getByText(/Telefon-Verlauf · Versuch/)
      const vor = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(vor(name, anrufen)).toBe(true)
      expect(vor(anrufen, verlauf)).toBe(true)
      expect(anrufen).toHaveClass('h-14')
      expect(screen.getAllByRole('heading', { name: 'Lukas Feldhaus' })).toHaveLength(1)
    } finally {
      window.matchMedia = mm
    }
  })
})
