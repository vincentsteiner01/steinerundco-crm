import { describe, expect, it } from 'vitest'
import { tabSichtbar, verpasstDauer } from './anzeige'

describe('verpasstDauer (Rückruf verpasst · hh:mm)', () => {
  it('Stunden:Minuten ohne Sekunden, zweistellig', () => {
    expect(verpasstDauer(35 * 60 + 59)).toBe('00:35')
    expect(verpasstDauer(5 * 3600 + 9 * 60 + 16)).toBe('05:09')
    expect(verpasstDauer(0)).toBe('00:00')
    expect(verpasstDauer(-20)).toBe('00:00')
  })
})

describe('tabSichtbar (Skript-Tab-Leiste scrollt den aktiven Tab ins Bild)', () => {
  it('lässt sichtbare Tabs in Ruhe', () => {
    expect(tabSichtbar(0, 300, 100, 80)).toBe(0)
  })
  it('scrollt nach rechts, wenn der Tab rechts abgeschnitten ist', () => {
    expect(tabSichtbar(0, 300, 280, 80)).toBe(72)
  })
  it('scrollt nach links, wenn der Tab links verdeckt ist', () => {
    expect(tabSichtbar(200, 300, 40, 80)).toBe(28)
    expect(tabSichtbar(200, 300, 5, 80)).toBe(0)
  })
})
