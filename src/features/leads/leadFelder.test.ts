// leadFelder.naechsterFollowUp (Runde 3, /leads/:id bei 1440): überfällige Follow-ups im Feldraster mit „−n T“ und Amber-Markierung.
import { describe, expect, it } from 'vitest'
import { naechsterFollowUp } from './leadFelder'

describe('naechsterFollowUp', () => {
  const heute = '2026-10-15T12:00:00+02:00'
  it('überfällig: Datum + „−8 T“ + Schritt, ueberfaellig = true', () => {
    expect(naechsterFollowUp('2026-10-07T09:00:00+02:00', 'Kurzfristig 1', heute)).toEqual({
      wert: '07.10.2026 −8\u00a0T · Kurzfristig 1',
      ueberfaellig: true,
    })
  })
  it('heute und künftig: nur Datum (+ Schritt), nicht überfällig; ohne Datum leer', () => {
    expect(naechsterFollowUp('2026-10-15T09:00:00+02:00', null, heute)).toEqual({
      wert: '15.10.2026',
      ueberfaellig: false,
    })
    expect(naechsterFollowUp('2026-10-20T09:00:00+02:00', 'Kurzfristig 2', heute).ueberfaellig).toBe(false)
    expect(naechsterFollowUp(null, 'Kurzfristig 2', heute)).toEqual({ wert: null, ueberfaellig: false })
  })
})
