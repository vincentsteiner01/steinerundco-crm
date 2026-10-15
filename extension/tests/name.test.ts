import { describe, expect, it } from 'vitest'
import { bereinigeName, gleicherName, teileName } from '../src/shared/name'

describe('Namen', () => {
  it.each([
    ['Tilda Testfall', { titel: null, vorname: 'Tilda', nachname: 'Testfall' }],
    ['Dr. Jonas Beispielmann', { titel: 'Dr.', vorname: 'Jonas', nachname: 'Beispielmann' }],
    ['Prof. Dr. Hanna Muster', { titel: 'Prof. Dr.', vorname: 'Hanna', nachname: 'Muster' }],
    ['Dr.-Ing. Kai Probe', { titel: 'Dr.-Ing.', vorname: 'Kai', nachname: 'Probe' }],
    ['Dipl.-Ing. Kai Probe', { titel: null, vorname: 'Kai', nachname: 'Probe' }],
    ['Hans-Peter von der Testheide', { titel: null, vorname: 'Hans-Peter', nachname: 'von der Testheide' }],
    ['Anna Maria Beispiel', { titel: null, vorname: 'Anna Maria', nachname: 'Beispiel' }],
    ['Paul Probe, MBA', { titel: null, vorname: 'Paul', nachname: 'Probe' }],
    ['Lea Platzhalter (sie/ihr) ☀️', { titel: null, vorname: 'Lea', nachname: 'Platzhalter' }],
    ['Lea Platzhalter – Solar', { titel: null, vorname: 'Lea', nachname: 'Platzhalter' }],
    ['Madonna', { titel: null, vorname: 'Madonna', nachname: null }],
    ['', { titel: null, vorname: null, nachname: null }],
  ])('%s', (roh, erwartet) => {
    expect(teileName(roh)).toEqual(erwartet)
  })

  it('bereinigt Sonderzeichen am Rand', () => {
    expect(bereinigeName('✓ Tilda Testfall ✓')).toBe('Tilda Testfall')
    expect(bereinigeName('  ')).toBeNull()
  })

  it('vergleicht Namen tolerant', () => {
    expect(gleicherName('Tilda Testfall', 'tilda testfall')).toBe(true)
    expect(gleicherName('Jürgen Probe', 'Jurgen Probe')).toBe(true)
    expect(gleicherName('Tilda Anna Testfall', 'Tilda Testfall')).toBe(true)
    expect(gleicherName('Tilda Testfall', 'Paul Probe')).toBe(false)
    expect(gleicherName(null, 'Paul Probe')).toBe(false)
  })
})
