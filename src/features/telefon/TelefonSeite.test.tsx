// TelefonSeite: Sektionen, Zähler, Gate, Cursor-Tasten, Call-Block starten, Leerzustand (T-01/T-02/T-17, ux § 3.5.1)
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_M } from '@/test/fixtures/leads'

const stand = vi.hoisted(() => ({
  leadsFehler: null as null | { code: string; message: string },
  leads: [] as unknown[],
  tasks: [] as unknown[],
  enrollments: [] as unknown[],
  calls: [] as unknown[],
}))

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => {
    if (tabelle === 'leads')
      return stand.leadsFehler
        ? { data: null, error: stand.leadsFehler }
        : { data: stand.leads, error: null, count: stand.leads.length }
    if (tabelle === 'tasks') return { data: stand.tasks, error: null }
    if (tabelle === 'enrollments') return { data: stand.enrollments, error: null }
    if (tabelle === 'calls') return { data: stand.calls, error: null }
    if (tabelle === 'activities') return { data: { id: 1, lead_id: 'x' }, error: null }
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

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { Component as TelefonSeite } from './TelefonSeite'
import { BLOCK_KEY, _blockCacheZuruecksetzen } from './CallBlock'
import { ENTFERNT_KEY } from './useAnrufliste'
import {
  enrollment,
  LEAD_A,
  LEAD_B,
  LEAD_C,
  LEAD_OHNE_GRUND,
  LEAD_OHNE_NUMMER,
  call,
  rendern,
  TASK_RUECKRUF,
  taste,
} from './_testHilfe'

describe('TelefonSeite', () => {
  beforeEach(() => {
    localStorage.clear()
    _blockCacheZuruecksetzen()
    _akkordZuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(toast).mockClear()
    stand.leads = [LEAD_A, LEAD_B, LEAD_C, LEAD_OHNE_GRUND, LEAD_OHNE_NUMMER]
    stand.tasks = [{ ...TASK_RUECKRUF, due_at: new Date(Date.now() + 3_600_000).toISOString() }]
    stand.enrollments = [enrollment(LEAD_B.id, 2, '2026-10-13T07:00:00.000Z')]
    stand.calls = []
    stand.leadsFehler = null
  })

  it('zeigt Rückrufe → Anrufliste → „Noch nicht anrufbar“ mit Gründen, Zähler im Kopf', async () => {
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Rückrufe' })).toBeInTheDocument())
    const rueckrufe = within(screen.getByRole('listbox', { name: 'Rückrufe' })).getAllByRole('option')
    expect(rueckrufe).toHaveLength(1)
    expect(rueckrufe[0]).toHaveTextContent('Lukas Feldhaus')
    expect(rueckrufe[0]).toHaveTextContent('mit Zentrale')
    const liste = within(screen.getByRole('listbox', { name: 'Anrufliste' })).getAllByRole('option')
    expect(liste.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Timo Kranich'),
      expect.stringContaining('Lena Hartwig'),
    ])
    expect(liste[0]).toHaveTextContent('Versuch 2/5 · Slot B 14:00–16:00')
    expect(liste[1]).toHaveTextContent('Versuch 1/5 · Slot A 09:30–11:30')
    expect(liste[1]).toHaveTextContent('Bestandskontakt')
    const kopf = screen.getByRole('banner')
    expect(kopf).toHaveTextContent('3 in der Liste')
    expect(kopf).toHaveTextContent('1 Versuche fällig')
    // eingeklappte Sektion mit Zähler 2, Gründe nach dem Aufklappen
    const nicht = screen.getByRole('button', { name: /Noch nicht anrufbar/ })
    expect(nicht).toHaveTextContent('2')
    expect(nicht).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(nicht)
    const gesperrt = within(screen.getByRole('list', { name: 'Noch nicht anrufbar' })).getAllByRole('listitem')
    expect(gesperrt.map((g) => g.getAttribute('data-grund')).sort()).toEqual(['kein_anrufgrund', 'keine_nummer'])
    expect(screen.getByText('Nummer ohne Anrufgrund')).toBeInTheDocument()
    expect(screen.getByText('Keine Nummer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alle mit LinkedIn-Antwort/ })).toHaveTextContent('(1)')
  })

  it('J/K bewegen den Cursor, Enter öffnet den Anruf-Screen des Cursor-Leads mit Task-Parameter', async () => {
    const { router } = rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Anrufliste' })).toBeInTheDocument())
    const erster = within(screen.getByRole('listbox', { name: 'Rückrufe' })).getAllByRole('option')[0]
    expect(erster).toHaveAttribute('aria-selected', 'true')
    taste('j')
    expect(within(screen.getByRole('listbox', { name: 'Anrufliste' })).getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    )
    taste('k')
    taste('Enter')
    expect(router.state.location.pathname).toBe(`/telefon/anruf/${LEAD_A.id}`)
    expect(router.state.location.search).toContain(`task=${TASK_RUECKRUF.id}`)
  })

  it('R entfernt die Cursor-Zeile für heute (nicht Rückrufe); „Call-Block starten“ legt die Session an und öffnet den ersten Lead', async () => {
    const { router } = rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Anrufliste' })).toBeInTheDocument())
    taste('j')
    taste('r')
    // Grund-Popover (ux § 5.3), Ziffer wählt den Grund
    expect(await screen.findByRole('menu', { name: 'Grund' })).toBeInTheDocument()
    taste('2')
    await waitFor(() =>
      expect(within(screen.getByRole('listbox', { name: 'Anrufliste' })).getAllByRole('option')).toHaveLength(1),
    )
    expect(vi.mocked(toast)).toHaveBeenCalledWith('Heute aus der Liste entfernt – Erst Nummer prüfen.')
    expect(JSON.parse(localStorage.getItem(ENTFERNT_KEY) ?? '{}')).toMatchObject({
      ids: [LEAD_B.id],
      gruende: { [LEAD_B.id]: 'Erst Nummer prüfen' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Call-Block starten/ }))
    const session = JSON.parse(localStorage.getItem(BLOCK_KEY) ?? 'null') as { listeIds: string[] }
    expect(session.listeIds).toEqual([LEAD_A.id, LEAD_C.id])
    expect(router.state.location.pathname).toBe(`/telefon/anruf/${LEAD_A.id}`)
    expect(router.state.location.search).toContain('block=')
  })

  it('Ladefehler: Fehlerzeile „erneut versuchen R“ statt „Niemand anzurufen.“ (ux § 4.3, Review)', async () => {
    stand.leadsFehler = { code: '500', message: 'kaputt' }
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Die Anrufliste konnte nicht geladen werden – erneut versuchen.')
    expect(screen.queryByText('Niemand anzurufen.')).toBeNull()
    stand.leadsFehler = null
    taste('r')
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Anrufliste' })).toBeInTheDocument())
  })

  it('Leerzustand: „Niemand anzurufen.“ mit Hinweis auf wartende Leads und Aktion „Anrufgrund setzen“', async () => {
    stand.leads = [LEAD_OHNE_GRUND, LEAD_OHNE_NUMMER]
    stand.tasks = []
    stand.enrollments = []
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() => expect(screen.getByText('Niemand anzurufen.')).toBeInTheDocument())
    expect(screen.getByText('2 Leads warten auf einen Anrufgrund.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anrufgrund setzen' }))
    expect(screen.getByRole('button', { name: /Noch nicht anrufbar/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Call-Block starten/ })).toBeDisabled()
  })

  it('Segment „Alle“ zeigt kommende Versuche; laufender Block zeigt die Hinweiszeile mit „Block beenden“', async () => {
    stand.enrollments = [enrollment(LEAD_B.id, 3, new Date(Date.now() + 3 * 86_400_000).toISOString())]
    localStorage.setItem(
      BLOCK_KEY,
      JSON.stringify({
        id: 'b1',
        start: new Date().toISOString(),
        listeIds: [LEAD_A.id],
        position: 0,
        uebersprungen: [],
      }),
    )
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Anrufliste' })).toBeInTheDocument())
    expect(screen.queryByRole('listbox', { name: 'Kommend' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }))
    expect(within(screen.getByRole('listbox', { name: 'Kommend' })).getAllByRole('option')[0]).toHaveTextContent(
      'Timo Kranich',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Call-Block läuft seit')
    expect(screen.getByRole('button', { name: /Call-Block fortsetzen/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Block beenden' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Call-Block beendet' })).toBeInTheDocument())
    expect(screen.getByTestId('block-zusammenfassung')).toHaveTextContent('Dials0')
  })

  it('Zeilen zeigen den letzten Versuch (Datum, Ergebnis-Chip) und „vereinbart … mit …“; Klick auf den Namen öffnet den Peek', async () => {
    stand.calls = [
      call(LEAD_B.id, 'voicemail', { started_at: '2026-10-09T08:00:00.000Z' }),
      call(LEAD_B.id, 'no_answer', { started_at: '2026-10-12T08:00:00.000Z' }),
      call(LEAD_A.id, 'callback_scheduled', {
        started_at: '2026-10-12T08:00:00.000Z',
        reached_person: 'zentrale',
        reached_name: 'Frau Behrens',
      }),
    ]
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    const liste = await screen.findByRole('listbox', { name: 'Anrufliste' })
    await waitFor(() => expect(within(liste).getByTestId('letztes-ergebnis')).toHaveTextContent('Nicht erreicht'))
    expect(within(liste).getAllByRole('option')[0]).toHaveTextContent(
      'Versuch 2/5 · Slot B 14:00–16:00 · zuletzt Mo 12.10.',
    )
    expect(screen.getByRole('listbox', { name: 'Rückrufe' })).toHaveTextContent('vereinbart Mo 12.10. mit Frau Behrens')
    const peek = vi.fn()
    window.addEventListener('crm:peek', peek)
    fireEvent.click(within(liste).getByRole('button', { name: 'Timo Kranich' }))
    window.removeEventListener('crm:peek', peek)
    const ereignis = peek.mock.calls[0]?.[0] as CustomEvent | undefined
    expect(ereignis?.detail).toEqual({ leadId: LEAD_B.id })
  })

  it('Bulk „Alle mit LinkedIn-Antwort → ‚LinkedIn vernetzt + Antwort‘“ setzt den Anrufgrund samt Aktivität', async () => {
    vi.mocked(supabase.from).mockClear()
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    const bulk = await screen.findByRole('button', { name: /Alle mit LinkedIn-Antwort/ })
    expect(bulk).toHaveTextContent('(1)')
    fireEvent.click(bulk)
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith('Anrufgrund gesetzt für 1 Leads: LinkedIn vernetzt + Antwort.'),
    )
    const from = vi.mocked(supabase.from)
    const updates = from.mock.results
      .map((r, i) => ({ k: r.value as Record<string, ReturnType<typeof vi.fn>>, t: from.mock.calls[i]?.[0] }))
      .filter((x) => x.t === 'leads')
      .flatMap((x) => x.k.update?.mock.calls.map((c) => c[0]) ?? [])
    expect(updates).toEqual([{ call_basis: 'linkedin_vernetzt_antwort', call_basis_note: null, call_basis_url: null }])
  })

  it('laufender Block: Session-Zähler Dials · Erreicht · Entscheider · Termine aus den eigenen Anrufen seit Block-Start', async () => {
    const start = new Date(Date.now() - 600_000).toISOString()
    localStorage.setItem(
      BLOCK_KEY,
      JSON.stringify({ id: 'b2', start, listeIds: [LEAD_A.id, LEAD_B.id], position: 0, uebersprungen: [] }),
    )
    stand.calls = [call(LEAD_A.id, 'no_answer'), call(LEAD_B.id, 'meeting_booked'), call(LEAD_C.id, 'gatekeeper')]
    rendern(<TelefonSeite />, '/telefon', '/telefon')
    await waitFor(() =>
      expect(screen.getByTestId('block-zaehler')).toHaveTextContent('Dials 3 · Erreicht 2 · Entscheider 1 · Termine 1'),
    )
  })

  it('Palette-Befehle landen als Zeile über der Liste: `?rueckruf=` und `?anrufgrund=`', async () => {
    rendern(<TelefonSeite />, `/telefon?anrufgrund=${LEAD_OHNE_GRUND.id}`, '/telefon')
    expect(await screen.findByRole('note')).toHaveTextContent('Anrufgrund setzen für')
  })
})
