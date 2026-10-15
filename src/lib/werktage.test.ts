// BAUPLAN § 3.1.12 – Fixture-Vergleich: 1 000 Daten aus crm.roll_to_weekday (Live-DB).
import { describe, expect, it } from 'vitest'
import fixture from '@/test/fixtures/werktage.fixture.json'
import {
  FEIERTAGE_HH,
  addWerktage,
  istWerktag,
  naechsterFaelligTag,
  naechsterWerktag,
  rollToWeekday,
  werktageZwischen,
} from './werktage'

type Fixture = { feiertage: string[]; faelle: { datum: string; werktag: string }[] }
const fx = fixture as Fixture

describe('rollToWeekday', () => {
  it('spiegelt crm.roll_to_weekday für alle Fixture-Fälle', () => {
    expect(fx.faelle.length).toBeGreaterThanOrEqual(1000)
    const fehler: string[] = []
    for (const f of fx.faelle) {
      const ist = rollToWeekday(f.datum, fx.feiertage)
      if (ist !== f.werktag) fehler.push(`${f.datum}: erwartet ${f.werktag}, ist ${ist}`)
    }
    expect(fehler).toEqual([])
  })

  it('Referenzfälle § 5.3 (Feiertage aus dem Seed)', () => {
    expect(rollToWeekday('2026-10-17', fx.feiertage)).toBe('2026-10-19') // A2: Sa → Mo
    expect(rollToWeekday('2026-10-18', fx.feiertage)).toBe('2026-10-19') // C1: So → Mo
    expect(rollToWeekday('2026-10-19', fx.feiertage)).toBe('2026-10-19') // C2: Mo bleibt
    expect(rollToWeekday('2026-12-25', fx.feiertage)).toBe('2026-12-28') // F1
    expect(rollToWeekday('2026-10-31', fx.feiertage)).toBe('2026-11-02') // F2
  })

  it('nimmt ein Date (Berliner Kalendertag) entgegen', () => {
    // Sa 17.10.2026 23:30 Berlin = 21:30 UTC
    expect(rollToWeekday(new Date('2026-10-17T21:30:00Z'))).toBe('2026-10-19')
    // Fr 16.10. 23:30 Berlin → Werktag
    expect(rollToWeekday(new Date('2026-10-16T21:30:00Z'))).toBe('2026-10-16')
  })

  it('bricht wie die DB nach 10 Schritten ab', () => {
    const alleTage = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    expect(rollToWeekday('2026-11-01', alleTage)).toBe('2026-11-11')
  })
})

describe('FEIERTAGE_HH', () => {
  it('enthält jeden Seed-Feiertag (Fixture) und ist sortiert, 2026–2028', () => {
    for (const f of fx.feiertage) expect(FEIERTAGE_HH).toContain(f)
    expect([...FEIERTAGE_HH].sort()).toEqual([...FEIERTAGE_HH])
    expect(FEIERTAGE_HH.some((f) => f.startsWith('2028-'))).toBe(true)
    expect(new Set(FEIERTAGE_HH).size).toBe(FEIERTAGE_HH.length)
  })
})

describe('istWerktag / naechsterWerktag / addWerktage', () => {
  it('Wochenende und Feiertage sind keine Werktage', () => {
    expect(istWerktag('2026-10-14')).toBe(true)
    expect(istWerktag('2026-10-17')).toBe(false)
    expect(istWerktag('2026-10-31')).toBe(false)
    expect(istWerktag('2026-10-31', [])).toBe(false) // Samstag ohnehin
    expect(istWerktag('2026-12-25', [])).toBe(true) // Freitag ohne Feiertagsliste
  })
  it('nächster Werktag liegt strikt nach dem Tag', () => {
    expect(naechsterWerktag('2026-10-14')).toBe('2026-10-15')
    expect(naechsterWerktag('2026-10-16')).toBe('2026-10-19')
    expect(naechsterWerktag('2026-12-24')).toBe('2026-12-28')
  })
  it('addWerktage zählt nur Werktage (nicht für Sequenz-Delays)', () => {
    expect(addWerktage('2026-10-16', 3)).toBe('2026-10-21') // Fr + 3 Werktage = Mi
    expect(addWerktage('2026-10-16', 0)).toBe('2026-10-16')
    expect(addWerktage('2026-10-17', 0)).toBe('2026-10-19')
    expect(addWerktage('2026-10-19', -1)).toBe('2026-10-16')
  })
  it('naechsterFaelligTag = Kalendertage + Rollen (§ 1.5 Nr. 37)', () => {
    expect(naechsterFaelligTag('2026-10-16', 3)).toBe('2026-10-19') // C2
    expect(naechsterFaelligTag('2026-10-15', 3)).toBe('2026-10-19') // C1
    expect(naechsterFaelligTag('2026-10-16', 1)).toBe('2026-10-19')
    expect(naechsterFaelligTag('2026-10-16', 1, false)).toBe('2026-10-17')
    expect(naechsterFaelligTag('2026-11-05', 70)).toBe('2027-01-14') // A5
  })
  it('werktageZwischen', () => {
    expect(werktageZwischen('2026-10-16', '2026-10-19')).toBe(1)
    expect(werktageZwischen('2026-10-14', '2026-10-14')).toBe(0)
    expect(werktageZwischen('2026-10-19', '2026-10-16')).toBe(-1)
  })
})
