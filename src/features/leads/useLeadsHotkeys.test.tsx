// useLeadsHotkeys.test.tsx (BAUPLAN § 3.3, § 1.5 Nr. 23): ⌥N · ⌥B · ⌥M · ⌘⇧K (⌥-Tasten über `event.code`, macOS liefert in
// `event.key` Sonderzeichen), ⌘⇧U · ⌘⇧F · ⌘↵ · O · ⌫ · A B S W T N nur ohne Peek, alles inaktiv in Eingabefeldern.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { useUiStore } from '@/app/uiStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { TestOrt } from './_TestOrt'
import { useLeadsHotkeys, type LeadsHotkeyOptionen } from './useLeadsHotkeys'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())

function Harness(p: Partial<LeadsHotkeyOptionen>) {
  useLeadsHotkeys({
    cursorId: 'l1',
    auswahlGroesse: 0,
    onBulkMenu: vi.fn(),
    onAktion: vi.fn(),
    onZuruecksetzen: vi.fn(),
    onEmail: vi.fn(),
    onAnrufen: vi.fn(),
    onLinkedin: vi.fn(),
    ...p,
  })
  return (
    <>
      <input aria-label="Suche" />
      <TestOrt />
    </>
  )
}

function setup(p: Partial<LeadsHotkeyOptionen> = {}) {
  const spies = {
    onBulkMenu: vi.fn(),
    onAktion: vi.fn(),
    onZuruecksetzen: vi.fn(),
    onEmail: vi.fn(),
    onAnrufen: vi.fn(),
    onLinkedin: vi.fn(),
  }
  render(
    <MemoryRouter initialEntries={['/leads']}>
      <Harness {...spies} {...p} />
    </MemoryRouter>,
  )
  return spies
}
const ort = () => screen.getByTestId('ort').textContent
const druecke = (init: KeyboardEventInit, ziel: Element = document.body) => fireEvent.keyDown(ziel, init)

describe('useLeadsHotkeys', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null })
    _akkordZuruecksetzen()
  })

  it('⌥N → /leads/neu (über event.code, key = „˜“)', () => {
    setup()
    druecke({ key: '˜', code: 'KeyN', altKey: true })
    expect(ort()).toBe('/leads/neu')
  })

  it('⌥B öffnet das Bulk-Menü nur mit Auswahl', () => {
    const ohne = setup({ auswahlGroesse: 0 })
    druecke({ key: '∫', code: 'KeyB', altKey: true })
    expect(ohne.onBulkMenu).not.toHaveBeenCalled()
  })

  it('⌥B mit Auswahl', () => {
    const s = setup({ auswahlGroesse: 3 })
    druecke({ key: '∫', code: 'KeyB', altKey: true })
    expect(s.onBulkMenu).toHaveBeenCalledTimes(1)
  })

  it('⌥M → E-Mail verfassen für die Cursor-Zeile, ⌘⇧K → Anrufen', () => {
    const s = setup()
    druecke({ key: 'µ', code: 'KeyM', altKey: true })
    expect(s.onEmail).toHaveBeenCalledWith('l1')
    druecke({ key: 'K', code: 'KeyK', metaKey: true, shiftKey: true })
    expect(s.onAnrufen).toHaveBeenCalledWith('l1')
  })

  it('⌘⇧U Übergeben, ⌘⇧F Freigeben, O LinkedIn, ⌫ Zurücksetzen', () => {
    const s = setup()
    druecke({ key: 'U', code: 'KeyU', metaKey: true, shiftKey: true })
    druecke({ key: 'F', code: 'KeyF', metaKey: true, shiftKey: true })
    expect(s.onAktion).toHaveBeenCalledWith('l1', 'uebergeben')
    expect(s.onAktion).toHaveBeenCalledWith('l1', 'freigeben')
    druecke({ key: 'o', code: 'KeyO' })
    expect(s.onLinkedin).toHaveBeenCalledWith('l1')
    druecke({ key: 'Backspace', code: 'Backspace' })
    expect(s.onZuruecksetzen).toHaveBeenCalledTimes(1)
  })

  it('⌘↵ → Vollseite der Cursor-Zeile', () => {
    setup()
    druecke({ key: 'Enter', metaKey: true })
    expect(ort()).toBe('/leads/l1')
  })

  it('A B S W T N wirken auf die Cursor-Zeile – mit offenem Peek gehören sie dem Panel', () => {
    const s = setup()
    for (const [k, a] of [
      ['a', 'antwort'],
      ['b', 'beenden'],
      ['s', 'spaeter'],
      ['w', 'wiedervorlage'],
      ['t', 'termin'],
      ['n', 'notiz'],
    ] as const) {
      druecke({ key: k, code: `Key${k.toUpperCase()}` })
      expect(s.onAktion).toHaveBeenLastCalledWith('l1', a)
    }
    s.onAktion.mockClear()
    act(() => useUiStore.setState({ peekLeadId: 'l1' }))
    druecke({ key: 'b', code: 'KeyB' })
    expect(s.onAktion).not.toHaveBeenCalled()
  })

  it('mit offenem Peek: ⌘⇧U/⌘⇧F/⌥M/⌘⇧K/⌘↵/O sind nicht gebunden und verhindern nichts – das Panel bekommt die Tasten (Review)', () => {
    const s = setup()
    act(() => useUiStore.setState({ peekLeadId: 'l1' }))
    const ereignisse = [
      { key: 'U', code: 'KeyU', metaKey: true, shiftKey: true },
      { key: 'F', code: 'KeyF', metaKey: true, shiftKey: true },
      { key: 'µ', code: 'KeyM', altKey: true },
      { key: 'K', code: 'KeyK', metaKey: true, shiftKey: true },
      { key: 'Enter', metaKey: true },
      { key: 'o', code: 'KeyO' },
    ]
    for (const init of ereignisse) expect(druecke(init)).toBe(true) // true = nicht preventDefault
    expect(s.onAktion).not.toHaveBeenCalled()
    expect(s.onEmail).not.toHaveBeenCalled()
    expect(s.onAnrufen).not.toHaveBeenCalled()
    expect(s.onLinkedin).not.toHaveBeenCalled()
    expect(ort()).toBe('/leads')
  })

  it('in einem Eingabefeld sind Buchstaben und ⌥-Tasten inaktiv', () => {
    const s = setup({ auswahlGroesse: 2 })
    const feld = screen.getByLabelText('Suche')
    feld.focus()
    druecke({ key: 'b', code: 'KeyB' }, feld)
    druecke({ key: '∫', code: 'KeyB', altKey: true }, feld)
    druecke({ key: '˜', code: 'KeyN', altKey: true }, feld)
    expect(s.onAktion).not.toHaveBeenCalled()
    expect(s.onBulkMenu).not.toHaveBeenCalled()
    expect(ort()).toBe('/leads')
  })

  it('ohne Cursor passiert bei ⌥M nichts', () => {
    const s = setup({ cursorId: null })
    druecke({ key: 'µ', code: 'KeyM', altKey: true })
    expect(s.onEmail).not.toHaveBeenCalled()
  })
})
