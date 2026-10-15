import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import {
  _akkordZuruecksetzen,
  anzeigeNachBinding,
  eventNachBinding,
  normalisiere,
  TastenBereich,
  useHotkeys,
  useHotkeyScope,
  VERBOTEN,
  type Bindings,
} from './keyboard'

function Haken({
  bindings,
  scope = 'global' as const,
}: {
  bindings: Bindings
  scope?: 'global' | 'liste' | 'karte' | 'anruf' | 'formular'
}) {
  useHotkeys(scope, bindings)
  return (
    <div>
      <input aria-label="feld" />
      <textarea aria-label="text" />
    </div>
  )
}
function Scope({ scope }: { scope: 'anruf' | 'formular' | 'liste' }) {
  useHotkeyScope(scope)
  return null
}

const taste = (init: KeyboardEventInit & { target?: Element }) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  ;(init.target ?? document.body).dispatchEvent(e)
  return e
}

describe('keyboard', () => {
  beforeEach(() => {
    _akkordZuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('normalisiert Bindungen', () => {
    expect(normalisiere('Mod+K')).toBe('mod+k')
    expect(normalisiere('cmd+shift+o')).toBe('mod+shift+o')
    expect(normalisiere('shift+mod+o')).toBe('mod+shift+o')
    expect(normalisiere('G H')).toBe('g h')
    expect(normalisiere('Esc')).toBe('escape')
    expect(normalisiere('shift++')).toBe('shift++')
  })

  it('übersetzt Anzeige-Strings in Bindungen', () => {
    expect(anzeigeNachBinding('⌘⇧O')).toBe('mod+shift+o')
    expect(anzeigeNachBinding('⌥N')).toBe('alt+n')
    expect(anzeigeNachBinding('G H')).toBe('g h')
    expect(anzeigeNachBinding('⌘↵')).toBe('mod+enter')
    expect(anzeigeNachBinding('⌘N')).toBe('mod+n')
    expect(VERBOTEN).toContain(anzeigeNachBinding('⌘⇧B'))
  })

  it('Einzelbuchstabe löst aus, nicht aber in Eingabefeldern', () => {
    const fn = vi.fn()
    const { getByLabelText } = render(<Haken bindings={{ j: fn }} />)
    taste({ key: 'j' })
    expect(fn).toHaveBeenCalledTimes(1)
    const feld = getByLabelText('feld') as HTMLInputElement
    feld.focus()
    taste({ key: 'j', target: feld })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('alt+Buchstabe wird über event.code erkannt (key „Dead“/„˜“) und ruft preventDefault', () => {
    const fn = vi.fn()
    render(<Haken bindings={{ 'alt+n': fn }} />)
    const e1 = taste({ key: 'Dead', code: 'KeyN', altKey: true })
    const e2 = taste({ key: '˜', code: 'KeyN', altKey: true })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(e1.defaultPrevented).toBe(true)
    expect(e2.defaultPrevented).toBe(true)
    expect(eventNachBinding(new KeyboardEvent('keydown', { key: '∫', code: 'KeyB', altKey: true }))).toBe('alt+b')
  })

  it('alt+Kombinationen sind in Eingabefeldern inaktiv, Esc und ⌘Enter nicht', () => {
    const alt = vi.fn()
    const esc = vi.fn()
    const enter = vi.fn()
    const { getByLabelText } = render(<Haken bindings={{ 'alt+n': alt, escape: esc, 'mod+enter': enter }} />)
    const feld = getByLabelText('text') as HTMLTextAreaElement
    feld.focus()
    taste({ key: 'Dead', code: 'KeyN', altKey: true, target: feld })
    expect(alt).not.toHaveBeenCalled()
    taste({ key: 'Escape', target: feld })
    expect(esc).toHaveBeenCalledTimes(1)
    taste({ key: 'Enter', metaKey: true, target: feld })
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it('Akkord g h innerhalb 800 ms, danach verfallen', () => {
    const fn = vi.fn()
    render(<Haken bindings={{ 'g h': fn }} />)
    taste({ key: 'g' })
    taste({ key: 'h' })
    expect(fn).toHaveBeenCalledTimes(1)
    taste({ key: 'g' })
    act(() => {
      vi.advanceTimersByTime(900)
    })
    vi.setSystemTime(Date.now() + 900)
    taste({ key: 'h' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('Scope anruf deaktiviert Listen-Bindungen und G-Akkorde', () => {
    const liste = vi.fn()
    const akkord = vi.fn()
    const anruf = vi.fn()
    render(
      <>
        <Haken bindings={{ j: liste }} scope="liste" />
        <Haken bindings={{ 'g h': akkord }} />
        <Haken bindings={{ '1': anruf }} scope="anruf" />
        <Scope scope="anruf" />
      </>,
    )
    expect(useUiStore.getState().hotkeyScope).toBe('anruf')
    taste({ key: 'j' })
    taste({ key: 'g' })
    taste({ key: 'h' })
    taste({ key: '1' })
    expect(liste).not.toHaveBeenCalled()
    expect(akkord).not.toHaveBeenCalled()
    expect(anruf).toHaveBeenCalledTimes(1)
  })

  it('wirft in DEV bei verbotener Belegung', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Haken bindings={{ 'mod+n': () => {} }} />)).toThrow(/browser-reserviert/)
    spy.mockRestore()
  })

  it('? und / lösen ohne Shift-Vergleich aus', () => {
    const frage = vi.fn()
    const slash = vi.fn()
    render(<Haken bindings={{ '?': frage, '/': slash }} />)
    taste({ key: '?', shiftKey: true })
    taste({ key: '/' })
    expect(frage).toHaveBeenCalledTimes(1)
    expect(slash).toHaveBeenCalledTimes(1)
  })
  it('Karten-Tasten der Seite schweigen bei offenem Peek; im Peek (TastenBereich peek) gelten sie – Review', () => {
    const seite = vi.fn()
    const peek = vi.fn()
    const liste = vi.fn()
    render(
      <>
        <Haken scope="karte" bindings={{ b: seite }} />
        <Haken scope="liste" bindings={{ j: liste }} />
        <TastenBereich.Provider value="peek">
          <Haken scope="karte" bindings={{ b: peek }} />
        </TastenBereich.Provider>
      </>,
    )
    taste({ key: 'b' })
    expect(seite).toHaveBeenCalledTimes(1)
    expect(peek).toHaveBeenCalledTimes(1)
    act(() => useUiStore.setState({ peekLeadId: 'l1' }))
    taste({ key: 'b' })
    taste({ key: 'j' })
    expect(seite).toHaveBeenCalledTimes(1)
    expect(peek).toHaveBeenCalledTimes(2)
    expect(liste).toHaveBeenCalledTimes(1) // Listen-Tasten (J/K im Peek) bleiben
    act(() => useUiStore.setState({ peekLeadId: null }))
  })
})
