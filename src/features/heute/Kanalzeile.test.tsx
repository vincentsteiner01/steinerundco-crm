// Runde 2 (echte Daten, 1440 px): Der LinkedIn-Zähler stand doppelt – Kanalzeile im Hauptbereich UND Tageszähler rechts.
// Mit `zaehlerImRail` blendet die Kanalzeile ihren LinkedIn-Block ab 1180 px (wide) aus; darunter bleibt er sichtbar.
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Kanalzeile } from './Kanalzeile'
import type { TageszaehlerDaten } from './useTageszaehler'

const DATEN = {
  wert: 0,
  woche: 0,
  annahmeQuote7: null,
  delta: vi.fn(),
  budget: { tagesziel: 30, wochenbudget: 100, moeglich: 30, warnung: false, erreicht: false },
  telefon: { anrufe: 0, erreicht: 0, entscheider: 0, termine: 0 },
} as unknown as TageszaehlerDaten

describe('Kanalzeile', () => {
  it('LinkedIn-Block ab 1180 px ausgeblendet, wenn der Tageszähler in der Rail steht', () => {
    render(<Kanalzeile daten={DATEN} linkedin telefon={false} zaehlerImRail onListeEinfuegen={vi.fn()} onCallBlock={vi.fn()} />)
    expect(document.querySelector('[data-kanal-linkedin]')).toHaveClass('wide:hidden')
    expect(document.querySelector('[data-kanalzeile]')).toHaveClass('wide:hidden')
  })
  it('ohne Rail (andere Person) bleibt der Block immer sichtbar; Telefon-Block hält die Zeile offen', () => {
    render(<Kanalzeile daten={DATEN} linkedin telefon onListeEinfuegen={vi.fn()} onCallBlock={vi.fn()} />)
    expect(document.querySelector('[data-kanal-linkedin]')).not.toHaveClass('wide:hidden')
    expect(document.querySelector('[data-kanalzeile]')).not.toHaveClass('wide:hidden')
  })
})
