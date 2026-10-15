// SequenzEditor.test.tsx (BAUPLAN § 3.2 SequenzEditor, SE-01): Tabelle Position · Name · Verzögerung · Kanal · Leitfaden · „fällig am“
// (Beispielstart heute); geänderte Verzögerung verschiebt die Vorschau sofort; Speichern (Button und ⌘↵) = upsert sequence_steps;
// „Sa/So → Montag“ sequenzweit; Exit-Chips; mobil nur Lesen („Am Desktop bearbeiten.“).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/features/heute/_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('@/features/heute/_testHilfe')).toastMock())

import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import { ANTWORTEN, ICH, rendern, SEQ_A, zuruecksetzen } from '@/features/heute/_testHilfe'
import { SequenzEditor } from './SequenzEditor'

/** Di 13.10.2026 10:00 Berlin – Beispielstart der Vorschau-Spalte. */
const JETZT = new Date('2026-10-13T08:00:00Z')

const vorschau = () => [...document.querySelectorAll('td[data-vorschau]')].map((td) => td.getAttribute('data-vorschau'))

describe('SequenzEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JETZT)
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: ICH })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    vi.mocked(toast).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('zeigt Schritte mit Verzögerung, Kanal und Vorschau „fällig am“ für einen Start heute', async () => {
    rendern(<SequenzEditor sequenceId={SEQ_A.id} />)
    expect(await screen.findByRole('heading', { name: 'LinkedIn Standard' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(7)
    expect(screen.getByLabelText('Verzögerung Schritt 3')).toHaveValue('7')
    expect(vorschau()).toEqual(['2026-10-13', '2026-10-16', '2026-10-23', '2026-11-02', '2027-01-11', '2027-04-05'])
    expect(screen.getByText('Fr 23.10.')).toBeInTheDocument()
    expect(screen.getByText('Endet bei:').parentElement).toHaveTextContent(
      'Endet bei:Antwort erhaltenTermin gebuchtLead beendetWiderspruch',
    )
    expect(screen.getByRole('button', { name: /Speichern/ })).toBeDisabled()
  })

  it('SE-01: Kurzfristig 2 von 7 auf 5 Tage – die Vorschau zeigt den neuen Termin sofort, Speichern schreibt delay_days', async () => {
    rendern(<SequenzEditor sequenceId={SEQ_A.id} />)
    const feld = await screen.findByLabelText('Verzögerung Schritt 3')
    fireEvent.change(feld, { target: { value: '5' } })
    expect(vorschau()[2]).toBe('2026-10-21')
    expect(vorschau()[3]).toBe('2026-11-02') // 21.10. + 10 = Sa 31.10. (Reformationstag) → So → Mo 02.11.
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Sequenz gespeichert.'))
    const s = ANTWORTEN.schreiben.find((x) => x.tabelle === 'sequence_steps')!
    expect(s.art).toBe('upsert')
    expect(s.arg).toMatchObject({ id: SEQ_A.steps[2]!.id, delay_days: 5, name: 'Kurzfristig 2' })
  })

  it('⌘↵ speichert auch aus dem Feld heraus; zurück auf den Originalwert = nichts zu speichern', async () => {
    rendern(<SequenzEditor sequenceId={SEQ_A.id} />)
    const name = await screen.findByLabelText('Name Schritt 2')
    fireEvent.change(name, { target: { value: 'KF 1' } })
    fireEvent.keyDown(name, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Sequenz gespeichert.'))
    expect(ANTWORTEN.schreiben.find((x) => x.tabelle === 'sequence_steps')?.arg).toMatchObject({ name: 'KF 1' })

    const feld = screen.getByLabelText('Verzögerung Schritt 4')
    fireEvent.change(feld, { target: { value: '9' } })
    expect(screen.getByRole('button', { name: /Speichern/ })).toBeEnabled()
    fireEvent.change(feld, { target: { value: '10' } })
    expect(screen.getByRole('button', { name: /Speichern/ })).toBeDisabled()
  })

  it('„Sa/So → Montag“ speichert sequenzweit (weekdays_only)', async () => {
    rendern(<SequenzEditor sequenceId={SEQ_A.id} />)
    const sw = await screen.findByRole('switch', { name: /Wochenenden und Feiertage/ })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    await waitFor(() => expect(ANTWORTEN.schreiben.some((x) => x.tabelle === 'sequences')).toBe(true))
    expect(ANTWORTEN.schreiben.find((x) => x.tabelle === 'sequences')?.arg).toMatchObject({
      id: SEQ_A.id,
      weekdays_only: false,
    })
  })

  it('unbekannte Sequenz: „Sequenz nicht gefunden.“', async () => {
    rendern(<SequenzEditor sequenceId="gibt-es-nicht" />)
    expect(await screen.findByText('Sequenz nicht gefunden.')).toBeInTheDocument()
  })

  it('mobil (< 768 px): nur Lesen mit „Am Desktop bearbeiten.“', async () => {
    const vorher = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('max-width: 767px'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      rendern(<SequenzEditor sequenceId={SEQ_A.id} />)
      expect(await screen.findByText('Am Desktop bearbeiten.')).toBeInTheDocument()
      expect(screen.getByLabelText('Verzögerung Schritt 1')).toBeDisabled()
      expect(within(screen.getAllByRole('row')[1]!).getAllByRole('button')[0]).toBeDisabled()
    } finally {
      window.matchMedia = vorher
    }
  })
})
