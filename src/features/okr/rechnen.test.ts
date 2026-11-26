import { describe, expect, it } from 'vitest'
import { leereSummen, type KpiZeile } from '@/features/kpis/kennzahlen'
import {
  ampel,
  anzahlTage,
  aufgerundet,
  ergebnisZeile,
  fortschritt,
  fortschritte,
  istSollText,
  istWert,
  proTag,
  schlechtester,
  sichtbareZiele,
  soll,
  startMonat,
  wertText,
  wocheVon,
  zeitAnteil,
  zeitraumFuer,
  zeitraumText,
  zielAnteil,
  type OkrEintrag,
  type OkrErgebnis,
  type OkrZiel,
} from './rechnen'

// Dezember 2026: der 1. ist ein Dienstag, der 25. ein Freitag (Feiertag) → 22 Werktage, 31 Kalendertage
const FEIER = ['2026-12-25', '2026-12-26']
const DEZ = { von: '2026-12-01', bis: '2026-12-31' }
const V = 'mitglied-v'
const M = 'mitglied-m'

const kr = (o: Partial<OkrErgebnis> = {}): OkrErgebnis => ({
  id: 'kr-1',
  ziel_id: 'z-1',
  titel: 'DMs senden',
  zielwert: 100,
  takt: 'zeitraum',
  je_person: true,
  quelle: 'angeschrieben',
  faktor: 1,
  einheit: null,
  position: 0,
  ...o,
})
const ziel = (o: Partial<OkrZiel> = {}): OkrZiel => ({
  id: 'z-1',
  titel: 'Sales',
  ebene: 'monat',
  ...DEZ,
  position: 0,
  ...o,
})
const zeile = (member_id: string | null, tag: string, o: Partial<KpiZeile> = {}): KpiZeile => ({
  member_id,
  tag,
  period: 'tag',
  ...leereSummen(),
  ...o,
})
const eintrag = (member_id: string, tag: string, wert: number, ergebnis_id = 'kr-1'): OkrEintrag => ({
  ergebnis_id,
  member_id,
  tag,
  wert,
})

describe('Zeiträume', () => {
  it('Monat, Quartal und Jahr ab einem Startmonat', () => {
    expect(zeitraumFuer('monat', '2026-12-15')).toEqual({ von: '2026-12-01', bis: '2026-12-31' })
    expect(zeitraumFuer('quartal', '2026-12-01')).toEqual({ von: '2026-12-01', bis: '2027-02-28' })
    expect(zeitraumFuer('jahr', '2026-12-01')).toEqual({ von: '2026-12-01', bis: '2027-11-30' })
  })

  it('Beschriftung: ein Monat ausgeschrieben, sonst von–bis', () => {
    expect(zeitraumText(DEZ)).toBe('Dezember 2026')
    expect(zeitraumText({ von: '2026-12-01', bis: '2027-02-28' })).toBe('Dez. 2026 – Febr. 2027')
  })

  it('zählende Tage: Werktage ohne Feiertage, bei „alle“ jeder Tag', () => {
    expect(anzahlTage(DEZ.von, DEZ.bis, 'werktage', FEIER)).toBe(22)
    expect(anzahlTage(DEZ.von, DEZ.bis, 'alle', FEIER)).toBe(31)
    expect(anzahlTage('2026-12-05', '2026-12-06', 'werktage', FEIER)).toBe(0) // Wochenende
    expect(anzahlTage('2026-12-10', '2026-12-01', 'alle', FEIER)).toBe(0)
  })

  it('Woche läuft von Montag bis Sonntag', () => {
    expect(wocheVon('2026-12-10')).toEqual({ von: '2026-12-07', bis: '2026-12-13' })
    expect(wocheVon('2026-12-13')).toEqual({ von: '2026-12-07', bis: '2026-12-13' })
    expect(wocheVon('2026-12-07')).toEqual({ von: '2026-12-07', bis: '2026-12-13' })
  })

  it('Anteil der vergangenen Zeit', () => {
    expect(zeitAnteil(DEZ, '2026-11-30')).toBe(0)
    expect(zeitAnteil(DEZ, '2026-12-01')).toBeCloseTo(1 / 31)
    expect(zeitAnteil(DEZ, '2027-01-05')).toBe(1)
  })

  it('zeigt für einen Monat die großen Ziele (Jahr vor Quartal) und die Monatsziele', () => {
    const ziele = [
      ziel({ id: 'm2', titel: 'Selbstdarstellung', position: 1 }),
      ziel({ id: 'q', titel: 'Q1', ebene: 'quartal', bis: '2027-02-28' }),
      ziel({ id: 'm1', titel: 'Sales', position: 0 }),
      ziel({ id: 'j', titel: 'Jahr', ebene: 'jahr', bis: '2027-11-30' }),
      ziel({ id: 'jan', titel: 'Sales', von: '2027-01-01', bis: '2027-01-31' }),
    ]
    const dez = sichtbareZiele(ziele, '2026-12-10')
    expect(dez.gross.map((z) => z.id)).toEqual(['j', 'q'])
    expect(dez.monat.map((z) => z.id)).toEqual(['m1', 'm2'])
    const maerz = sichtbareZiele(ziele, '2027-03-01')
    expect(maerz.gross.map((z) => z.id)).toEqual(['j'])
    expect(maerz.monat).toEqual([])
  })

  it('Startmonat: der laufende mit Zielen, sonst der nächste mit Zielen, sonst der laufende', () => {
    const ziele = [ziel(), ziel({ id: 'jan', von: '2027-01-01', bis: '2027-01-31' })]
    expect(startMonat(ziele, '2026-12-10')).toBe('2026-12-01')
    expect(startMonat(ziele, '2026-11-26')).toBe('2026-12-01')
    expect(startMonat(ziele, '2027-03-02')).toBe('2027-03-01')
    expect(startMonat([], '2026-11-26')).toBe('2026-11-01')
  })
})

describe('Soll', () => {
  it('Zielwert für den ganzen Zeitraum: Monat genau, Woche und Tag anteilig nach Werktagen', () => {
    const e = kr()
    expect(soll(e, DEZ, DEZ.von, DEZ.bis, FEIER)).toBe(100)
    expect(proTag(e, DEZ, FEIER)).toBeCloseTo(100 / 22)
    expect(aufgerundet(soll(e, DEZ, '2026-12-07', '2026-12-13', FEIER))).toBe(23)
    expect(aufgerundet(soll(e, DEZ, '2026-12-10', '2026-12-10', FEIER))).toBe(5)
    expect(soll(e, DEZ, '2026-12-12', '2026-12-13', FEIER)).toBe(0) // Wochenende
    // Woche über das Monatsende hinaus zählt nur bis zum 31.
    expect(soll(e, DEZ, '2026-12-28', '2027-01-03', FEIER)).toBeCloseTo((100 / 22) * 4)
    expect(soll(e, DEZ, '2027-01-04', '2027-01-10', FEIER)).toBe(0)
  })

  it('Zielwert je Tag: 20 am Tag sind 100 in der Woche und 440 im Dezember', () => {
    const e = kr({ zielwert: 20, takt: 'tag', quelle: 'vernetzungen_versendet' })
    expect(soll(e, DEZ, '2026-12-10', '2026-12-10', FEIER)).toBe(20)
    expect(soll(e, DEZ, '2026-12-07', '2026-12-13', FEIER)).toBe(100)
    expect(soll(e, DEZ, DEZ.von, DEZ.bis, FEIER)).toBe(440)
  })

  it('Zielwert je Woche: 100 in der Woche sind 20 am Tag; die Woche mit Feiertag hat 80', () => {
    const e = kr({ zielwert: 100, takt: 'woche' })
    expect(soll(e, DEZ, '2026-12-10', '2026-12-10', FEIER)).toBe(20)
    expect(soll(e, DEZ, '2026-12-21', '2026-12-27', FEIER)).toBe(80)
  })

  it('E-Mails zählen an allen Tagen: 3.000 im Dezember sind 97 am Tag', () => {
    const e = kr({ zielwert: 3000, quelle: 'emails_gesendet', je_person: false })
    expect(aufgerundet(soll(e, DEZ, '2026-12-12', '2026-12-12', FEIER))).toBe(97)
    expect(aufgerundet(soll(e, DEZ, '2026-12-07', '2026-12-13', FEIER))).toBe(678)
  })

  it('aufgerundet lässt ganze Zahlen ganz', () => {
    expect(aufgerundet(4)).toBe(4)
    expect(aufgerundet(4.0000000001)).toBe(4)
    expect(aufgerundet(4.2)).toBe(5)
  })
})

describe('Ist', () => {
  const kpi = [
    zeile(V, '2026-12-01', { angeschrieben: 4, emails_gesendet: 50, im_geschaeft: 1 }),
    zeile(M, '2026-12-01', { angeschrieben: 6 }),
    zeile(V, '2026-12-08', { angeschrieben: 5 }),
    zeile(null, '2026-12-08', { emails_gesendet: 10 }),
    zeile(V, '2026-11-30', { angeschrieben: 99 }), // vor dem Zeitraum
    { ...zeile(V, '2026-12-01', { angeschrieben: 500 }), period: 'monat' as const }, // alter Monatszähler zählt nie
  ]

  it('zählt aus dem CRM je Person oder fürs Team, nur im Ausschnitt', () => {
    const z = { kpi, eintraege: [] }
    expect(istWert(kr(), V, z, DEZ.von, DEZ.bis)).toBe(9)
    expect(istWert(kr(), M, z, DEZ.von, DEZ.bis)).toBe(6)
    expect(istWert(kr(), null, z, DEZ.von, DEZ.bis)).toBe(15)
    expect(istWert(kr(), V, z, '2026-12-07', '2026-12-13')).toBe(5)
    // Team zählt auch Zeilen ohne Person
    expect(istWert(kr({ quelle: 'emails_gesendet' }), null, z, DEZ.von, DEZ.bis)).toBe(60)
  })

  it('Faktor rechnet um: ein Neukunde mal 5.000 € Kundenwert', () => {
    const umsatz = kr({ quelle: 'im_geschaeft', faktor: 5000, einheit: '€', je_person: false })
    expect(istWert(umsatz, null, { kpi, eintraege: [] }, DEZ.von, DEZ.bis)).toBe(5000)
  })

  it('von Hand: die Einträge des Key Results, je Person', () => {
    const e = kr({ quelle: 'manuell' })
    const eintraege = [
      eintrag(V, '2026-12-02', 1),
      eintrag(V, '2026-12-09', 2),
      eintrag(M, '2026-12-09', 1),
      eintrag(V, '2026-12-09', 7, 'anderes-kr'),
    ]
    expect(istWert(e, V, { kpi, eintraege }, DEZ.von, DEZ.bis)).toBe(3)
    expect(istWert(e, null, { kpi, eintraege }, DEZ.von, DEZ.bis)).toBe(4)
    expect(istWert(e, V, { kpi, eintraege }, '2026-12-07', '2026-12-13')).toBe(2)
  })
})

describe('Ampel', () => {
  it('geschafft, offen, verfehlt', () => {
    expect(ampel(100, 100, 50, DEZ, '2026-12-10')).toBe('geschafft')
    expect(ampel(0, 100, 0, DEZ, '2026-11-26')).toBe('offen')
    expect(ampel(80, 100, 100, DEZ, '2027-01-02')).toBe('verfehlt')
    expect(ampel(0, 0, 0, DEZ, '2026-12-10')).toBe('offen')
  })

  it('im Plan, knapp, hinten – gemessen am Soll bis gestern', () => {
    expect(ampel(32, 100, 31.8, DEZ, '2026-12-10')).toBe('im_plan')
    expect(ampel(31, 100, 31.8, DEZ, '2026-12-10')).toBe('im_plan') // abgerundetes Soll
    expect(ampel(25, 100, 31.8, DEZ, '2026-12-10')).toBe('knapp')
    expect(ampel(10, 100, 31.8, DEZ, '2026-12-10')).toBe('hinten')
    // am ersten Tag gibt es noch kein Soll bis gestern
    expect(ampel(0, 100, 0, DEZ, '2026-12-01')).toBe('im_plan')
  })

  it('kleine Ziele: 1 von 4 Beiträgen reicht, solange das Soll bis gestern unter 2 liegt', () => {
    expect(ampel(1, 4, 1.6, DEZ, '2026-12-12')).toBe('im_plan')
    expect(ampel(0, 4, 0.9, DEZ, '2026-12-07')).toBe('im_plan')
    expect(ampel(0, 4, 1.6, DEZ, '2026-12-12')).toBe('hinten')
  })

  it('schlechtester Stand eines Ziels', () => {
    expect(schlechtester(['im_plan', 'knapp', 'geschafft'])).toBe('knapp')
    expect(schlechtester(['geschafft', 'geschafft'])).toBe('geschafft')
    expect(schlechtester(['offen', 'hinten'])).toBe('hinten')
    expect(schlechtester([])).toBe('geschafft')
  })
})

describe('Fortschritt', () => {
  // Donnerstag, 10.12.2026: bis gestern liegen 7 Werktage (1.–4., 7.–9.) → Soll bis gestern 31,8
  const HEUTE = '2026-12-10'
  const kpi = [
    zeile(V, '2026-12-02', { angeschrieben: 12 }),
    zeile(V, '2026-12-08', { angeschrieben: 10 }),
    zeile(V, HEUTE, { angeschrieben: 3 }),
    zeile(M, '2026-12-03', { angeschrieben: 40 }),
  ]

  it('Balken, Tempo, Ampel, Woche und Heute einer Person', () => {
    const f = fortschritt(kr(), DEZ, V, { kpi, eintraege: [] }, HEUTE, FEIER)
    expect(f.ist).toBe(25)
    expect(f.soll).toBe(100)
    expect(f.anteil).toBeCloseTo(0.25)
    expect(f.tempo).toBeCloseTo(7 / 22)
    expect(f.status).toBe('knapp')
    expect(f.woche?.ist).toBe(13)
    expect(aufgerundet(f.woche?.soll ?? 0)).toBe(23)
    expect(f.heute?.ist).toBe(3)
    expect(aufgerundet(f.heute?.soll ?? 0)).toBe(5)
  })

  it('je Person ein Fortschritt, fürs Team einer', () => {
    const je = fortschritte(kr(), DEZ, [V, M], { kpi, eintraege: [] }, HEUTE, FEIER)
    expect(je.map((f) => [f.memberId, f.ist, f.status])).toEqual([
      [V, 25, 'knapp'],
      [M, 40, 'im_plan'],
    ])
    const team = fortschritte(kr({ je_person: false }), DEZ, [V, M], { kpi, eintraege: [] }, HEUTE, FEIER)
    expect(team).toHaveLength(1)
    expect(team[0]?.memberId).toBeNull()
    expect(team[0]?.ist).toBe(65)
  })

  it('am Wochenende gibt es kein Tagesziel, außerhalb des Zeitraums weder Woche noch Heute', () => {
    const z = { kpi, eintraege: [] }
    expect(fortschritt(kr(), DEZ, V, z, '2026-12-12', FEIER).heute).toBeNull()
    expect(fortschritt(kr(), DEZ, V, z, '2026-12-12', FEIER).woche).not.toBeNull()
    const davor = fortschritt(kr(), DEZ, V, z, '2026-11-26', FEIER)
    expect([davor.woche, davor.heute, davor.status, davor.tempo]).toEqual([null, null, 'offen', 0])
    const danach = fortschritt(kr(), DEZ, V, z, '2027-01-04', FEIER)
    expect([danach.woche, danach.heute, danach.status, danach.tempo]).toEqual([null, null, 'verfehlt', 1])
  })

  it('von Hand: nachgetragene Einträge nach Monatsende zählen zum Ganzen, nicht zur Woche', () => {
    const e = kr({ quelle: 'manuell', zielwert: 4 })
    const eintraege = [eintrag(V, '2026-12-09', 2), eintrag(V, '2027-01-02', 2)]
    const f = fortschritt(e, DEZ, V, { kpi: [], eintraege }, '2027-01-02', FEIER)
    expect(f.ist).toBe(4)
    expect(f.status).toBe('geschafft')
    const mitten = fortschritt(e, DEZ, V, { kpi: [], eintraege: [eintrag(V, '2026-12-09', 2)] }, HEUTE, FEIER)
    expect(mitten.woche?.ist).toBe(2)
    // vier im Monat sind kein Tagesziel
    expect(mitten.heute).toBeNull()
  })

  it('kleine Ziele haben kein Tagesziel und – unter einem pro Woche – auch kein Wochenziel', () => {
    const z = { kpi: [], eintraege: [] }
    const vier = fortschritt(kr({ quelle: 'manuell', zielwert: 4 }), DEZ, V, z, HEUTE, FEIER) // 0,9 pro Woche
    expect(aufgerundet(vier.woche?.soll ?? 0)).toBe(1)
    expect(vier.heute).toBeNull()
    const zwei = fortschritt(kr({ quelle: 'manuell', zielwert: 2 }), DEZ, V, z, HEUTE, FEIER) // 0,45 pro Woche
    expect([zwei.woche, zwei.heute]).toEqual([null, null])
  })

  it('Fortschritt eines Ziels ist der Durchschnitt seiner Key Results, über 100 % wird nicht angerechnet', () => {
    const z = { kpi, eintraege: [] }
    const dms = fortschritte(kr(), DEZ, [V, M], z, HEUTE, FEIER) // 25 % und 40 % → 32,5 %
    const fertig = fortschritte(kr({ zielwert: 10, je_person: false }), DEZ, [V, M], z, HEUTE, FEIER) // 65 von 10 → 100 %
    expect(zielAnteil([dms, fertig])).toBeCloseTo((0.325 + 1) / 2)
    expect(zielAnteil([])).toBe(0)
  })
})

describe('Anzeige', () => {
  it('Zahlen mit Tausenderpunkt und Einheit', () => {
    expect(wertText(3000, null)).toBe('3.000')
    expect(wertText(120000, '€')).toBe('120.000 €')
    expect(istSollText({ ist: 13, soll: 22.7 }, null)).toBe('13 / 23')
  })

  it('eine Zeile unter dem Titel', () => {
    expect(ergebnisZeile(kr())).toBe('100 im ganzen Zeitraum · je Person · zählt von selbst')
    expect(ergebnisZeile(kr({ zielwert: 20, takt: 'tag', quelle: 'manuell', je_person: false }))).toBe(
      '20 je Tag · fürs Team · von Hand',
    )
  })
})
