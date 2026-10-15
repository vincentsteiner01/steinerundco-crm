// Runde 2 (echte Daten, 1440 px): Der LinkedIn-Zähler stand doppelt – Kanalzeile im Hauptbereich UND Tageszähler rechts.
// Mit `zaehlerImRail` blendet die Kanalzeile ihren LinkedIn-Block ab 1180 px (wide) aus; darunter bleibt er sichtbar.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Kanalzeile } from './Kanalzeile'
import type { TageszaehlerDaten } from './useTageszaehler'

const DATEN = {
  wert: 12,
  setzen: vi.fn(),
  woche: 0,
  annahmeQuote7: null,
  delta: vi.fn(),
  budget: { tagesziel: 30, wochenbudget: 100, moeglich: 30, warnung: false, erreicht: false },
  telefon: { anrufe: 0, erreicht: 0, entscheider: 0, termine: 0 },
} as unknown as TageszaehlerDaten

describe('Kanalzeile', () => {
  it('LinkedIn-Block ab 1180 px ausgeblendet, wenn der Tageszähler in der Rail steht', () => {
    render(
      <Kanalzeile
        daten={DATEN}
        linkedin
        telefon={false}
        zaehlerImRail
        onListeEinfuegen={vi.fn()}
        onCallBlock={vi.fn()}
      />,
    )
    expect(document.querySelector('[data-kanal-linkedin]')).toHaveClass('wide:hidden')
    expect(document.querySelector('[data-kanalzeile]')).toHaveClass('wide:hidden')
  })
  it('ohne Rail (andere Person) bleibt der Block immer sichtbar; Telefon-Block hält die Zeile offen', () => {
    render(<Kanalzeile daten={DATEN} linkedin telefon onListeEinfuegen={vi.fn()} onCallBlock={vi.fn()} />)
    expect(document.querySelector('[data-kanal-linkedin]')).not.toHaveClass('wide:hidden')
    expect(document.querySelector('[data-kanalzeile]')).not.toHaveClass('wide:hidden')
  })
  it('Runde 3: unter 1180 px einziger Zähler – −1 · +1 · +5 · +10 und Direkteingabe (↵ übernimmt, Esc verwirft)', () => {
    render(
      <Kanalzeile
        daten={DATEN}
        linkedin
        telefon={false}
        zaehlerImRail
        onListeEinfuegen={vi.fn()}
        onCallBlock={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '−1' }))
    expect(DATEN.delta).toHaveBeenCalledWith(-1)
    const feld = screen.getByRole('textbox', { name: 'Zähler setzen' })
    expect(feld).toHaveValue('12')
    fireEvent.focus(feld)
    fireEvent.change(feld, { target: { value: '40' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    fireEvent.blur(feld)
    expect(DATEN.setzen).toHaveBeenCalledWith(40)
    vi.mocked(DATEN.setzen).mockClear()
    fireEvent.focus(feld)
    fireEvent.change(feld, { target: { value: '99' } })
    fireEvent.keyDown(feld, { key: 'Escape' })
    fireEvent.blur(feld)
    expect(DATEN.setzen).not.toHaveBeenCalled()
    expect(feld).toHaveValue('12')
  })
})
