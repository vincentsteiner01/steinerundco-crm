import { describe, expect, it } from 'vitest'
import { aktiveVariante, vorlagenFamilie, type VorlageWahl } from './vorlagenWahl'

const v = (
  name: string,
  active: boolean,
  sort_order: number,
  phase = 'eroeffnung',
  channel = 'linkedin',
): VorlageWahl => ({
  id: name,
  name,
  channel,
  phase,
  active,
  sort_order,
})

const ALLE = [
  v('Gesprächseröffnung (V1)', false, 101),
  v('Gesprächseröffnung (V2)', false, 102),
  v('Gesprächseröffnung (ZG - Kundenbetreuer)', false, 105),
  v('Gesprächseröffnung (V3)', true, 106),
  v('Ja (V1)', true, 201, 'bedarfsermittlung'),
  v('Nein (ohne Grund)', false, 203, 'bedarfsermittlung'),
]

describe('aktiveVariante', () => {
  it('Familie = Name vor der Klammer', () => {
    expect(vorlagenFamilie('Gesprächseröffnung (ZG - Kundenbetreuer)')).toBe('gesprächseröffnung')
  })

  it('inaktive V1 → aktive V3 derselben Familie', () => {
    expect(aktiveVariante(ALLE[0], ALLE)?.name).toBe('Gesprächseröffnung (V3)')
    expect(aktiveVariante(ALLE[2], ALLE)?.name).toBe('Gesprächseröffnung (V3)')
  })

  it('aktive Vorlage bleibt; ohne aktive Variante bleibt die ursprüngliche; null bleibt null', () => {
    expect(aktiveVariante(ALLE[4], ALLE)?.name).toBe('Ja (V1)')
    // „Nein (ohne Grund)“ hat keine aktive Variante – keine fremde Familie („Ja“) einsetzen
    expect(aktiveVariante(ALLE[5], ALLE)?.name).toBe('Nein (ohne Grund)')
    expect(aktiveVariante(null, ALLE)).toBeNull()
  })
})
