import { describe, expect, it } from 'vitest'
import {
  fmtEuro,
  geplantImMonat,
  kennzahlen,
  letzte12Monate,
  monatsreihe,
  parseEuro,
  proMonat,
  volumen,
  type Auftrag,
  type Zahlung,
} from './rechnung'

const auftrag = (a: Partial<Auftrag>): Auftrag => ({
  id: 'c1',
  customer: 'Muster GmbH',
  start_date: '2026-08-01',
  setup_amount: 17500,
  recurring_amount: 1500,
  frequency: 'monatlich',
  term_months: 12,
  ...a,
})

describe('Volumen und Plan (wie Mikes Sales Hub)', () => {
  it('17.500 € einmalig + 1.500 € monatlich über 12 Monate', () => {
    const a = auftrag({})
    expect(volumen(a)).toBe(17500 + 18000)
    expect(geplantImMonat(a, '2026-08')).toBe(19000)
    expect(geplantImMonat(a, '2026-09')).toBe(1500)
    expect(geplantImMonat(a, '2027-07')).toBe(1500)
    expect(geplantImMonat(a, '2027-08')).toBe(0)
    expect(geplantImMonat(a, '2026-07')).toBe(0)
  })

  it('vierteljährlich wird auf Monate umgelegt; unbefristet = nur einmalig im Volumen', () => {
    const q = auftrag({ frequency: 'vierteljaehrlich', recurring_amount: 3000, setup_amount: 0, term_months: null })
    expect(proMonat(q)).toBe(1000)
    expect(volumen(q)).toBe(0)
    expect(geplantImMonat(q, '2030-01')).toBe(1000)
  })

  it('numeric als Text', () => {
    expect(volumen(auftrag({ setup_amount: '100.50' as unknown as number, term_months: null }))).toBe(100.5)
  })
})

describe('Reihe und Kennzahlen', () => {
  const z: Zahlung[] = [
    { id: 'p1', contract_id: 'c1', paid_on: '2026-08-15', amount: 19000 },
    { id: 'p2', contract_id: 'c1', paid_on: '2026-10-02', amount: 1500 },
    { id: 'p3', contract_id: 'c1', paid_on: '2025-12-30', amount: 500 },
  ]

  it('letzte12Monate endet im aktuellen Monat', () => {
    const m = letzte12Monate('2026-10-23')
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('2025-11')
    expect(m[11]).toBe('2026-10')
  })

  it('monatsreihe: erhalten vs. geplant', () => {
    const r = monatsreihe([auftrag({})], z, '2026-10-23')
    expect(r.find((x) => x.monat === '2026-08')).toEqual({ monat: '2026-08', erhalten: 19000, geplant: 19000 })
    expect(r.find((x) => x.monat === '2026-09')).toEqual({ monat: '2026-09', erhalten: 0, geplant: 1500 })
  })

  it('kennzahlen: Monat, Jahr, gesamt, Volumen', () => {
    expect(kennzahlen([auftrag({})], z, '2026-10-23')).toEqual({
      monat: 1500,
      jahr: 20500,
      gesamt: 21000,
      volumen: 35500,
    })
  })
})

describe('Euro', () => {
  it('fmtEuro ohne unnötige Cent', () => {
    expect(fmtEuro(17500)).toBe('17.500 €')
    expect(fmtEuro(1234.5)).toBe('1.234,50 €')
  })

  it('parseEuro versteht deutsche Schreibweisen', () => {
    expect(parseEuro('1.500')).toBe(1500)
    expect(parseEuro('1500,50')).toBe(1500.5)
    expect(parseEuro('17.500 €')).toBe(17500)
    expect(parseEuro('')).toBe(0)
    expect(parseEuro('abc')).toBeNull()
    expect(parseEuro('-5')).toBeNull()
  })
})
