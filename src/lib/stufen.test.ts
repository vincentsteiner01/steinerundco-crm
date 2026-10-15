// BAUPLAN § 3.1.12 – Gruppen vollständig, Rank monoton (§ 1.5 Nr. 1, crm.stage_rank).
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import type { LeadStage } from '@/types/domain'
import {
  ERSTE_STAGE_DER_PHASE,
  PHASEN,
  STUFEN,
  phaseIndex,
  phaseNachKey,
  phaseVon,
  stageLabel,
  stageRank,
  stageShort,
} from './stufen'

describe('PHASEN', () => {
  it('10 Gruppen decken alle 16 Stufen genau einmal ab', () => {
    expect(PHASEN).toHaveLength(10)
    const alle = PHASEN.flatMap((p) => p.stages)
    expect(alle).toHaveLength(16)
    expect(new Set(alle).size).toBe(16)
    expect([...alle].sort()).toEqual([...STUFEN].sort())
    expect(STUFEN).toHaveLength(16)
  })
  it('Zuordnung § 1.5 Nr. 1', () => {
    expect(phaseVon('neu').key).toBe('angefragt')
    expect(phaseVon('vernetzung_gesendet').key).toBe('angefragt')
    expect(phaseVon('vernetzt').key).toBe('vernetzt')
    expect(phaseVon('gespraech_eroeffnet').key).toBe('eroeffnet')
    expect(phaseVon('dm_follow_up').key).toBe('eroeffnet')
    expect(phaseVon('dm_beantwortet').key).toBe('beantwortet')
    expect(phaseVon('bedarfsermittlung').key).toBe('beantwortet')
    expect(phaseVon('pitch').key).toBe('gepitcht')
    expect(phaseVon('erstgespraech_vereinbart').key).toBe('erstgespraech')
    expect(phaseVon('erstgespraech').key).toBe('erstgespraech')
    expect(phaseVon('strategiegespraech_vereinbart').key).toBe('strategiegespraech')
    expect(phaseVon('strategiegespraech').key).toBe('strategiegespraech')
    expect(phaseVon('sales_follow_up').key).toBe('strategiegespraech')
    expect(phaseVon('kunde').key).toBe('kunde')
    expect(phaseVon('langfristig').key).toBe('wiedervorlage')
    expect(phaseVon('beendet').key).toBe('beendet')
  })
  it('Töne nach DESIGN-SYSTEM § 3.3 und Labels aus de.ts', () => {
    expect(phaseNachKey('kunde').ton).toBe('won')
    expect(phaseNachKey('beendet').ton).toBe('ended')
    for (const k of ['angefragt', 'vernetzt', 'wiedervorlage'] as const) expect(phaseNachKey(k).ton).toBe('muted')
    for (const k of ['eroeffnet', 'beantwortet', 'gepitcht', 'erstgespraech', 'strategiegespraech'] as const)
      expect(phaseNachKey(k).ton).toBe('neutral')
    expect(phaseNachKey('wiedervorlage').label).toBe('Wiedervorlage')
    expect(ERSTE_STAGE_DER_PHASE.angefragt).toBe('neu')
    expect(ERSTE_STAGE_DER_PHASE.strategiegespraech).toBe('strategiegespraech_vereinbart')
    expect(phaseIndex('neu')).toBe(0)
    expect(phaseIndex('beendet')).toBe(9)
  })
})

describe('stageRank', () => {
  it('ist exakt crm.stage_rank', () => {
    const erwartet: Record<LeadStage, number> = {
      neu: 0,
      vernetzung_gesendet: 10,
      vernetzt: 20,
      gespraech_eroeffnet: 30,
      dm_follow_up: 35,
      dm_beantwortet: 40,
      bedarfsermittlung: 50,
      pitch: 60,
      erstgespraech_vereinbart: 70,
      erstgespraech: 80,
      strategiegespraech_vereinbart: 90,
      strategiegespraech: 100,
      sales_follow_up: 110,
      kunde: 120,
      langfristig: 5,
      beendet: -10,
    }
    for (const s of STUFEN) expect(stageRank(s), s).toBe(erwartet[s])
  })
  it('ist entlang des Funnels (neu … kunde) streng monoton steigend', () => {
    const funnel = STUFEN.slice(0, STUFEN.indexOf('kunde') + 1)
    for (let i = 1; i < funnel.length; i++)
      expect(stageRank(funnel[i] as LeadStage)).toBeGreaterThan(stageRank(funnel[i - 1] as LeadStage))
    expect(stageRank('langfristig')).toBeLessThan(stageRank('vernetzung_gesendet'))
    expect(stageRank('beendet')).toBeLessThan(stageRank('neu'))
  })
})

describe('stageLabel / stageShort', () => {
  it('Primärquelle settings.stage_labels, Fallback de.ts', () => {
    expect(stageLabel('langfristig')).toBe('Wiedervorlage')
    expect(stageShort('vernetzung_gesendet')).toBe('Angefragt')
    expect(stageLabel('pitch', SETTINGS)).toBe('Erstgespräch gepitcht')
    expect(stageLabel('pitch', SETTINGS.stage_labels)).toBe('Erstgespräch gepitcht')
    const eigene = {
      ...SETTINGS,
      stage_labels: {
        ...SETTINGS.stage_labels,
        pitch: { label: 'Gepitcht X', short: 'PX', group: 'linkedin' as const },
      },
    }
    expect(stageLabel('pitch', eigene)).toBe('Gepitcht X')
    expect(stageShort('pitch', eigene)).toBe('PX')
    expect(stageLabel('pitch', null)).toBe('Erstgespräch gepitcht')
  })
})
