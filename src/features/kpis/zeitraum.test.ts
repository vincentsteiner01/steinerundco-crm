// zeitraum.ts: Monat, ISO-KW, 7 T, 30 T, custom, Vorperioden, Jahreswechsel, Navigation, URL-Parameter (BAUPLAN § 3.6 Unit-Tests).
import { describe, expect, it } from 'vitest'
import {
  datelineSpanne,
  folgezeitraumMoeglich,
  isoJahr,
  kwSpanne,
  kwVon,
  parseZeitraum,
  spanneText,
  tageDerSpanne,
  verschoben,
  wochenImJahr,
  zeitraumFuerArt,
  zeitraumParams,
} from './zeitraum'

const p = (s: string) => new URLSearchParams(s)
const HEUTE = '2026-10-14'

describe('parseZeitraum', () => {
  it('Monat: ?zeitraum=2026-10 → 01.–31.10., Vorperiode September, Headline „Oktober 2026“', () => {
    const z = parseZeitraum(p('zeitraum=2026-10'), HEUTE)
    expect(z).toMatchObject({
      art: 'monat',
      von: '2026-10-01',
      bis: '2026-10-31',
      monthKey: '2026-10',
      label: 'Oktober 2026',
    })
    expect(z.vorperiode).toEqual({ von: '2026-09-01', bis: '2026-09-30', label: 'Sept.' })
  })

  it('ohne Parameter: laufender Monat; ungültige Werte fallen darauf zurück', () => {
    expect(parseZeitraum(p(''), HEUTE).monthKey).toBe('2026-10')
    expect(parseZeitraum(p('zeitraum=unsinn'), HEUTE).monthKey).toBe('2026-10')
    expect(parseZeitraum(p('zeitraum=2026-13'), HEUTE).monthKey).toBe('2026-10')
    expect(parseZeitraum(p('zeitraum=kw99'), HEUTE).monthKey).toBe('2026-10')
  })

  it('KW: ISO-Woche Mo–So, Vorperiode = Vorwoche (K-11), Parameter im laufenden Jahr', () => {
    const z = parseZeitraum(p('zeitraum=kw42'), HEUTE)
    expect(z).toMatchObject({
      art: 'kw',
      von: '2026-10-12',
      bis: '2026-10-18',
      label: 'KW 42',
      kw: { jahr: 2026, nr: 42 },
    })
    expect(z.vorperiode).toEqual({ von: '2026-10-05', bis: '2026-10-11', label: 'KW 41' })
    expect(zeitraumParams(z, HEUTE)).toEqual({ zeitraum: 'kw42' })
    expect(parseZeitraum(p('zeitraum=kw'), HEUTE).kw).toEqual({ jahr: 2026, nr: 42 })
  })

  it('KW 40 enthält 28.09.–04.10. (Monatsgrenze), KW 44 reicht bis 01.11.', () => {
    expect(kwSpanne(2026, 40)).toEqual({ von: '2026-09-28', bis: '2026-10-04' })
    expect(kwSpanne(2026, 44)).toEqual({ von: '2026-10-26', bis: '2026-11-01' })
    expect(kwVon('2026-10-01')).toEqual({ jahr: 2026, nr: 40 })
    expect(kwVon('2026-10-12')).toEqual({ jahr: 2026, nr: 42 })
  })

  it('Jahreswechsel: KW 53/2026 → Vorwoche KW 52, Folgewoche KW 1/2027; ISO-Jahr des 01.01.2027 ist 2026', () => {
    expect(wochenImJahr(2026)).toBe(53)
    expect(isoJahr('2027-01-01')).toBe(2026)
    const z = parseZeitraum(p('zeitraum=kw53'), HEUTE)
    expect(z.von).toBe('2026-12-28')
    expect(z.bis).toBe('2027-01-03')
    expect(z.vorperiode.label).toBe('KW 52')
    const folge = verschoben(z, 1)
    expect(folge.kw).toEqual({ jahr: 2027, nr: 1 })
    expect(zeitraumParams(folge, HEUTE)).toEqual({ zeitraum: 'kw1-2027' })
    expect(parseZeitraum(p('zeitraum=kw1-2027'), HEUTE).von).toBe('2027-01-04')
    const dez = verschoben(parseZeitraum(p('zeitraum=2027-01'), HEUTE), -1)
    expect(dez.monthKey).toBe('2026-12')
    expect(dez.vorperiode.label).toBe('Nov.')
  })

  it('7 T und 30 T: [heute−n+1, heute], Vorperiode direkt davor', () => {
    const s = parseZeitraum(p('zeitraum=7t'), HEUTE)
    expect(s).toMatchObject({ art: '7t', von: '2026-10-08', bis: '2026-10-14', label: 'Letzte 7 Tage' })
    expect(s.vorperiode).toEqual({ von: '2026-10-01', bis: '2026-10-07', label: '7 T davor' })
    const d = parseZeitraum(p('zeitraum=30t'), HEUTE)
    expect(d).toMatchObject({ art: '30t', von: '2026-09-15', bis: '2026-10-14' })
    expect(d.vorperiode).toEqual({ von: '2026-08-16', bis: '2026-09-14', label: '30 T davor' })
  })

  it('custom: ?zeitraum=custom&von&bis, Vorperiode gleich lang; ungültig → Monat', () => {
    const z = parseZeitraum(p('zeitraum=custom&von=2026-10-01&bis=2026-10-10'), HEUTE)
    expect(z).toMatchObject({ art: 'custom', von: '2026-10-01', bis: '2026-10-10', label: '01.–10.10.2026' })
    expect(z.vorperiode).toEqual({ von: '2026-09-21', bis: '2026-09-30', label: 'davor' })
    expect(zeitraumParams(z, HEUTE)).toEqual({ zeitraum: 'custom', von: '2026-10-01', bis: '2026-10-10' })
    expect(parseZeitraum(p('zeitraum=custom&von=2026-10-10&bis=2026-10-01'), HEUTE).art).toBe('monat')
    expect(parseZeitraum(p('zeitraum=custom&von=2026-10-10'), HEUTE).art).toBe('monat')
  })
})

describe('Navigation und Anzeige', () => {
  it('← → Monat/KW; 7 T/30 T werden beim Verschieben zu „eigener“', () => {
    const m = parseZeitraum(p('zeitraum=2026-10'), HEUTE)
    expect(verschoben(m, -1).monthKey).toBe('2026-09')
    expect(verschoben(m, 1).monthKey).toBe('2026-11')
    expect(verschoben(parseZeitraum(p('zeitraum=kw42'), HEUTE), -1).label).toBe('KW 41')
    const s = verschoben(parseZeitraum(p('zeitraum=7t'), HEUTE), -1)
    expect(s).toMatchObject({ art: 'custom', von: '2026-10-01', bis: '2026-10-07' })
  })

  it('→ ist aus, wenn der Folgezeitraum ganz in der Zukunft liegt', () => {
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=2026-10'), HEUTE), HEUTE)).toBe(false)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=2026-09'), HEUTE), HEUTE)).toBe(true)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=kw42'), HEUTE), HEUTE)).toBe(false)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=kw41'), HEUTE), HEUTE)).toBe(true)
  })

  it('Segment-Wahl: Monat/KW des Heute, eigener übernimmt die aktuelle Spanne', () => {
    const kw = parseZeitraum(p('zeitraum=kw40'), HEUTE)
    expect(zeitraumFuerArt('monat', HEUTE, kw).monthKey).toBe('2026-10')
    expect(zeitraumFuerArt('kw', HEUTE, kw).label).toBe('KW 42')
    expect(zeitraumFuerArt('custom', HEUTE, kw)).toMatchObject({ art: 'custom', von: '2026-09-28', bis: '2026-10-04' })
  })

  it('Dateline-Spanne endet heute; Spannen-Text über Monats- und Jahresgrenzen', () => {
    expect(datelineSpanne(parseZeitraum(p('zeitraum=2026-10'), HEUTE), HEUTE)).toBe('01.–14.10.2026')
    expect(datelineSpanne(parseZeitraum(p('zeitraum=2026-09'), HEUTE), HEUTE)).toBe('01.–30.09.2026')
    expect(spanneText('2026-09-28', '2026-10-04')).toBe('28.09.–04.10.2026')
    expect(spanneText('2026-12-28', '2027-01-03')).toBe('28.12.2026–03.01.2027')
  })

  it('tageDerSpanne liefert alle Kalendertage inklusive', () => {
    expect(tageDerSpanne('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(tageDerSpanne('2026-10-02', '2026-10-01')).toEqual([])
  })
})
