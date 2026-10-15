// useQueueHotkeys.test.tsx (BAUPLAN § 3.2 Unit-Tests): J/K/↓/↑ Cursor, Enter/⌘Enter, E/S/N/C/O/X/D/P/Space/⇧E/⇧↓/⌥M an der
// Cursor-Karte, in Eingabefeldern inaktiv, ⌥1/⌥0/⌥R über event.code (macOS liefert „Dead“/„®“), + / ⇧+ Zähler, Esc hebt Auswahl auf.
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { useQueueHotkeys, type QueueTaste } from './useQueueHotkeys'

type Spione = {
  onTaste: ReturnType<typeof vi.fn>
  onBatch: ReturnType<typeof vi.fn>
  onNeuSortieren: ReturnType<typeof vi.fn>
  onZaehler: ReturnType<typeof vi.fn>
  onEscape: ReturnType<typeof vi.fn>
}

function Pruefling({ spione, start = 'a' }: { spione: Spione; start?: string | null }) {
  const [cursor, setCursor] = useState<string | null>(start)
  useQueueHotkeys({
    aktiv: true,
    keys: ['a', 'b', 'c'],
    cursor,
    setCursor,
    onTaste: spione.onTaste,
    onBatch: spione.onBatch,
    onNeuSortieren: spione.onNeuSortieren,
    onZaehler: spione.onZaehler,
    onEscape: spione.onEscape,
  })
  return (
    <>
      <output data-testid="cursor">{cursor ?? '–'}</output>
      <input aria-label="Feld" />
    </>
  )
}

const neueSpione = (): Spione => ({
  onTaste: vi.fn(),
  onBatch: vi.fn(),
  onNeuSortieren: vi.fn(),
  onZaehler: vi.fn(),
  onEscape: vi.fn(),
})

const taste = (key: string, extra: Record<string, unknown> = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })
const tastenVon = (s: Spione) => s.onTaste.mock.calls.map((c) => [c[0], c[1]] as [string, QueueTaste])

describe('useQueueHotkeys', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'liste', scopeStack: [] })
    _akkordZuruecksetzen()
  })

  it('J/K und ↓/↑ bewegen den Cursor, ohne über die Ränder zu laufen', () => {
    const s = neueSpione()
    const { getByTestId } = render(<Pruefling spione={s} />)
    taste('j')
    expect(getByTestId('cursor')).toHaveTextContent('b')
    taste('ArrowDown')
    taste('ArrowDown')
    expect(getByTestId('cursor')).toHaveTextContent('c')
    taste('k')
    taste('ArrowUp')
    taste('k')
    expect(getByTestId('cursor')).toHaveTextContent('a')
  })

  it('ohne Cursor springt J auf die erste, K auf die letzte Karte', () => {
    const s = neueSpione()
    const { getByTestId } = render(<Pruefling spione={s} start={null} />)
    taste('k')
    expect(getByTestId('cursor')).toHaveTextContent('c')
  })

  it('Enter, ⌘Enter, C, E, ⇧E, Space, O, X, D, P, N, S, ⇧↓, ⌥M gehen an die Cursor-Karte', () => {
    const s = neueSpione()
    render(<Pruefling spione={s} start="b" />)
    taste('Enter')
    taste('Enter', { metaKey: true })
    taste('c')
    taste('e')
    taste('E', { shiftKey: true })
    taste(' ')
    taste('o')
    taste('x')
    taste('d')
    taste('p')
    taste('n')
    taste('s')
    taste('ArrowDown', { shiftKey: true })
    taste('µ', { altKey: true, code: 'KeyM' })
    expect(tastenVon(s)).toEqual([
      ['b', 'kopieren'],
      ['b', 'kopieren_gesendet'],
      ['b', 'kopieren'],
      ['b', 'gesendet'],
      ['b', 'gesendet_mit_notiz'],
      ['b', 'abhaken'],
      ['b', 'oeffnen'],
      ['b', 'ablehnen'],
      ['b', 'datum'],
      ['b', 'pitch'],
      ['b', 'notiz'],
      ['b', 'spaeter'],
      ['b', 'bereich'],
      ['b', 'email'],
    ])
  })

  it('in Eingabefeldern sind Einzelbuchstaben und ⌥-Kombinationen aus, ⌘Enter bleibt', () => {
    const s = neueSpione()
    const { getByLabelText, getByTestId } = render(<Pruefling spione={s} />)
    const feld = getByLabelText('Feld')
    feld.focus()
    taste('j', {}, feld)
    taste('e', {}, feld)
    taste('Dead', { altKey: true, code: 'Digit1' }, feld)
    taste('+', {}, feld)
    expect(getByTestId('cursor')).toHaveTextContent('a')
    expect(s.onTaste).not.toHaveBeenCalled()
    expect(s.onBatch).not.toHaveBeenCalled()
    expect(s.onZaehler).not.toHaveBeenCalled()
    taste('Enter', { metaKey: true }, feld)
    expect(tastenVon(s)).toEqual([['a', 'kopieren_gesendet']])
  })

  it('⌥1–9 / ⌥0 über event.code (key „Dead“/„¡“), ⌥R sortiert neu; preventDefault wird gerufen', () => {
    const s = neueSpione()
    render(<Pruefling spione={s} />)
    const e1 = new KeyboardEvent('keydown', { key: '¡', code: 'Digit1', altKey: true, bubbles: true, cancelable: true })
    document.body.dispatchEvent(e1)
    expect(e1.defaultPrevented).toBe(true)
    taste('Dead', { altKey: true, code: 'Digit0' })
    taste('®', { altKey: true, code: 'KeyR' })
    expect(s.onBatch.mock.calls.map((c) => c[0])).toEqual([1, 0])
    expect(s.onNeuSortieren).toHaveBeenCalledTimes(1)
  })

  it('+ = +1, ⇧+ = +5 (Zähler); ⌘-Ziffern und ⌘R sind nicht belegt', () => {
    const s = neueSpione()
    render(<Pruefling spione={s} />)
    taste('+')
    taste('+', { shiftKey: true })
    taste('1', { metaKey: true, code: 'Digit1' })
    taste('r', { metaKey: true, code: 'KeyR' })
    expect(s.onZaehler.mock.calls.map((c) => c[0])).toEqual([1, 5])
    expect(s.onBatch).not.toHaveBeenCalled()
    expect(s.onNeuSortieren).not.toHaveBeenCalled()
  })

  it('Esc hebt die Auswahl auf – aber nicht aus einem Eingabefeld heraus', () => {
    const s = neueSpione()
    const { getByLabelText } = render(<Pruefling spione={s} />)
    taste('Escape')
    expect(s.onEscape).toHaveBeenCalledTimes(1)
    const feld = getByLabelText('Feld')
    feld.focus()
    taste('Escape', {}, feld)
    expect(s.onEscape).toHaveBeenCalledTimes(1)
  })

  it('im Scope „formular“ (offenes Popover/Dialog) reagieren die Listen-Tasten nicht', () => {
    const s = neueSpione()
    const { getByTestId } = render(<Pruefling spione={s} />)
    useUiStore.setState({ hotkeyScope: 'formular' })
    taste('j')
    taste('e')
    expect(getByTestId('cursor')).toHaveTextContent('a')
    expect(s.onTaste).not.toHaveBeenCalled()
  })
})
