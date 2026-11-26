import { describe, expect, it } from 'vitest'
import {
  monatAusParam,
  monatParam,
  monatsOptionen,
  parseZahl,
  UMSATZ,
  ZAEHLARTEN,
  zaehlartFelder,
  zaehlartVon,
  zahlFuerFeld,
} from './eingabe'
import { QUELLEN } from './rechnen'

describe('parseZahl', () => {
  it('liest ganze Zahlen mit und ohne Tausenderpunkt', () => {
    expect(parseZahl('3000')).toBe(3000)
    expect(parseZahl('3.000')).toBe(3000)
    expect(parseZahl('120.000')).toBe(120000)
    expect(parseZahl('1.250.000')).toBe(1250000)
    expect(parseZahl(' 24 ')).toBe(24)
  })

  it('liest Kommazahlen – das Komma ist das Dezimalzeichen, Punkte davor sind Tausenderpunkte', () => {
    expect(parseZahl('2,5')).toBe(2.5)
    expect(parseZahl('1.234,5')).toBe(1234.5)
    expect(parseZahl('0,5')).toBe(0.5)
  })

  it('ein Punkt ohne drei Ziffern dahinter ist ein Dezimalpunkt', () => {
    expect(parseZahl('2.5')).toBe(2.5)
    expect(parseZahl('12.75')).toBe(12.75)
  })

  it('duldet Leerzeichen und ein Eurozeichen dahinter', () => {
    expect(parseZahl('5.000 €')).toBe(5000)
    expect(parseZahl('5 000')).toBe(5000)
  })

  it('alles andere ist keine Zahl', () => {
    for (const t of ['', '   ', 'viele', '3,0,1', '-5', '1e3', '12 Stück', '1.2.3']) expect(parseZahl(t), t).toBeNull()
  })

  it('zahlFuerFeld schreibt so, dass parseZahl es wieder liest', () => {
    expect(zahlFuerFeld(3000)).toBe('3.000')
    expect(zahlFuerFeld(2.5)).toBe('2,5')
    for (const n of [1, 24, 3000, 120000, 2.5, 1234.5]) expect(parseZahl(zahlFuerFeld(n))).toBe(n)
  })
})

describe('Monat in der Adresse', () => {
  it('liest YYYY-MM und nichts anderes', () => {
    expect(monatAusParam('2026-12')).toBe('2026-12-01')
    expect(monatAusParam('2027-01')).toBe('2027-01-01')
    for (const p of [null, '', '2026-13', '2026-00', '2026-1', '2026-12-10', 'dezember']) {
      expect(monatAusParam(p), String(p)).toBeNull()
    }
  })

  it('schreibt YYYY-MM', () => {
    expect(monatParam('2026-12-01')).toBe('2026-12')
  })
})

describe('monatsOptionen', () => {
  it('12 Monate zurück bis 18 voraus, in Reihenfolge und ausgeschrieben', () => {
    const o = monatsOptionen('2026-12-10')
    expect(o).toHaveLength(31)
    expect(o[0]).toEqual({ value: '2025-12-01', label: 'Dezember 2025' })
    expect(o[12]).toEqual({ value: '2026-12-01', label: 'Dezember 2026' })
    expect(o.at(-1)).toEqual({ value: '2028-06-01', label: 'Juni 2028' })
  })

  it('ein Monat außerhalb der Liste (gezeigter Monat, Beginn des Ziels) ist trotzdem dabei – ohne Doppelte', () => {
    const o = monatsOptionen('2026-12-10', ['2024-03-15', '2026-12-01'])
    expect(o).toHaveLength(32)
    expect(o[0]).toEqual({ value: '2024-03-01', label: 'März 2024' })
  })
})

describe('Wie wird gezählt?', () => {
  it('bietet jede Quelle genau einmal an, dazu „Umsatz aus Neukunden“ – von Hand zuletzt', () => {
    const werte = ZAEHLARTEN.map((z) => z.value)
    expect([...werte].sort()).toEqual([...QUELLEN, UMSATZ].sort())
    expect(werte.at(-1)).toBe('manuell')
    expect(ZAEHLARTEN.find((z) => z.value === UMSATZ)?.label).toBe('Umsatz aus Neukunden')
  })

  it('Umsatz speichert Neukunden mit dem Wert je Kunde als Faktor und „€“ – alles andere Faktor 1 ohne Einheit', () => {
    expect(zaehlartFelder(UMSATZ, 5000)).toEqual({ quelle: 'im_geschaeft', faktor: 5000, einheit: '€' })
    expect(zaehlartFelder('im_geschaeft', 5000)).toEqual({ quelle: 'im_geschaeft', faktor: 1, einheit: null })
    expect(zaehlartFelder('manuell', 1)).toEqual({ quelle: 'manuell', faktor: 1, einheit: null })
  })

  it('erkennt Umsatz beim Bearbeiten an Neukunden mit einem Faktor ungleich 1', () => {
    expect(zaehlartVon({ quelle: 'im_geschaeft', faktor: 5000 })).toBe(UMSATZ)
    expect(zaehlartVon({ quelle: 'im_geschaeft', faktor: 1 })).toBe('im_geschaeft')
    expect(zaehlartVon({ quelle: 'angeschrieben', faktor: 1 })).toBe('angeschrieben')
  })
})
