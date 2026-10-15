import { describe, expect, it } from 'vitest'
import type { ActivityZeitraum } from '@/data/activities'
import type { MetricEventZeile } from '@/data/kpis'
import { anteile, erledigtJePerson, juengster, nachTagen, werteJePerson, zuletztAktiv } from './kennzahlen'
import { METRIK_ZEILEN, MEMBER_M, MEMBER_V } from './_testHilfe'

const zeilen = METRIK_ZEILEN as unknown as MetricEventZeile[]
const WOCHE = { von: '2026-10-12', bis: '2026-10-18', monatszaehler: false }
const MONAT = { von: '2026-10-01', bis: '2026-10-31', monatszaehler: true }
const fu = (member_id: string, occurred_at: string, type = 'nachricht_gesendet') =>
  ({ member_id, occurred_at, type }) as Pick<ActivityZeitraum, 'member_id' | 'occurred_at' | 'type'>

describe('werteJePerson', () => {
  it('Woche: Sheet-Monatswerte zählen nicht, Tageszähler und Ereignisse schon (Regel der KPI-Seite)', () => {
    const v = werteJePerson(MEMBER_V, zeilen, [], WOCHE)
    expect(v.werte.anfragen).toBe(0)
    expect(v.werte.antworten).toBe(0)
    expect(v.werte.eroeffnet).toBe(17)
    expect(v.werte.termine).toBe(0) // 03.10. liegt vor der Woche
    expect(v.sheetMonat).toBe(true)
    expect(v.nurSheet.size).toBe(0)

    const m = werteJePerson(MEMBER_M, zeilen, [fu(MEMBER_M, '2026-10-15T08:00:00Z')], WOCHE)
    expect(m.werte).toMatchObject({ annahmen: 2, eroeffnet: 3, anrufe: 5, followups: 1, antworten: 0 })
    expect(m.erreicht).toBe(2)
    expect(m.sheetMonat).toBe(false)
  })

  it('Monat: Sheet-Monatswerte zählen und tragen das Badge „aus Sheet“', () => {
    const v = werteJePerson(MEMBER_V, zeilen, [], MONAT)
    expect(v.werte).toMatchObject({ anfragen: 305, antworten: 19, eroeffnet: 17, termine: 1 })
    expect([...v.nurSheet].sort()).toEqual(['anfragen', 'antworten'])
    const m = werteJePerson(MEMBER_M, zeilen, [], MONAT)
    expect(m.werte.antworten).toBe(1)
  })

  it('Follow-ups zählen nur `nachricht_gesendet` der Person', () => {
    const akt = [fu(MEMBER_V, 'x'), fu(MEMBER_V, 'x', 'pitch_gesendet'), fu(MEMBER_M, 'x')]
    expect(werteJePerson(MEMBER_V, [], akt, WOCHE).werte.followups).toBe(1)
  })
})

describe('erledigtJePerson', () => {
  it('zählt gesendete, angerufene und abgehakte Schritte, keine Notizen oder Stufenwechsel', () => {
    const akt = ['gespraech_eroeffnet', 'anruf', 'vernetzung_angenommen', 'notiz', 'stage_wechsel'].map(
      (type) => ({ member_id: MEMBER_V, type }) as Pick<ActivityZeitraum, 'member_id' | 'type'>,
    )
    expect(erledigtJePerson(MEMBER_V, akt)).toBe(3)
    expect(erledigtJePerson(MEMBER_M, akt)).toBe(0)
  })
})

describe('anteile', () => {
  it('relativ zum größeren Wert; 0/0 bleibt leer', () => {
    expect(anteile(305, 0)).toEqual({ links: 1, rechts: 0 })
    expect(anteile(5, 20)).toEqual({ links: 0.25, rechts: 1 })
    expect(anteile(0, 0)).toEqual({ links: 0, rechts: 0 })
  })
})

describe('zuletztAktiv', () => {
  const jetzt = new Date('2026-10-15T11:30:00+02:00')
  it('Minuten, Stunden, gestern, Datum – mit geschütztem Leerzeichen vor der Einheit', () => {
    expect(zuletztAktiv('2026-10-15T09:29:40Z', jetzt)).toBe('gerade eben')
    expect(zuletztAktiv('2026-10-15T09:26:00Z', jetzt)).toBe('vor 4 Min.')
    expect(zuletztAktiv('2026-10-15T06:10:00Z', jetzt)).toBe('vor 3 Std.')
    expect(zuletztAktiv('2026-10-14T15:02:00Z', jetzt)).toBe('gestern, 17:02')
    expect(zuletztAktiv('2026-10-12T09:00:00Z', jetzt)).toBe('Mo 12.10.')
    expect(zuletztAktiv(null, jetzt)).toBe('noch nichts erfasst')
  })

  it('juengster wählt den späteren Zeitpunkt', () => {
    expect(juengster('2026-10-12T09:00:00Z', '2026-10-15T07:00:00Z', null)).toBe('2026-10-15T07:00:00Z')
    expect(juengster(null, undefined)).toBeNull()
  })
})

describe('nachTagen', () => {
  it('gruppiert nach Berliner Kalendertag: Heute · Gestern · Mo 12.10.', () => {
    const g = nachTagen(
      [
        { occurred_at: '2026-10-15T08:15:00Z' },
        { occurred_at: '2026-10-14T22:30:00Z' }, // 00:30 Berlin am 15.10.
        { occurred_at: '2026-10-14T15:00:00Z' },
        { occurred_at: '2026-10-12T09:00:00Z' },
      ],
      '2026-10-15',
    )
    expect(g.map((x) => [x.label, x.zeilen.length])).toEqual([
      ['Heute', 2],
      ['Gestern', 1],
      ['Mo 12.10.', 1],
    ])
  })
})
