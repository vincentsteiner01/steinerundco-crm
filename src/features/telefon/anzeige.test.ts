import { describe, expect, it } from 'vitest'
import { verpasstDauer } from './anzeige'

describe('verpasstDauer (Rückruf verpasst · hh:mm)', () => {
  it('Stunden:Minuten ohne Sekunden, zweistellig', () => {
    expect(verpasstDauer(35 * 60 + 59)).toBe('00:35')
    expect(verpasstDauer(5 * 3600 + 9 * 60 + 16)).toBe('05:09')
    expect(verpasstDauer(0)).toBe('00:00')
    expect(verpasstDauer(-20)).toBe('00:00')
  })
})
