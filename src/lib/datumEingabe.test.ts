// BAUPLAN § 3.1.12 – Datumseingabe ux § 4.9 (heute = Mi 14.10.2026).
import { describe, expect, it } from 'vitest'
import { parseDatumEingabe, parseDatumEingabeTag } from './datumEingabe'
import { fmtDatumZeit } from './format'

const HEUTE = '2026-10-14'
const t = (s: string) => parseDatumEingabeTag(s, HEUTE)

describe('parseDatumEingabeTag', () => {
  it('absolute Daten', () => {
    expect(t('14.10.')).toBe('2026-10-14')
    expect(t('14.10.2026')).toBe('2026-10-14')
    expect(t('14.10.26')).toBe('2026-10-14')
    expect(t('14.10')).toBe('2026-10-14')
    expect(t('5.1.')).toBe('2027-01-05') // vor heute → nächstes Jahr
    expect(t('01.01.2027')).toBe('2027-01-01')
    expect(t('2026-11-03')).toBe('2026-11-03')
    expect(t('31.02.')).toBeNull()
    expect(t('32.10.')).toBeNull()
  })
  it('relative Angaben', () => {
    expect(t('+3')).toBe('2026-10-17')
    expect(t('3')).toBe('2026-10-17')
    expect(t('+1w')).toBe('2026-10-21')
    expect(t('+2m')).toBe('2026-12-14')
    expect(t('+1j')).toBe('2027-10-14')
    expect(parseDatumEingabeTag('+1m', '2026-01-31')).toBe('2026-02-28')
  })
  it('Wörter', () => {
    expect(t('heute')).toBe('2026-10-14')
    expect(t('morgen')).toBe('2026-10-15')
    expect(t('übermorgen')).toBe('2026-10-16')
    expect(t('Morgen ')).toBe('2026-10-15')
    expect(t('gestern')).toBe('2026-10-13')
  })
  it('Wochentage = nächster, strikt nach heute', () => {
    expect(t('mo')).toBe('2026-10-19')
    expect(t('do')).toBe('2026-10-15')
    expect(t('mi')).toBe('2026-10-21') // heute ist Mittwoch → nächster Mittwoch
    expect(t('fr')).toBe('2026-10-16')
    expect(t('so')).toBe('2026-10-18')
    expect(t('Freitag')).toBe('2026-10-16')
  })
  it('Unsinn → null', () => {
    expect(t('')).toBeNull()
    expect(t('bald')).toBeNull()
    expect(t('+')).toBeNull()
    expect(t('14.')).toBeNull()
  })
})

describe('parseDatumEingabe', () => {
  it('liefert 09:00 Europe/Berlin am Zieltag', () => {
    const d = parseDatumEingabe('+3', new Date('2026-10-14T12:00:00Z'))
    expect(d).not.toBeNull()
    expect(fmtDatumZeit(d as Date)).toBe('17.10.2026, 09:00')
    expect((d as Date).toISOString()).toBe('2026-10-17T07:00:00.000Z')
    // Winterzeit
    expect(parseDatumEingabe('01.12.2026', HEUTE)?.toISOString()).toBe('2026-12-01T08:00:00.000Z')
    expect(parseDatumEingabe('x', HEUTE)).toBeNull()
  })
})
