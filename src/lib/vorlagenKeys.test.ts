// BAUPLAN § 3.1.12 / § 1.5 Nr. 24 – jeder Key in VORLAGE/SEQUENZ existiert in seedKeys.json (Seed + Migration 2);
// PHASE2_VORLAGE_NACH_LABEL deckt alle ReplyLabel ab.
import { describe, expect, it } from 'vitest'
import seedKeys from '@/test/fixtures/seedKeys.json'
import type { ReplyLabel } from '@/types/domain'
import { OPENER_NACH_ROLLE, PHASE2_VORLAGE_NACH_LABEL, SEQUENZ, VORLAGE, phase2Vorlage } from './vorlagenKeys'

type Seed = { templates: string[]; sequences: string[] }
const seed = seedKeys as Seed

const REPLY_LABELS: ReplyLabel[] = [
  'interessiert',
  'frage',
  'kein_bedarf',
  'spaeter',
  'nicht_icp',
  'hat_partner',
  'falsches_problem',
  'widerspruch',
  'sonstiges',
]

describe('VORLAGE / SEQUENZ', () => {
  it('Schlüssel = Wert und jeder Key existiert im Seed', () => {
    for (const [k, v] of Object.entries(VORLAGE)) {
      expect(v).toBe(k)
      expect(seed.templates, k).toContain(v)
    }
    for (const [k, v] of Object.entries(SEQUENZ)) {
      expect(v).toBe(k)
      expect(seed.sequences, k).toContain(v)
    }
  })
  it('alle Seed-Sequenzen sind im Client referenzierbar', () => {
    expect([...seed.sequences].sort()).toEqual(Object.keys(SEQUENZ).sort())
  })
  it('nur li_/tel_/em_-Präfixe; Telefon-Skripte nach Phase bleiben draußen (§ 4.6)', () => {
    for (const k of Object.keys(VORLAGE)) expect(k).toMatch(/^(li|tel|em)_[a-z0-9_]+$/)
    expect(Object.keys(VORLAGE).some((k) => k.startsWith('tel_gatekeeper'))).toBe(false)
    expect(Object.keys(VORLAGE).some((k) => k.startsWith('tel_einwand'))).toBe(false)
  })
  it('die in § 1.5 Nr. 24 korrigierten Keys', () => {
    expect(VORLAGE.li_eroeffnung_kundenbetreuer).toBe('li_eroeffnung_kundenbetreuer')
    expect(VORLAGE.li_bedarf_hat_partner).toBe('li_bedarf_hat_partner')
    expect(VORLAGE.li_bedarf_nein_falsches_problem).toBe('li_bedarf_nein_falsches_problem')
  })
})

describe('PHASE2_VORLAGE_NACH_LABEL', () => {
  it('deckt alle ReplyLabel ab und zeigt nur auf VORLAGE-Keys', () => {
    expect(Object.keys(PHASE2_VORLAGE_NACH_LABEL).sort()).toEqual([...REPLY_LABELS].sort())
    for (const l of REPLY_LABELS) {
      const v = PHASE2_VORLAGE_NACH_LABEL[l]
      if (v !== null) expect(VORLAGE[v]).toBe(v)
    }
    expect(PHASE2_VORLAGE_NACH_LABEL.nicht_icp).toBeNull()
    expect(PHASE2_VORLAGE_NACH_LABEL.widerspruch).toBeNull()
    expect(PHASE2_VORLAGE_NACH_LABEL.frage).toBe('li_bedarf_ja_v3')
  })
  it('phase2Vorlage: kein_bedarf mit Zitat → nein_mit_grund', () => {
    expect(phase2Vorlage('kein_bedarf', false)).toBe('li_bedarf_nein_ohne_grund')
    expect(phase2Vorlage('kein_bedarf', true)).toBe('li_bedarf_nein_mit_grund')
    expect(phase2Vorlage('interessiert', true)).toBe('li_bedarf_ja_v1')
  })
})

describe('OPENER_NACH_ROLLE', () => {
  it('Kundenbetreuer/Innendienst → eigene Eröffnung, sonst null', () => {
    expect(OPENER_NACH_ROLLE('kundenbetreuer')).toBe('li_eroeffnung_kundenbetreuer')
    expect(OPENER_NACH_ROLLE('innendienst')).toBe('li_eroeffnung_kundenbetreuer')
    for (const r of ['geschaeftsfuehrer', 'inhaber', 'vertrieb', 'projektleiter', 'sonstiges', 'unbekannt'] as const)
      expect(OPENER_NACH_ROLLE(r)).toBeNull()
  })
})
