// BAUPLAN § 3.1.12 – Formate nach ux § 6.4 / TY-03, TY-04; Zeitzone Europe/Berlin (Tests laufen in UTC).
import { describe, expect, it } from 'vitest'
import {
  MINUS,
  dateline,
  datelineKurz,
  fmtDatum,
  fmtDatumKurz,
  fmtDatumZeit,
  fmtDauer,
  fmtDelta,
  fmtPp,
  fmtProzent,
  fmtVerhaeltnis,
  fmtZahl,
  fmtZeit,
  fmtZeitraum,
  heuteBerlin,
  monatLabel,
  relativ,
} from './format'
import { fmtTelefon } from './telefon'

const SCHMAL = ' '
const NBSP = ' '
// Mi 14.10.2026 16:12 Berlin (CEST) = 14:12 UTC
const MI = new Date('2026-10-14T14:12:00Z')

describe('Datum und Zeit (Europe/Berlin)', () => {
  it('fmtDatum / fmtDatumKurz / fmtDatumZeit / fmtZeit', () => {
    expect(fmtDatum(MI)).toBe('14.10.2026')
    expect(fmtDatumKurz(MI)).toBe('Mi 14.10.')
    expect(fmtDatumZeit('2026-10-16T08:00:00Z')).toBe('16.10.2026, 10:00')
    expect(fmtZeit('2026-10-14T07:41:00Z')).toBe('09:41')
  })
  it('rechnet UTC-Mitternacht auf den Berliner Tag um', () => {
    expect(fmtDatum('2026-10-14T22:30:00Z')).toBe('15.10.2026') // 00:30 Berlin
    expect(fmtDatumKurz('2026-10-14T22:30:00Z')).toBe('Do 15.10.')
    expect(fmtZeit('2026-01-14T23:30:00Z')).toBe('00:30') // Winterzeit +1
  })
  it('nimmt reine Kalendertage entgegen', () => {
    expect(fmtDatum('2026-10-14')).toBe('14.10.2026')
    expect(fmtDatumKurz('2026-10-17')).toBe('Sa 17.10.')
    expect(fmtDatumKurz('2026-10-18')).toBe('So 18.10.')
  })
  it('dateline', () => {
    expect(dateline(MI)).toBe('Mittwoch, 14. Oktober 2026 · KW 42')
    expect(dateline('2027-01-01')).toBe('Freitag, 1. Januar 2027 · KW 53')
    expect(dateline('2026-01-01')).toBe('Donnerstag, 1. Januar 2026 · KW 1')
  })
  it('datelineKurz (Telefon, Runde 2)', () => {
    expect(datelineKurz(MI)).toBe('Mi 14.10. · KW 42')
    expect(datelineKurz('2027-01-01')).toBe('Fr 01.01. · KW 53')
  })
  it('heuteBerlin / monatLabel / fmtZeitraum', () => {
    expect(heuteBerlin(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-15')
    expect(heuteBerlin()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(monatLabel('2026-10')).toBe('Oktober 2026')
    expect(monatLabel('2026-03-01')).toBe('März 2026')
    expect(monatLabel('x')).toBe('x')
    expect(fmtZeitraum('2026-10-12', '2026-10-18')).toBe('12.10.–18.10.')
  })
})

describe('relativ', () => {
  const heute = '2026-10-14'
  it('heute / morgen / gestern / ±n T / ab 7 Tagen absolut', () => {
    expect(relativ('2026-10-14', heute)).toBe('heute')
    expect(relativ('2026-10-15', heute)).toBe('morgen')
    expect(relativ('2026-10-13', heute)).toBe('gestern')
    expect(relativ('2026-10-12', heute)).toBe(`${MINUS}2${NBSP}T`)
    expect(relativ('2026-10-17', heute)).toBe(`in 3${NBSP}T`)
    expect(relativ('2026-10-20', heute)).toBe(`in 6${NBSP}T`)
    expect(relativ('2026-10-21', heute)).toBe('Mi 21.10.')
    expect(relativ('2026-10-07', heute)).toBe('Mi 07.10.')
  })
  it('vergleicht Berliner Kalendertage, nicht 24-h-Abstände', () => {
    expect(relativ('2026-10-14T22:30:00Z', MI)).toBe('morgen')
  })
})

describe('Zahlen', () => {
  it('fmtZahl mit Tausenderpunkt', () => {
    expect(fmtZahl(1248)).toBe('1.248')
    expect(fmtZahl(12)).toBe('12')
    expect(fmtZahl(-1248)).toBe(`${MINUS}1.248`)
    expect(fmtZahl(1248.6)).toBe('1.249')
  })
  it('fmtProzent ganzzahlig mit U+202F', () => {
    expect(fmtProzent(0.3)).toBe(`30${SCHMAL}%`)
    expect(fmtProzent(0.254)).toBe(`25${SCHMAL}%`)
    expect(fmtProzent(1)).toBe(`100${SCHMAL}%`)
    expect(fmtProzent(0)).toBe(`0${SCHMAL}%`)
    expect(fmtProzent(30)).toBe(`30${SCHMAL}%`)
    expect(fmtProzent(Number.NaN)).toBe(`–${SCHMAL}%`)
  })
  it('fmtDelta / fmtPp mit echtem Minus', () => {
    expect(fmtDelta(17)).toBe('+17')
    expect(fmtDelta(-2)).toBe(`${MINUS}2`)
    expect(fmtDelta(0)).toBe('±0')
    expect(fmtPp(3)).toBe(`+3${NBSP}pp`)
    expect(fmtPp(-1.4)).toBe(`${MINUS}1${NBSP}pp`)
    expect(fmtVerhaeltnis(12, 30)).toBe('12 / 30')
  })
  it('fmtDauer', () => {
    expect(fmtDauer(232)).toBe('03:52')
    expect(fmtDauer(3731)).toBe('1:02:11')
    expect(fmtDauer(0)).toBe('00:00')
    expect(fmtDauer(59.9)).toBe('00:59')
  })
})

describe('fmtTelefon', () => {
  it('international mit Leerzeichen', () => {
    expect(fmtTelefon('+49401234567')).toBe('+49 40 1234567')
    expect(fmtTelefon('+491711234567')).toBe('+49 171 1234567')
    expect(fmtTelefon(null)).toBe('')
    expect(fmtTelefon('abc')).toBe('abc')
  })
})
