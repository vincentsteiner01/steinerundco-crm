// phasen.ts (BAUPLAN § 3.7 Unit-Tests): Reihenfolge, alle template_phase-Werte abgedeckt, jede Phase mit beschreibung,
// die vier LinkedIn-Texte identisch mit import/leitfaeden.json[phases].ziel (lokale Fixture, siehe FOUNDATION-WUNSCH.md).
import { describe, expect, it } from 'vitest'
import type { TemplatePhase } from '@/types/domain'
import fixture from '@/test/fixtures/leitfadenPhasen.json'
import { KANAELE, KEY_PRAEFIX, labelTeile, PHASEN, phaseDef, phaseRang, phasenFuer } from './phasen'

const ALLE_PHASEN: TemplatePhase[] = [
  'vernetzung',
  'eroeffnung',
  'bedarfsermittlung',
  'pitch',
  'follow_up',
  'langfristig',
  'gatekeeper',
  'einstieg',
  'problem',
  'qualifizierung',
  'einwand',
  'abschluss',
  'mailbox',
  'rueckruf',
  'datenschutz',
  'zusammenfassung',
  'nachfassen',
  'infomail',
  'transaktional',
  'erstgespraech',
  'strategiegespraech',
  'einwandbehandlung',
  'angebot',
]

describe('phasen', () => {
  it('Kanäle in Baum-Reihenfolge LinkedIn · Telefon · E-Mail', () => {
    expect(KANAELE).toEqual(['linkedin', 'telefon', 'email', 'sonstiges'])
  })

  it('deckt jeden template_phase-Wert in mindestens einem Kanal ab', () => {
    const abgedeckt = new Set(KANAELE.flatMap((k) => PHASEN[k].map((p) => p.key)))
    for (const p of ALLE_PHASEN) expect(abgedeckt.has(p), p).toBe(true)
  })

  it('jede Phase hat Label und nicht-leere beschreibung', () => {
    for (const k of KANAELE)
      for (const p of PHASEN[k]) {
        expect(p.label.trim().length).toBeGreaterThan(0)
        expect(p.beschreibung.trim().length).toBeGreaterThan(0)
      }
  })

  it('LinkedIn-Reihenfolge 0 Vernetzung · 1 Gesprächseröffnung · 2 Bedarfsermittlung · 3 Pitch · 4 Follow-ups · 4 Langfristig', () => {
    expect(phasenFuer('linkedin').map((p) => p.label)).toEqual([
      '0 Vernetzung',
      '1 Gesprächseröffnung',
      '2 Bedarfsermittlung',
      '3 Pitch',
      '4 Follow-ups',
      '4 Langfristig',
    ])
  })

  it('die vier Stufen-Zwecke sind wörtlich import/leitfaeden.json[phases].ziel (§ 1.5 Nr. 41, LF-11)', () => {
    const nachNummer = new Map(fixture.phases.map((p) => [p.phase, p.ziel]))
    expect(phaseDef('linkedin', 'eroeffnung').beschreibung).toBe(nachNummer.get(1))
    expect(phaseDef('linkedin', 'bedarfsermittlung').beschreibung).toBe(nachNummer.get(2))
    expect(phaseDef('linkedin', 'pitch').beschreibung).toBe(nachNummer.get(3))
    expect(phaseDef('linkedin', 'follow_up').beschreibung).toBe(nachNummer.get(4))
    expect(phaseDef('linkedin', 'eroeffnung').beschreibung).toBe('Problem erkennen & Antwort auslösen')
  })

  it('Telefon: zehn Phasen in Reihenfolge Zentrale … Datenschutz (LF-09)', () => {
    expect(phasenFuer('telefon').map((p) => p.key)).toEqual([
      'gatekeeper',
      'einstieg',
      'problem',
      'qualifizierung',
      'pitch',
      'einwand',
      'abschluss',
      'mailbox',
      'rueckruf',
      'datenschutz',
    ])
    expect(phasenFuer('telefon')[0]?.label).toBe('Zentrale')
  })

  it('E-Mail: vier Phasen; Sales (Kanal sonstiges) vier Gesprächsphasen', () => {
    expect(phasenFuer('email').map((p) => p.key)).toEqual([
      'zusammenfassung',
      'nachfassen',
      'infomail',
      'transaktional',
    ])
    expect(phasenFuer('sonstiges').map((p) => p.key)).toEqual([
      'erstgespraech',
      'strategiegespraech',
      'einwandbehandlung',
      'angebot',
    ])
  })

  it('phaseDef, phaseRang, labelTeile, KEY_PRAEFIX', () => {
    expect(phaseDef('telefon', 'pitch').beschreibung).toBe('15-Minuten-Erstgespräch anbieten')
    expect(phaseDef('email', 'pitch')).toEqual({ key: 'pitch', label: 'pitch', beschreibung: '' })
    expect(phaseRang('linkedin', 'pitch')).toBe(3)
    expect(phaseRang('email', 'pitch')).toBe(999)
    expect(labelTeile('1 Gesprächseröffnung')).toEqual({ ziffer: '1', text: 'Gesprächseröffnung' })
    expect(labelTeile('Zentrale')).toEqual({ ziffer: null, text: 'Zentrale' })
    expect(KEY_PRAEFIX).toEqual({ linkedin: 'li', telefon: 'tel', email: 'em', sonstiges: 'sales' })
  })
})
