// Später-Optionen ab max(fällig, heute) – BAUPLAN § 5.2, Beispiel A7 (Review-Korrektur: vorher immer ab heute).
import { describe, expect, it } from 'vitest'
import { spaeterBasis, spaeterOptionen } from './spaeterOptionen'

describe('spaeterOptionen', () => {
  it('A7: KF1 fällig Mo 19.10., heute Mi 14.10. → „+3 T“ = Do 22.10. (nicht Mo 19.10.)', () => {
    const o = spaeterOptionen('2026-10-14', [], '2026-10-19T07:00:00.000Z')
    expect(o[1]).toMatchObject({ kbd: '2', tag: '2026-10-22', tage: 3 })
    expect(o[0]).toMatchObject({ tag: '2026-10-20', tage: 1 })
    expect(o[3]).toMatchObject({ tag: '2026-10-26', tage: 7 })
  })

  it('überfälliger Schritt rechnet ab heute; „Nächster Montag“ und Wiedervorlage ohne `tage`', () => {
    const o = spaeterOptionen('2026-10-14', [], '2026-10-01T07:00:00.000Z')
    expect(o[1]).toMatchObject({ tag: '2026-10-19', tage: 3 }) // Sa 17.10. → Mo 19.10.
    expect(o[2]).toMatchObject({ label: 'Nächster Montag', tag: '2026-10-19' })
    expect(o[2]?.tage).toBeUndefined()
    expect(o[4]).toMatchObject({ wiedervorlage: true, tag: '2026-12-14' })
    expect(o[4]?.tage).toBeUndefined()
  })

  it('spaeterBasis: späterer von Fälligkeitstag und heute, ohne Fälligkeit heute', () => {
    expect(spaeterBasis('2026-10-14', null)).toBe('2026-10-14')
    expect(spaeterBasis('2026-10-14', '2026-10-12T07:00:00.000Z')).toBe('2026-10-14')
    expect(spaeterBasis('2026-10-14', '2026-10-19T07:00:00.000Z')).toBe('2026-10-19')
  })
})
