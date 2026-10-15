// Sichtprüfung Runde 3 (echte Daten): klebende Ergebnisleiste bekommt scroll-padding-bottom; Karten-Tasten schweigen im
// TastenBereich „stumm“ (offene Karte auf der Lead-Vollseite), globale und Dialog-Tasten bleiben.
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { _akkordZuruecksetzen, TastenBereich, useHotkeys, type Bindings } from './keyboard'
import { useScrollPaddingUnten } from './useScrollPaddingUnten'

function Leiste({ aktiv, klebt, merkmal }: { aktiv: boolean; klebt: boolean; merkmal?: unknown }) {
  const ref = useScrollPaddingUnten(aktiv, merkmal)
  return <div ref={ref} style={{ position: klebt ? 'sticky' : 'static' }} data-testid="leiste" />
}

function Haken({ scope, bindings }: { scope: 'global' | 'karte' | 'liste'; bindings: Bindings }) {
  useHotkeys(scope, bindings)
  return null
}

const taste = (key: string) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('useScrollPaddingUnten', () => {
  afterEach(() => {
    document.documentElement.style.scrollPaddingBottom = ''
  })

  it('setzt scroll-padding-bottom (Höhe + 16 px), solange die Leiste klebt, und räumt beim Abbau auf', () => {
    const { unmount } = render(<Leiste aktiv klebt />)
    // jsdom misst 0 px Höhe → 0 + 16
    expect(document.documentElement.style.scrollPaddingBottom).toBe('16px')
    unmount()
    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
  })

  it('nicht klebend (unter 1180 px vor dem Anruf) oder inaktiv: kein Padding; Wechsel des Merkmals misst neu', () => {
    const { rerender } = render(<Leiste aktiv klebt={false} merkmal={false} />)
    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
    rerender(<Leiste aktiv klebt merkmal />)
    expect(document.documentElement.style.scrollPaddingBottom).toBe('16px')
    rerender(<Leiste aktiv={false} klebt merkmal />)
    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
  })
})

describe('TastenBereich stumm', () => {
  beforeEach(() => {
    _akkordZuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null })
  })

  it('Karten- und Listen-Tasten im stummen Teilbaum feuern nicht, die der Seite und globale Tasten schon', () => {
    const seite = vi.fn()
    const stummKarte = vi.fn()
    const stummListe = vi.fn()
    const stummGlobal = vi.fn()
    render(
      <>
        <Haken scope="karte" bindings={{ b: seite }} />
        <TastenBereich.Provider value="stumm">
          <Haken scope="karte" bindings={{ b: stummKarte, c: stummKarte }} />
          <Haken scope="liste" bindings={{ j: stummListe }} />
          <Haken scope="global" bindings={{ '?': stummGlobal }} />
        </TastenBereich.Provider>
      </>,
    )
    taste('b')
    taste('c')
    taste('j')
    taste('?')
    expect(seite).toHaveBeenCalledTimes(1)
    expect(stummKarte).not.toHaveBeenCalled()
    expect(stummListe).not.toHaveBeenCalled()
    expect(stummGlobal).toHaveBeenCalledTimes(1)
  })
})
