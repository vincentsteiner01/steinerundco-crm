// planer.test.ts (BAUPLAN § 3.2 Unit-Tests, § 5.2/§ 5.3): Fälligkeiten A/B/C/A alt/Telefon/E-Mail S und N mit den Beispielen
// aus § 5.3 (heute = Mi 14.10.2026), Kalendertage + Rollen (§ 1.5 Nr. 37: Fr 16.10. + 3 → Mo 19.10., nicht Mi 21.10.),
// Wochenende, Feiertag 25.12. → 28.12., Snooze-Ziele 1–5 und D.
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import type { SequenceStep } from '@/types/domain'
import {
  naechsteFaelligkeit,
  naechsteFaelligkeitZeit,
  schrittPosition,
  snoozeZiel,
  snoozeZielDatum,
  vorschau,
} from './planer'

const FT = SETTINGS.feiertage as readonly string[]

function seq(delays: number[], weekdays_only = true) {
  const steps = delays.map(
    (d, i) =>
      ({ id: `s${i + 1}`, position: i + 1, delay_days: d, name: `Schritt ${i + 1}` }) as unknown as SequenceStep,
  )
  return { steps, weekdays_only }
}
const termine = (delays: number[], start: string) => vorschau(seq(delays), start, FT).map((z) => z.faelligAm)

describe('naechsteFaelligkeit – § 5.3 Referenzfälle', () => {
  it.each([
    ['A1 Annahme Mi → Opener +0', '2026-10-14', 0, '2026-10-14'],
    ['A2 Opener Mi → KF1 +3 (Sa → Mo)', '2026-10-14', 3, '2026-10-19'],
    ['A3 KF1 Mo → KF2 +7', '2026-10-19', 7, '2026-10-26'],
    ['A4 KF2 Mo → KF3 +10', '2026-10-26', 10, '2026-11-05'],
    ['A5 KF3 Do → LF1 +70', '2026-11-05', 70, '2027-01-14'],
    ['A6 LF1 → LF2 +84', '2027-01-14', 84, '2027-04-08'],
    ['B1 Annahme Fr → Re-Opener +2 (So → Mo)', '2026-10-16', 2, '2026-10-19'],
    ['C1 Do + 3 (So → Mo)', '2026-10-15', 3, '2026-10-19'],
    ['C2 Fr + 3 = Mo (nicht Mi 21.10.)', '2026-10-16', 3, '2026-10-19'],
    ['T1 Versuch 1 Mi → +2', '2026-10-14', 2, '2026-10-16'],
    ['T2 Versuch 2 Fr → +3 = Mo (nicht Mi 21.10.)', '2026-10-16', 3, '2026-10-19'],
    ['T3 Versuch 3 Mo → +4', '2026-10-19', 4, '2026-10-23'],
    ['T4 Versuch 4 Fr → +5', '2026-10-23', 5, '2026-10-28'],
    ['T5 Versuch 5 Mi → +90 (Di)', '2026-10-28', 90, '2027-01-26'],
    ['E1 Erstgespräch Fr → E0 +0', '2026-10-16', 0, '2026-10-16'],
    ['E2 E0 Fr → E1 +3', '2026-10-16', 3, '2026-10-19'],
    ['F1 Ziel Fr 25.12. (Feiertag, 26.12. Feiertag, So) → Mo 28.12.', '2026-12-22', 3, '2026-12-28'],
    ['F2 Ziel Sa 31.10. (Reformationstag) → Mo 02.11.', '2026-10-28', 3, '2026-11-02'],
  ])('%s', (_fall, von, delay, erwartet) => {
    expect(naechsteFaelligkeit(von, delay, true, FT)).toBe(erwartet)
  })

  it('zählt nie Werktage ab: Fr + 3 ist Mo, nicht Mi', () => {
    expect(naechsteFaelligkeit('2026-10-16', 3, true, FT)).not.toBe('2026-10-21')
  })

  it('ohne weekdays_only wird nicht gerollt', () => {
    expect(naechsteFaelligkeit('2026-10-14', 3, false, FT)).toBe('2026-10-17')
  })

  it('akzeptiert einen Zeitpunkt (Berliner Kalendertag zählt, nicht UTC)', () => {
    // 23:30 Berlin am Mi 14.10. = 21:30 UTC – Kalendertag bleibt Mittwoch
    expect(naechsteFaelligkeit(new Date('2026-10-14T21:30:00Z'), 3, true, FT)).toBe('2026-10-19')
  })

  it('naechsteFaelligkeitZeit liefert 09:00 Europe/Berlin (due_on)', () => {
    expect(naechsteFaelligkeitZeit('2026-10-14', 3, true, FT).toISOString()).toBe('2026-10-19T07:00:00.000Z')
    // nach der Zeitumstellung (MEZ): 09:00 = 08:00 UTC
    expect(naechsteFaelligkeitZeit('2026-10-28', 0, true, FT).toISOString()).toBe('2026-10-28T08:00:00.000Z')
  })
})

describe('vorschau – Termine je Schritt (Vorschau-Spalte des Editors, SE-01)', () => {
  it('A (0/3/7/10/70/84) ab Mi 14.10. = Kette A1–A6', () => {
    expect(termine([0, 3, 7, 10, 70, 84], '2026-10-14')).toEqual([
      '2026-10-14',
      '2026-10-19',
      '2026-10-26',
      '2026-11-05',
      '2027-01-14',
      '2027-04-08',
    ])
  })
  it('B (2/4/7/10/70/84) ab Fr 16.10.', () => {
    expect(termine([2, 4, 7, 10, 70, 84], '2026-10-16')).toEqual([
      '2026-10-19',
      '2026-10-23',
      '2026-10-30',
      '2026-11-09',
      '2027-01-18',
      '2027-04-12',
    ])
  })
  it('C (3/7/70) ab Do 15.10.', () => {
    expect(termine([3, 7, 70], '2026-10-15')).toEqual(['2026-10-19', '2026-10-26', '2027-01-04'])
  })
  it('A alt (0/3/3/3/30/30) ab Mi 14.10. – Weihnachten rollt auf Mo 28.12.', () => {
    expect(termine([0, 3, 3, 3, 30, 30], '2026-10-14')).toEqual([
      '2026-10-14',
      '2026-10-19',
      '2026-10-22',
      '2026-10-26',
      '2026-11-25',
      '2026-12-28',
    ])
  })
  it('Telefon-Standard (0/2/3/4/5/90) ab Mi 14.10. = T1–T5', () => {
    expect(termine([0, 2, 3, 4, 5, 90], '2026-10-14')).toEqual([
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-23',
      '2026-10-28',
      '2027-01-26',
    ])
  })
  it('E-Mail Strategiegespräch S (0/5/9) ab Fr 16.10.', () => {
    expect(termine([0, 5, 9], '2026-10-16')).toEqual(['2026-10-16', '2026-10-21', '2026-10-30'])
  })
  it('E-Mail No-Show N (0/3) ab Fr 16.10.', () => {
    expect(termine([0, 3], '2026-10-16')).toEqual(['2026-10-16', '2026-10-19'])
  })
  it('E-Mail Erstgespräch (0/3/7/11/69) ab Fr 16.10. – E0/E1', () => {
    expect(termine([0, 3, 7, 11, 69], '2026-10-16').slice(0, 2)).toEqual(['2026-10-16', '2026-10-19'])
  })
  it('SE-01: Kurzfristig 2 von 7 auf 5 Tage – Erledigt-Tag von KF1 Do 22.10. → Di 27.10. statt Do 29.10.', () => {
    expect(naechsteFaelligkeit('2026-10-22', 7, true, FT)).toBe('2026-10-29')
    expect(naechsteFaelligkeit('2026-10-22', 5, true, FT)).toBe('2026-10-27')
    // Vorschau rechnet die Folgeschritte vom geänderten Termin weiter
    expect(termine([0, 8, 5, 10], '2026-10-14')).toEqual(['2026-10-14', '2026-10-22', '2026-10-27', '2026-11-06'])
  })
  it('sortiert nach Position, auch wenn die Schritte anders kommen', () => {
    const s = seq([0, 3])
    const umgedreht = { steps: [...s.steps].reverse(), weekdays_only: true }
    expect(vorschau(umgedreht, '2026-10-14', FT).map((z) => z.step.position)).toEqual([1, 2])
  })
})

describe('snoozeZiel – Später 1–5 und D (ux § 5.3)', () => {
  it.each([
    ['1', '2026-10-15'],
    ['2', '2026-10-19'],
    ['3', '2026-10-19'],
    ['4', '2026-10-21'],
    ['5', '2026-12-14'],
  ] as const)('Option %s ab Mi 14.10. → %s', (option, erwartet) => {
    expect(snoozeZiel(option, '2026-10-14', FT)).toBe(erwartet)
  })
  it('A8: „Nächster Montag“ am Fr 23.10. → Mo 26.10.', () => {
    expect(snoozeZiel('3', '2026-10-23', FT)).toBe('2026-10-26')
  })
  it('„Morgen“ am Freitag rollt auf Montag', () => {
    expect(snoozeZiel('1', '2026-10-16', FT)).toBe('2026-10-19')
  })
  it('D: freies Datum wird gerollt (25.12. → 28.12.)', () => {
    expect(snoozeZielDatum('2026-12-25', FT)).toBe('2026-12-28')
    expect(snoozeZielDatum('2026-10-20', FT)).toBe('2026-10-20')
  })
})

describe('schrittPosition', () => {
  it('liefert Position n von m', () => {
    const { steps } = seq([0, 3, 7])
    expect(schrittPosition(steps, 's2')).toMatchObject({ position: 2, gesamt: 3 })
    expect(schrittPosition(steps, 'x')).toBeNull()
    expect(schrittPosition(steps, null)).toBeNull()
  })
})
