// dropRegeln.test.ts (BAUPLAN § 3.3): 10 Ziele → Aktion; Rückwärts-Erkennung; Nachbarphasen für ⇧→/⇧←.
import { describe, expect, it } from 'vitest'
import { PHASEN } from '@/lib/stufen'
import { brauchtDialog, dropRegel, istGleichePhase, istRueckwaerts, nachbarPhase } from './dropRegeln'

describe('dropRegeln', () => {
  it('alle 10 Phasen → verbindliche Aktion', () => {
    expect(PHASEN.map((p) => [p.key, dropRegel(p.key)])).toEqual([
      ['angefragt', { art: 'stage', stage: 'vernetzung_gesendet' }],
      ['vernetzt', { art: 'stage', stage: 'vernetzt' }],
      ['eroeffnet', { art: 'stage', stage: 'gespraech_eroeffnet' }],
      ['beantwortet', { art: 'stage', stage: 'dm_beantwortet' }],
      ['gepitcht', { art: 'stage', stage: 'pitch' }],
      ['erstgespraech', { art: 'termin', typ: 'erstgespraech' }],
      ['strategiegespraech', { art: 'termin', typ: 'strategiegespraech' }],
      ['kunde', { art: 'kunde' }],
      ['wiedervorlage', { art: 'wiedervorlage' }],
      ['beendet', { art: 'beenden' }],
    ])
  })

  it('Pflichtdialoge: Erstgespräch, Strategiegespräch, Kunde, Wiedervorlage, Beendet (P-03, P-04)', () => {
    expect(PHASEN.filter((p) => brauchtDialog(dropRegel(p.key))).map((p) => p.key)).toEqual([
      'erstgespraech',
      'strategiegespraech',
      'kunde',
      'wiedervorlage',
      'beendet',
    ])
  })

  it('rückwärts: Gepitcht → Beantwortet, nicht Eröffnet → Beantwortet; gleiche Phase erkannt', () => {
    expect(istRueckwaerts('pitch', 'beantwortet')).toBe(true)
    expect(istRueckwaerts('gespraech_eroeffnet', 'beantwortet')).toBe(false)
    expect(istGleichePhase('dm_follow_up', 'eroeffnet')).toBe(true)
    expect(istGleichePhase('dm_follow_up', 'beantwortet')).toBe(false)
  })

  it('Nachbarphasen für ⇧→ / ⇧← (P-05), Rand → null', () => {
    expect(nachbarPhase('gespraech_eroeffnet', 1)).toBe('beantwortet')
    expect(nachbarPhase('gespraech_eroeffnet', -1)).toBe('vernetzt')
    expect(nachbarPhase('neu', -1)).toBeNull()
    expect(nachbarPhase('beendet', 1)).toBeNull()
  })
})
