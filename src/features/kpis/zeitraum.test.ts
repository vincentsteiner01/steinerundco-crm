// zeitraum.ts: Monat, ISO-Woche, 7 Tage, 30 Tage, eigener Zeitraum, Vorperioden, Jahreswechsel, Blättern, URL-Parameter, Beschriftungen.
import { describe, expect, it } from 'vitest'
import {
  datelineSpanne,
  folgezeitraumMoeglich,
  isoJahr,
  kwSpanne,
  kwVon,
  parseZeitraum,
  spanneText,
  verschoben,
  wochenImJahr,
  ZEITRAUM_ARTEN,
  zeitraumFuerArt,
  zeitraumParams,
  zeitraumWahl,
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

  it('von Hand veränderte Adresse – Jahr außerhalb 2000–2100 oder ein Tag, den es nicht gibt: laufender Monat, kein Absturz', () => {
    for (const adresse of [
      'zeitraum=0999-12',
      'zeitraum=9999-12',
      'zeitraum=1999-12',
      'zeitraum=2101-01',
      'zeitraum=kw1-0999',
      'zeitraum=kw1-9999',
      'zeitraum=custom&von=0999-01-01&bis=0999-01-07',
      'zeitraum=custom&von=9999-12-01&bis=9999-12-31',
      'zeitraum=custom&von=2026-02-30&bis=2026-03-05',
      'zeitraum=custom&von=2026-10-01&bis=2026-10-32',
    ]) {
      const z = parseZeitraum(p(adresse), HEUTE)
      expect(z.monthKey, adresse).toBe('2026-10')
      // was die Seite beim Rendern damit rechnet
      expect(() => [folgezeitraumMoeglich(z, HEUTE), datelineSpanne(z, HEUTE), zeitraumParams(z, HEUTE)]).not.toThrow()
    }
    // die Ränder selbst gehen
    expect(parseZeitraum(p('zeitraum=2000-01'), HEUTE).vorperiode.von).toBe('1999-12-01')
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=2100-12'), HEUTE), HEUTE)).toBe(false)
    expect(parseZeitraum(p('zeitraum=kw52-2100'), HEUTE).kw).toEqual({ jahr: 2100, nr: 52 })
    expect(parseZeitraum(p('zeitraum=custom&von=2024-02-29&bis=2024-03-05'), HEUTE).art).toBe('custom')
  })

  it('Woche: ISO-Woche Mo–So, Vorperiode = Vorwoche, Parameter im laufenden Jahr', () => {
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

  it('7 Tage und 30 Tage: [heute−n+1, heute], Vorperiode direkt davor, ausgeschriebene Beschriftung', () => {
    const s = parseZeitraum(p('zeitraum=7t'), HEUTE)
    expect(s).toMatchObject({ art: '7t', von: '2026-10-08', bis: '2026-10-14', label: 'Letzte 7 Tage' })
    expect(s.vorperiode).toEqual({ von: '2026-10-01', bis: '2026-10-07', label: 'davor' })
    const d = parseZeitraum(p('zeitraum=30t'), HEUTE)
    expect(d).toMatchObject({ art: '30t', von: '2026-09-15', bis: '2026-10-14', label: 'Letzte 30 Tage' })
    expect(d.vorperiode).toEqual({ von: '2026-08-16', bis: '2026-09-14', label: 'davor' })
  })

  it('eigener Zeitraum: ?zeitraum=custom&von&bis wird weiter gelesen, Vorperiode gleich lang; ungültig → Monat', () => {
    const z = parseZeitraum(p('zeitraum=custom&von=2026-10-01&bis=2026-10-10'), HEUTE)
    expect(z).toMatchObject({ art: 'custom', von: '2026-10-01', bis: '2026-10-10', label: '01.–10.10.2026' })
    expect(z.vorperiode).toEqual({ von: '2026-09-21', bis: '2026-09-30', label: 'davor' })
    expect(zeitraumParams(z, HEUTE)).toEqual({ zeitraum: 'custom', von: '2026-10-01', bis: '2026-10-10' })
    expect(parseZeitraum(p('zeitraum=custom&von=2026-10-10&bis=2026-10-01'), HEUTE).art).toBe('monat')
    expect(parseZeitraum(p('zeitraum=custom&von=2026-10-10'), HEUTE).art).toBe('monat')
  })
})

describe('Auswahl, Blättern und Anzeige', () => {
  it('zur Wahl stehen genau Monat · Woche · 7 Tage · 30 Tage – ohne Kürzel, ohne eigenen Zeitraum', () => {
    expect(ZEITRAUM_ARTEN).toEqual([
      { key: 'monat', label: 'Monat' },
      { key: 'kw', label: 'Woche' },
      { key: '7t', label: '7 Tage' },
      { key: '30t', label: '30 Tage' },
    ])
  })

  it('keine Beschriftung kürzt „Tage“ zu „T“ ab', () => {
    const texte = ['2026-10', 'kw42', '7t', '30t', 'custom&von=2026-10-01&bis=2026-10-10']
      .map((z) => parseZeitraum(p(`zeitraum=${z}`), HEUTE))
      .flatMap((z) => [z.label, z.vorperiode.label, datelineSpanne(z, HEUTE)])
    expect(texte.filter((t) => /\d\sT\b/.test(t))).toEqual([])
  })

  it('zurück und vor: Monat/Woche; 7 Tage/30 Tage werden beim Blättern zur festen Spanne', () => {
    const m = parseZeitraum(p('zeitraum=2026-10'), HEUTE)
    expect(verschoben(m, -1).monthKey).toBe('2026-09')
    expect(verschoben(m, 1).monthKey).toBe('2026-11')
    expect(verschoben(parseZeitraum(p('zeitraum=kw42'), HEUTE), -1).label).toBe('KW 41')
    const s = verschoben(parseZeitraum(p('zeitraum=7t'), HEUTE), -1)
    expect(s).toMatchObject({ art: 'custom', von: '2026-10-01', bis: '2026-10-07', label: '01.–07.10.2026' })
  })

  it('← und wieder →: aus der festen Spanne werden wieder die letzten 7 bzw. 30 Tage', () => {
    for (const [art, n] of [
      ['7t', 7],
      ['30t', 30],
    ] as const) {
      const start = parseZeitraum(p(`zeitraum=${art}`), HEUTE)
      const frueher = verschoben(start, -1)
      expect(zeitraumParams(frueher, HEUTE).zeitraum).toBe('custom')
      // die verschobene Spanne gehört weiter zur selben Wahl im Kopf
      expect(zeitraumWahl(frueher)).toBe(art)
      const wieder = verschoben(frueher, 1)
      expect(zeitraumParams(wieder, HEUTE)).toEqual({ zeitraum: art })
      // auch eine alte Adresse mit von/bis, die heute endet, ist „Letzte n Tage“
      const ausAdresse = parseZeitraum(p(`zeitraum=custom&von=${wieder.von}&bis=${wieder.bis}`), HEUTE)
      expect(ausAdresse).toMatchObject({ art, label: `Letzte ${n} Tage`, von: start.von, bis: HEUTE })
    }
  })

  it('nach einem Tageswechsel weitergeblättert: → endet bei den letzten 7 bzw. 30 Tagen, nicht in der Zukunft', () => {
    const MORGEN = '2026-10-15'
    for (const [art, n] of [
      ['7t', 7],
      ['30t', 30],
    ] as const) {
      // gestern zurückgeblättert, der Reiter blieb über Nacht offen
      const start = parseZeitraum(p(`zeitraum=${art}`), HEUTE)
      const frueher = verschoben(start, -1)
      // vor: liegt die nächste Spanne ganz in der Vergangenheit, wird starr verschoben wie bisher
      const eins = verschoben(verschoben(frueher, -1), 1, MORGEN)
      expect(eins).toMatchObject({ art: 'custom', von: frueher.von, bis: frueher.bis })
      // noch einmal vor: die Spanne, die gestern „Letzte n Tage“ war – heute eine feste Spanne, → bleibt möglich
      const zwei = verschoben(eins, 1, MORGEN)
      expect(zwei).toMatchObject({ art: 'custom', von: start.von, bis: HEUTE })
      expect(folgezeitraumMoeglich(zwei, MORGEN)).toBe(true)
      // noch einmal vor: starr verschoben läge die Spanne bis auf einen Tag in der Zukunft
      const drei = verschoben(zwei, 1, MORGEN)
      expect(drei).toMatchObject({ art, bis: MORGEN, label: `Letzte ${n} Tage` })
      expect(zeitraumParams(drei, MORGEN)).toEqual({ zeitraum: art })
      expect(folgezeitraumMoeglich(drei, MORGEN)).toBe(false)
    }
  })

  it('Wahl im Kopf zu einem Zeitraum: eigene Spannen anderer Länge gehören zu keiner Wahl', () => {
    expect(zeitraumWahl(parseZeitraum(p('zeitraum=2026-10'), HEUTE))).toBe('monat')
    expect(zeitraumWahl(parseZeitraum(p('zeitraum=kw41'), HEUTE))).toBe('kw')
    expect(zeitraumWahl(parseZeitraum(p('zeitraum=custom&von=2026-10-01&bis=2026-10-10'), HEUTE))).toBeNull()
    // sieben Tage, die nicht heute enden: weiter „7 Tage“, aber eine feste Spanne
    const fest = parseZeitraum(p('zeitraum=custom&von=2026-10-01&bis=2026-10-07'), HEUTE)
    expect(fest.art).toBe('custom')
    expect(zeitraumWahl(fest)).toBe('7t')
  })

  it('vor ist aus, wenn der Folgezeitraum ganz in der Zukunft liegt', () => {
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=2026-10'), HEUTE), HEUTE)).toBe(false)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=2026-09'), HEUTE), HEUTE)).toBe(true)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=kw42'), HEUTE), HEUTE)).toBe(false)
    expect(folgezeitraumMoeglich(parseZeitraum(p('zeitraum=kw41'), HEUTE), HEUTE)).toBe(true)
  })

  it('Wahl im Kopf: Monat/Woche/7 Tage/30 Tage des Heute', () => {
    const kw = parseZeitraum(p('zeitraum=kw40'), HEUTE)
    expect(zeitraumFuerArt('monat', HEUTE, kw).monthKey).toBe('2026-10')
    expect(zeitraumFuerArt('kw', HEUTE, kw).label).toBe('KW 42')
    expect(zeitraumFuerArt('7t', HEUTE, kw)).toMatchObject({ art: '7t', von: '2026-10-08', bis: '2026-10-14' })
    expect(zeitraumFuerArt('30t', HEUTE, kw)).toMatchObject({ art: '30t', von: '2026-09-15', bis: '2026-10-14' })
    expect(zeitraumFuerArt('custom', HEUTE, kw)).toMatchObject({ art: 'custom', von: '2026-09-28', bis: '2026-10-04' })
  })

  it('Dateline-Spanne endet heute; Spannen-Text über Monats- und Jahresgrenzen', () => {
    expect(datelineSpanne(parseZeitraum(p('zeitraum=2026-10'), HEUTE), HEUTE)).toBe('01.–14.10.2026')
    expect(datelineSpanne(parseZeitraum(p('zeitraum=2026-09'), HEUTE), HEUTE)).toBe('01.–30.09.2026')
    expect(spanneText('2026-09-28', '2026-10-04')).toBe('28.09.–04.10.2026')
    expect(spanneText('2026-12-28', '2027-01-03')).toBe('28.12.2026–03.01.2027')
  })
})
