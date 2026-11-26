// Eingabe-Logik „Meine Vernetzungen“: Feldtext ↔ Zahl, Grenzen 0–9999, „geändert?“. Erfundene Zahlen.
import { describe, expect, it } from 'vitest'
import { feldGeaendert, feldText, zahlAusEingabe } from './tageszaehlerLogik'

describe('zahlAusEingabe', () => {
  it('leer = 0', () => {
    expect(zahlAusEingabe('')).toBe(0)
    expect(zahlAusEingabe('   ')).toBe(0)
  })

  it('ganze Zahlen 0–9999, Leerraum und führende Nullen stören nicht', () => {
    expect(zahlAusEingabe('0')).toBe(0)
    expect(zahlAusEingabe('20')).toBe(20)
    expect(zahlAusEingabe(' 7 ')).toBe(7)
    expect(zahlAusEingabe('007')).toBe(7)
    expect(zahlAusEingabe('9999')).toBe(9999)
  })

  it('alles andere ist ungültig', () => {
    for (const t of [
      '10000',
      '-1',
      '+3',
      '2,5',
      '2.5',
      '1.000',
      '1e3',
      'zwölf',
      '12 3',
      '١٢',
      '99999999999999999999',
    ]) {
      expect(zahlAusEingabe(t), t).toBeNull()
    }
  })
})

describe('feldText', () => {
  it('null (noch nichts eingetragen) = leeres Feld, 0 bleibt 0', () => {
    expect(feldText(null)).toBe('')
    expect(feldText(undefined)).toBe('')
    expect(feldText(0)).toBe('0')
    expect(feldText(20)).toBe('20')
  })
})

describe('feldGeaendert', () => {
  it('vergleicht die Zahl, nicht den Text', () => {
    expect(feldGeaendert('20', 20)).toBe(false)
    expect(feldGeaendert('020', 20)).toBe(false)
    expect(feldGeaendert('21', 20)).toBe(true)
  })

  it('ein geleertes Feld ist 0 – geändert, wenn vorher etwas anderes stand', () => {
    expect(feldGeaendert('', 20)).toBe(true)
    expect(feldGeaendert('', 0)).toBe(false)
  })

  it('noch nichts eingetragen: leer lassen ändert nichts, eine getippte 0 schon', () => {
    expect(feldGeaendert('', null)).toBe(false)
    expect(feldGeaendert('0', null)).toBe(true)
    expect(feldGeaendert('5', null)).toBe(true)
  })

  it('eine ungültige Eingabe gilt als Abweichung (gesperrt wird über die Prüfung)', () => {
    expect(feldGeaendert('abc', 20)).toBe(true)
  })
})
