// useHeute: der Berliner Kalendertag wechselt mit – beim Fokus, beim Sichtbarwerden, im Minutentakt und auf Zuruf.
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { heutePruefen, useHeute } from './useHeute'

let gerendert = 0
function Anzeige() {
  gerendert++
  return <span data-testid="tag">{useHeute()}</span>
}
const tag = () => screen.getByTestId('tag').textContent

beforeEach(() => {
  gerendert = 0
  vi.useFakeTimers({ now: new Date('2026-11-25T23:50:00+01:00') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useHeute', () => {
  it('liefert den Berliner Kalendertag – kurz vor Mitternacht noch den alten', () => {
    render(<Anzeige />)
    expect(tag()).toBe('2026-11-25')
  })

  it('nach Mitternacht: der Fokus des Fensters bringt den neuen Tag', () => {
    render(<Anzeige />)
    vi.setSystemTime(new Date('2026-11-26T08:00:00+01:00'))
    expect(tag()).toBe('2026-11-25')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(tag()).toBe('2026-11-26')
  })

  it('ebenso das Sichtbarwerden und der Zuruf heutePruefen()', () => {
    render(<Anzeige />)
    vi.setSystemTime(new Date('2026-11-26T08:00:00+01:00'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(tag()).toBe('2026-11-26')
    vi.setSystemTime(new Date('2026-11-27T08:00:00+01:00'))
    act(() => heutePruefen())
    expect(tag()).toBe('2026-11-27')
  })

  it('ohne jedes Ereignis: spätestens eine Minute nach Mitternacht', () => {
    render(<Anzeige />)
    act(() => {
      vi.advanceTimersByTime(9 * 60_000)
    })
    expect(tag()).toBe('2026-11-25') // 23:59
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(tag()).toBe('2026-11-26') // 00:00
  })

  it('derselbe Tag rendert nicht neu; nach dem Abbau hört niemand mehr zu', () => {
    const { unmount } = render(<Anzeige />)
    const vorher = gerendert
    act(() => {
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(3 * 60_000)
    })
    expect(gerendert).toBe(vorher)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(() => heutePruefen()).not.toThrow()
  })
})
