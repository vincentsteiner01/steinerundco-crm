// kennzahlen.ts: Summen über v_kpi_tage (Monatszähler nur in der Monatsansicht, Marke „aus Sheet“), Quoten (Division durch 0 → „–“),
// Kacheln Board und E-Mail mit Vergleich zur Vorperiode (Anzahl gegen Anzahl, leer bei alten Monatszählern), Funnel (Quote zur
// Vorstufe, auch über 100 %), Tageswerte und Wochen.
// Alle Zahlen und Personen sind erfunden.
import { describe, expect, it } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import {
  formatWert,
  fremdeMonatszaehler,
  funnelZeilen,
  kachelDelta,
  kachelnBoard,
  kachelnEmail,
  kachelVergleich,
  kachelZiel,
  KENNZAHLEN,
  leereSummen,
  mitMonatszaehler,
  nurAusMonat,
  ohneVergleich,
  quote,
  summeWochen,
  summiere,
  TAGES_METRIKEN,
  tageswerte,
  wochen,
  type Kennzahl,
  type KpiZeile,
  type Summen,
} from './kennzahlen'

const zeile = (
  tag: string,
  werte: Partial<Summen> = {},
  o: { member?: string | null; period?: 'tag' | 'monat' } = {},
): KpiZeile => ({
  member_id: o.member === undefined ? MEMBER_V : o.member,
  tag,
  period: o.period ?? 'tag',
  ...leereSummen(),
  ...werte,
})
const summen = (werte: Partial<Summen>): Summen => ({ ...leereSummen(), ...werte })

// Oktober 2026: Vernetzungen stehen nur als Monatszähler da, der Rest als Tageswerte zweier Personen
const OKT: KpiZeile[] = [
  zeile('2026-10-01', { vernetzungen_versendet: 305, vernetzungen_angenommen: 93 }, { period: 'monat' }),
  zeile('2026-10-01', { angeschrieben: 28 }),
  zeile('2026-10-02', { angeschrieben: 37, gespraech: 1 }),
  zeile('2026-10-12', { angeschrieben: 17, verloren: 2 }),
  zeile('2026-10-06', { angeschrieben: 4, emails_gesendet: 6, email_antworten: 2 }, { member: MEMBER_M }),
]

const SEPT = summen({
  vernetzungen_versendet: 288,
  vernetzungen_angenommen: 55,
  angeschrieben: 51,
  gespraech: 10,
  im_geschaeft: 1,
  verloren: 4,
})
const OKT_SUMMEN = summen({
  vernetzungen_versendet: 305,
  vernetzungen_angenommen: 93,
  angeschrieben: 82,
  gespraech: 19,
  im_geschaeft: 2,
  verloren: 3,
})
const KEIN_SHEET: ReadonlySet<Kennzahl> = new Set()

describe('summiere', () => {
  it('Monatsansicht: Monatszähler zählen mit, beide Personen summiert', () => {
    expect(summiere(OKT, true)).toEqual({
      vernetzungen_versendet: 305,
      vernetzungen_angenommen: 93,
      angeschrieben: 86,
      gespraech: 1,
      im_geschaeft: 0,
      verloren: 2,
      emails_gesendet: 6,
      email_antworten: 2,
    })
  })

  it('andere Zeiträume: Monatszähler bleiben außen vor', () => {
    const s = summiere(OKT, false)
    expect(s.vernetzungen_versendet).toBe(0)
    expect(s.vernetzungen_angenommen).toBe(0)
    expect(s.angeschrieben).toBe(86)
  })

  it('ohne Zeilen: alle Kennzahlen 0', () => {
    expect(summiere([], true)).toEqual(leereSummen())
    expect(Object.keys(leereSummen())).toEqual([...KENNZAHLEN])
  })
})

describe('nurAusMonat', () => {
  it('nur Kennzahlen, deren Wert ausschließlich aus Monatszählern stammt', () => {
    expect([...nurAusMonat(OKT, true)].sort()).toEqual(['vernetzungen_angenommen', 'vernetzungen_versendet'])
  })

  it('ein Tageswert daneben hebt die Marke auf; Nullen zählen nicht', () => {
    const mitTag = [...OKT, zeile('2026-10-20', { vernetzungen_angenommen: 3 })]
    expect([...nurAusMonat(mitTag, true)]).toEqual(['vernetzungen_versendet'])
    expect(nurAusMonat([zeile('2026-10-01', {}, { period: 'monat' })], true).size).toBe(0)
  })

  it('leer, wenn Monatszähler nicht mitzählen', () => {
    expect(nurAusMonat(OKT, false).size).toBe(0)
  })
})

describe('mitMonatszaehler, fremdeMonatszaehler und ohneVergleich', () => {
  it('Kennzahlen mit altem Monatszähler über 0 – Tageswerte und leere Monatszähler zählen nicht', () => {
    expect([...mitMonatszaehler(OKT)].sort()).toEqual(['vernetzungen_angenommen', 'vernetzungen_versendet'])
    expect(mitMonatszaehler(OKT.filter((z) => z.period === 'tag')).size).toBe(0)
    expect(mitMonatszaehler([zeile('2026-10-01', {}, { period: 'monat' })]).size).toBe(0)
  })

  it('fremde Monatszähler: Kennzahlen, für die im selben Monat nur eine andere Person einen hat', () => {
    const bodo = OKT.filter((z) => z.member_id === MEMBER_M)
    // Bodo hat im Oktober keinen – beide Kennzahlen des fremden Monatszählers fehlen ihm
    expect([...fremdeMonatszaehler(OKT, bodo)].sort()).toEqual(['vernetzungen_angenommen', 'vernetzungen_versendet'])
    // Karla hat ihn selbst, das Team ohnehin alle Zeilen
    expect(fremdeMonatszaehler(OKT, OKT).size).toBe(0)
    // ein eigener für nur eine der beiden Kennzahlen, und einer für einen anderen Monat, hilft nur dort
    const eigen = [
      zeile('2026-10-01', { vernetzungen_versendet: 40 }, { member: MEMBER_M, period: 'monat' }),
      zeile('2026-09-01', { vernetzungen_angenommen: 7 }, { member: MEMBER_M, period: 'monat' }),
    ]
    expect([...fremdeMonatszaehler(OKT, eigen)]).toEqual(['vernetzungen_angenommen'])
    expect(fremdeMonatszaehler([], bodo).size).toBe(0)
  })

  it('nimmt die genannten Kennzahlen aus der Vorperiode heraus, der Rest bleibt', () => {
    const v = ohneVergleich(SEPT, new Set<Kennzahl>(['vernetzungen_versendet']))
    expect(v.vernetzungen_versendet).toBeNull()
    expect(v.vernetzungen_angenommen).toBe(55)
    expect(SEPT.vernetzungen_versendet).toBe(288) // die Summen selbst bleiben unberührt
    expect(ohneVergleich(SEPT, new Set())).toEqual(SEPT)
  })
})

describe('quote', () => {
  it('Anteil; Nenner 0 oder kleiner → null → „–“', () => {
    expect(quote(1, 4)).toBe(0.25)
    expect(quote(0, 5)).toBe(0)
    expect(quote(3, 2)).toBe(1.5)
    expect(quote(3, 0)).toBeNull()
    expect(quote(0, 0)).toBeNull()
    expect(quote(3, -1)).toBeNull()
    expect(formatWert('prozent', quote(3, 0))).toBe('–')
    expect(formatWert('zahl', null)).toBe('–')
  })
})

describe('kachelnBoard', () => {
  const k = kachelnBoard(OKT_SUMMEN, SEPT, new Set<Kennzahl>(['vernetzungen_versendet']))

  it('sechs Kacheln in fester Reihenfolge mit ihren Namen', () => {
    expect(k.map((x) => x.label)).toEqual([
      'Vernetzungen versendet',
      'Angenommen',
      'Angeschrieben',
      'Gespräch vereinbart',
      'Im Geschäft',
      'Verloren',
    ])
    expect(k.map((x) => x.key)).toEqual([
      'vernetzungen_versendet',
      'vernetzungen_angenommen',
      'angeschrieben',
      'gespraech',
      'im_geschaeft',
      'verloren',
    ])
    expect(k.every((x) => x.art === 'zahl')).toBe(true)
  })

  it('Quoten: Angenommen ÷ versendet, Gespräch ÷ angeschrieben, Im Geschäft ÷ Gespräch – sonst keine', () => {
    expect(k.map((x) => formatWert('prozent', x.quote))).toEqual(['–', '30 %', '–', '23 %', '11 %', '–'])
    expect(k[1]!.quote).toBeCloseTo(93 / 305)
    expect(k[3]!.quote).toBeCloseTo(19 / 82)
    expect(k[4]!.quote).toBeCloseTo(2 / 19)
  })

  it('Vergleich zur Vorperiode: Anzahl gegen Anzahl – nie eine Zahl gegen einen Anteil, kein „pp“', () => {
    const versendet = k[0]!
    expect(kachelDelta(versendet)).toBe('+17')
    expect(kachelVergleich(versendet, 'Sept.')).toBe('vs. Sept. 288')
    const angenommen = k[1]!
    expect(formatWert('zahl', angenommen.wert)).toBe('93')
    expect(kachelDelta(angenommen)).toBe('+38')
    expect(kachelVergleich(angenommen, 'Sept.')).toBe('vs. Sept. 55')
    expect(angenommen.deltaPp).toBe(11) // 30 % gegen 19 %
    expect(kachelDelta(k[3]!)).toBe('+9')
    expect(kachelDelta(k[5]!)).toBe('−1')
    expect(kachelVergleich(k[5]!, 'Sept.')).toBe('vs. Sept. 4')
    for (const x of k) expect(`${kachelDelta(x)} ${kachelVergleich(x, 'Sept.')}`).not.toMatch(/pp|%/)
  })

  it('ohne aktuelle Quote steht die Zahl der Vorperiode da, kein Prozentwert ohne Gegenstück', () => {
    // November: kein Gespräch → „Im Geschäft“ hat keine Quote; im Oktober waren es 1 von 3
    const nov = kachelnBoard(
      summen({ angeschrieben: 108 }),
      summen({ angeschrieben: 200, gespraech: 3, im_geschaeft: 1 }),
      KEIN_SHEET,
    )
    const imGeschaeft = nov[4]!
    expect(imGeschaeft.quote).toBeNull()
    expect(imGeschaeft.vorQuote).toBeCloseTo(1 / 3)
    expect(kachelDelta(imGeschaeft)).toBe('−1')
    expect(kachelVergleich(imGeschaeft, 'Okt.')).toBe('vs. Okt. 1')
  })

  it('Prozentpunkte aus den gerundeten Prozenten: 0 % gegen 2 % sind −2', () => {
    // Oktober 3 ÷ 200 = 1,5 % → angezeigt 2 %; November 0 ÷ 108 = 0 %
    const nov = kachelnBoard(summen({ angeschrieben: 108 }), summen({ angeschrieben: 200, gespraech: 3 }), KEIN_SHEET)
    expect(formatWert('prozent', nov[3]!.quote)).toBe('0 %')
    expect(formatWert('prozent', nov[3]!.vorQuote)).toBe('2 %')
    expect(nov[3]!.deltaPp).toBe(-2)
    const f = funnelZeilen(summen({ angeschrieben: 108 }), summen({ angeschrieben: 200, gespraech: 3 }), KEIN_SHEET)
    expect(f[3]!.deltaPp).toBe(-2)
  })

  it('kein verlässlicher Vergleich (alte Monatszähler): Veränderung und Vergleich bleiben leer', () => {
    // „30 Tage“ über den Oktober: versendet steht dort fast nur im Monatszähler – 17 wäre viel zu wenig
    const vor = ohneVergleich(
      summen({ vernetzungen_versendet: 17, vernetzungen_angenommen: 117, angeschrieben: 90, gespraech: 3 }),
      new Set<Kennzahl>(['vernetzungen_versendet']),
    )
    const t = kachelnBoard(
      summen({ vernetzungen_versendet: 504, vernetzungen_angenommen: 122, angeschrieben: 130 }),
      vor,
      KEIN_SHEET,
    )
    expect(t[0]).toMatchObject({ wert: 504, vorWert: null, delta: null, deltaPp: null })
    expect(kachelDelta(t[0]!)).toBeNull()
    expect(kachelVergleich(t[0]!, 'davor')).toBeNull()
    // Angenommen selbst ist vergleichbar, seine Quote (÷ versendet) nicht: keine 688 %
    expect(t[1]).toMatchObject({ wert: 122, vorWert: 117, delta: 5, vorQuote: null, deltaPp: null })
    expect(formatWert('prozent', t[1]!.quote)).toBe('24 %')
    expect(kachelVergleich(t[1]!, 'davor')).toBe('vs. davor 117')
    // unberührt
    expect(kachelVergleich(t[2]!, 'davor')).toBe('vs. davor 90')
  })

  it('Marke „sheet“ nur für Kennzahlen aus Monatszählern, nie „zaehler“; keine Ziele', () => {
    expect(k.map((x) => x.fussnote)).toEqual(['sheet', null, null, null, null, null])
    expect(k.every((x) => x.ziel === null && x.erreicht === null && kachelZiel(x) === null)).toBe(true)
  })

  it('ohne Zahlen: 0 und „–“ statt Division durch 0', () => {
    const leer = kachelnBoard(leereSummen(), leereSummen(), KEIN_SHEET)
    expect(leer.map((x) => x.wert)).toEqual([0, 0, 0, 0, 0, 0])
    expect(leer.every((x) => x.quote === null && x.vorQuote === null && x.deltaPp === null)).toBe(true)
    expect(kachelDelta(leer[1]!)).toBe('±0')
    expect(kachelVergleich(leer[1]!, 'Okt.')).toBe('vs. Okt. 0')
  })
})

describe('kachelnEmail', () => {
  it('E-Mails gesendet und Antworten mit Antwortquote', () => {
    const k = kachelnEmail(
      summen({ emails_gesendet: 40, email_antworten: 6 }),
      summen({ emails_gesendet: 20, email_antworten: 1 }),
    )
    expect(k.map((x) => x.label)).toEqual(['E-Mails gesendet', 'Antworten'])
    expect(k.map((x) => x.key)).toEqual(['emails_gesendet', 'email_antworten'])
    expect(k[0]!.quote).toBeNull()
    expect(kachelDelta(k[0]!)).toBe('+20')
    expect(formatWert('prozent', k[1]!.quote)).toBe('15 %')
    expect(kachelDelta(k[1]!)).toBe('+5')
    expect(kachelVergleich(k[1]!, 'Okt.')).toBe('vs. Okt. 1')
    expect(k[1]!.deltaPp).toBe(10)
    expect(k.every((x) => x.fussnote === null && x.ziel === null)).toBe(true)
  })

  it('nichts gesendet: Quote „–“', () => {
    const k = kachelnEmail(leereSummen(), leereSummen())
    expect(formatWert('prozent', k[1]!.quote)).toBe('–')
    expect(kachelVergleich(k[1]!, 'Okt.')).toBe('vs. Okt. 0')
  })
})

describe('funnelZeilen', () => {
  const z = funnelZeilen(OKT_SUMMEN, SEPT, new Set<Kennzahl>(['vernetzungen_versendet']))

  it('fünf Stufen von der Vernetzung bis zum Geschäft', () => {
    expect(z.map((x) => [x.nr, x.metric, x.label])).toEqual([
      ['01', 'vernetzungen_versendet', 'Vernetzungen versendet'],
      ['02', 'vernetzungen_angenommen', 'Angenommen'],
      ['03', 'angeschrieben', 'Angeschrieben'],
      ['04', 'gespraech', 'Gespräch vereinbart'],
      ['05', 'im_geschaeft', 'Im Geschäft'],
    ])
    expect(z.every((x) => !x.sub && x.hinweis === null && x.ziel === null && x.erreicht === null)).toBe(true)
    expect(z.every((x) => !('leads' in x))).toBe(true)
  })

  it('Quote = Anteil zur Vorstufe; „Vernetzungen versendet“ und „Angeschrieben“ haben keine', () => {
    expect(z[0]).toMatchObject({
      wert: 305,
      vorWert: 288,
      delta: 17,
      quote: undefined,
      deltaPp: null,
      fussnote: 'sheet',
    })
    expect(z[1]).toMatchObject({ wert: 93, vorWert: 55, delta: 38, fussnote: null })
    expect(z[1]!.quote).toBeCloseTo(93 / 305)
    expect(z[1]!.vorQuote).toBeCloseTo(55 / 288)
    expect(z[1]!.deltaPp).toBe(11)
    // Board-Karten sind keine Teilmenge der von Hand gezählten Annahmen: keine Quote (sonst regelmäßig über 100 %)
    expect(z[2]).toMatchObject({
      wert: 82,
      vorWert: 51,
      delta: 31,
      quote: undefined,
      vorQuote: undefined,
      deltaPp: null,
    })
    expect(z[3]!.quote).toBeCloseTo(19 / 82)
    expect(z[4]!.quote).toBeCloseTo(2 / 19)
    expect(z[4]!.vorQuote).toBeCloseTo(1 / 10)
  })

  it('Quote über 100 % bleibt stehen; leere Vorstufe → null', () => {
    const f = funnelZeilen(
      summen({ vernetzungen_versendet: 8, vernetzungen_angenommen: 12, angeschrieben: 5 }),
      leereSummen(),
      KEIN_SHEET,
    )
    expect(f[1]!.quote).toBe(1.5) // Annahmen dieser Woche auf Anfragen der Vorwoche
    expect(formatWert('prozent', f[1]!.quote ?? null)).toBe('150 %')
    expect(f[1]!.vorQuote).toBeNull()
    expect(f[1]!.deltaPp).toBeNull()
    expect(f[3]!.quote).toBe(0)
    expect(f[4]!.quote).toBeNull() // kein Gespräch
  })

  it('kein verlässlicher Vergleich: Vorperiode, Veränderung und Vor-Quote bleiben leer', () => {
    const vor = ohneVergleich(SEPT, new Set<Kennzahl>(['vernetzungen_versendet']))
    const f = funnelZeilen(OKT_SUMMEN, vor, KEIN_SHEET)
    expect(f[0]).toMatchObject({ wert: 305, vorWert: null, delta: null })
    expect(f[1]).toMatchObject({ wert: 93, vorWert: 55, delta: 38, vorQuote: null, deltaPp: null })
    expect(f[1]!.quote).toBeCloseTo(93 / 305)
    expect(f[3]).toMatchObject({ vorWert: 10, delta: 9 })
  })
})

describe('tageswerte', () => {
  it('jeder Tag des Zeitraums kommt vor, fehlende mit Nullen', () => {
    const t = tageswerte(OKT, '2026-10-01', '2026-10-31')
    expect(t).toHaveLength(31)
    expect(t[0]!.tag).toBe('2026-10-01')
    expect(t[30]!.tag).toBe('2026-10-31')
    expect(t[1]!.werte).toMatchObject({ angeschrieben: 37, gespraech: 1 })
    expect(Object.keys(t[2]!.werte).sort()).toEqual(TAGES_METRIKEN.map((m) => m.key).sort())
    expect(Object.values(t[2]!.werte).every((w) => w === 0)).toBe(true)
  })

  it('Monatszähler zählen nie im Tagesverlauf', () => {
    const t = tageswerte(OKT, '2026-10-01', '2026-10-01')
    expect(t[0]!.werte).toMatchObject({ angeschrieben: 28, vernetzungen_versendet: 0, vernetzungen_angenommen: 0 })
  })

  it('summiert zwei Personen je Tag; Tage außerhalb zählen nicht', () => {
    const zeilen = [
      zeile('2026-10-06', { angeschrieben: 4, emails_gesendet: 6 }, { member: MEMBER_M }),
      zeile('2026-10-06', { angeschrieben: 3, vernetzungen_versendet: 20 }),
      zeile('2026-10-05', { angeschrieben: 9 }),
      zeile('2026-10-07', { angeschrieben: 9 }),
    ]
    const t = tageswerte(zeilen, '2026-10-06', '2026-10-06')
    expect(t).toHaveLength(1)
    expect(t[0]!.werte).toMatchObject({ angeschrieben: 7, emails_gesendet: 6, vernetzungen_versendet: 20 })
  })

  it('verdrehter Zeitraum → leer', () => {
    expect(tageswerte(OKT, '2026-10-02', '2026-10-01')).toEqual([])
  })
})

describe('TAGES_METRIKEN', () => {
  it('sieben Reihen in fester Reihenfolge mit Namen und Kurznamen', () => {
    expect(TAGES_METRIKEN.map((m) => [m.key, m.label, m.kurz])).toEqual([
      ['angeschrieben', 'Angeschrieben', 'Angeschrieben'],
      ['vernetzungen_versendet', 'Vernetzungen versendet', 'Vernetzungen'],
      ['vernetzungen_angenommen', 'Angenommen', 'Angenommen'],
      ['gespraech', 'Gespräch vereinbart', 'Gespräche'],
      ['im_geschaeft', 'Im Geschäft', 'Im Geschäft'],
      ['verloren', 'Verloren', 'Verloren'],
      ['emails_gesendet', 'E-Mails gesendet', 'E-Mails'],
    ])
  })
})

describe('wochen und summeWochen', () => {
  it('Okt 2026: KW 40 65 · KW 41 0 · KW 42 17 · KW 43 0 · KW 44 0 · Gesamt 82; angeschnittene Wochen zählen nur ihre Tage', () => {
    const nurV = [...OKT.filter((x) => x.member_id === MEMBER_V), zeile('2026-09-30', { angeschrieben: 50 })]
    const tage = tageswerte(nurV, '2026-10-01', '2026-10-31')
    const w = wochen(tage, '2026-10-14')
    expect(w.map((x) => [x.kw, x.werte.angeschrieben])).toEqual([
      [40, 65], // der 30.09. liegt in KW 40, aber vor dem Zeitraum
      [41, 0],
      [42, 17],
      [43, 0],
      [44, 0],
    ])
    expect(w[0]).toMatchObject({ jahr: 2026, von: '2026-09-28', bis: '2026-10-04', tage: 4, aktuell: false })
    expect(w[4]).toMatchObject({ von: '2026-10-26', bis: '2026-11-01', tage: 6 })
    expect(w.map((x) => x.aktuell)).toEqual([false, false, true, false, false])
    const summe = summeWochen(w)
    expect(summe.angeschrieben).toBe(82)
    expect(summe.gespraech).toBe(1)
    expect(summe.verloren).toBe(2)
    expect(summe.vernetzungen_versendet).toBe(0) // Monatszähler fehlen in der Wochentabelle
  })

  it('Jahreswechsel: 01.01.2027 gehört zur KW 53 des ISO-Jahres 2026, der 04.01. zur KW 1', () => {
    const zeilen = [zeile('2027-01-01', { angeschrieben: 5 }), zeile('2027-01-04', { angeschrieben: 2 })]
    const w = wochen(tageswerte(zeilen, '2026-12-28', '2027-01-05'), '2027-01-05')
    expect(w.map((x) => [x.jahr, x.kw, x.tage, x.werte.angeschrieben])).toEqual([
      [2026, 53, 7, 5],
      [2027, 1, 2, 2],
    ])
    expect(w[0]).toMatchObject({ von: '2026-12-28', bis: '2027-01-03', aktuell: false })
    expect(w[1]).toMatchObject({ von: '2027-01-04', bis: '2027-01-10', aktuell: true })
  })

  it('ohne Tage: keine Zeilen, Summe 0', () => {
    expect(wochen([], '2026-10-14')).toEqual([])
    expect(Object.values(summeWochen([])).every((x) => x === 0)).toBe(true)
  })
})
