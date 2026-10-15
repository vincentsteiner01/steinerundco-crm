// CallBlock: Session-Persistenz in localStorage, Fortschritt, Überspringen, 2-h-Hinweis (BAUPLAN § 3.4 CallBlock.ts)
import { beforeEach, describe, expect, it } from 'vitest'
import {
  _blockCacheZuruecksetzen,
  BLOCK_KEY,
  blockBeenden,
  blockDauerSec,
  blockFortschritt,
  blockHinweisFaellig,
  blockHinweisGezeigt,
  blockLesen,
  blockNaechster,
  blockPositionSetzen,
  blockStarten,
  blockUeberspringen,
  blockZeit,
} from './CallBlock'

describe('CallBlock', () => {
  beforeEach(() => {
    localStorage.clear()
    _blockCacheZuruecksetzen()
  })

  it('startet eine Session in localStorage und liest sie mit stabiler Referenz zurück', () => {
    const s = blockStarten(['a', 'b', 'c'], new Date('2026-10-14T07:30:00.000Z'))
    expect(JSON.parse(localStorage.getItem(BLOCK_KEY) ?? '{}')).toMatchObject({
      id: s.id,
      listeIds: ['a', 'b', 'c'],
      position: 0,
      uebersprungen: [],
    })
    expect(blockLesen()).toBe(blockLesen())
    expect(blockLesen()?.start).toBe('2026-10-14T07:30:00.000Z')
    blockBeenden()
    expect(blockLesen()).toBeNull()
  })

  it('Fortschritt, nächster Lead, Position setzen', () => {
    const s = blockStarten(['a', 'b', 'c'])
    expect(blockFortschritt(s, 'b')).toEqual({ nummer: 2, gesamt: 3 })
    expect(blockNaechster(s, 'a')).toBe('b')
    expect(blockNaechster(s, 'c')).toBeNull()
    const s2 = blockPositionSetzen(s, 'c')
    expect(s2.position).toBe(2)
    expect(blockLesen()?.position).toBe(2)
  })

  it('⌘⇧X: Lead ans Listenende, kein Versuch; letzter Lead → Liste erschöpft', () => {
    const s = blockStarten(['a', 'b', 'c'])
    const r = blockUeberspringen(s, 'a')
    expect(r.session.listeIds).toEqual(['b', 'c', 'a'])
    expect(r.session.uebersprungen).toEqual(['a'])
    expect(r.naechster).toBe('b')
    const r2 = blockUeberspringen(r.session, 'a')
    expect(r2.naechster).toBeNull()
    expect(r2.session.listeIds).toEqual(['b', 'c', 'a'])
  })

  it('Timer „Block 00:42 / 2:00“ und Hinweis nach 2 h (einmalig)', () => {
    const start = new Date('2026-10-14T07:30:00.000Z')
    const s = blockStarten(['a'], start)
    expect(blockDauerSec(s, new Date(start.getTime() + 42_000))).toBe(42)
    expect(blockZeit(42)).toBe('00:42 / 2:00')
    expect(blockHinweisFaellig(s, new Date(start.getTime() + 119 * 60_000))).toBe(false)
    expect(blockHinweisFaellig(s, new Date(start.getTime() + 120 * 60_000))).toBe(true)
    const s2 = blockHinweisGezeigt(s)
    expect(blockHinweisFaellig(s2, new Date(start.getTime() + 180 * 60_000))).toBe(false)
  })

  it('ignoriert kaputte Einträge', () => {
    localStorage.setItem(BLOCK_KEY, '{"id":1}')
    expect(blockLesen()).toBeNull()
    localStorage.setItem(BLOCK_KEY, 'kein json')
    _blockCacheZuruecksetzen()
    expect(blockLesen()).toBeNull()
  })
})
