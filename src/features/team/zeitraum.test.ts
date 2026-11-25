import { describe, expect, it } from 'vitest'
import { monatsanfang, parseTeamZeitraum, teamSpanne, teamZeitraum } from './zeitraum'

const HEUTE = '2026-10-15' // Donnerstag, KW 42

describe('Team-Zeitraum', () => {
  it('Heute = nur der heutige Tag, ohne Sheet-Monatszähler', () => {
    const z = teamZeitraum('heute', HEUTE)
    expect(z).toMatchObject({ von: HEUTE, bis: HEUTE, label: 'Heute', monatszaehler: false })
    expect(teamSpanne(z, HEUTE)).toBe('15.10.2026')
  })

  it('Woche = ISO-KW Mo–So wie auf der KPI-Seite; Dateline bis heute', () => {
    const z = teamZeitraum('woche', HEUTE)
    expect(z).toMatchObject({ von: '2026-10-12', bis: '2026-10-18', label: 'KW 42', monatszaehler: false })
    expect(teamSpanne(z, HEUTE)).toBe('12.–15.10.2026')
  })

  it('Monat = Kalendermonat mit Sheet-Monatszählern', () => {
    const z = teamZeitraum('monat', HEUTE)
    expect(z).toMatchObject({ von: '2026-10-01', bis: '2026-10-31', label: 'Oktober 2026', monatszaehler: true })
    expect(teamSpanne(z, HEUTE)).toBe('01.–15.10.2026')
  })

  it('URL-Parameter: unbekannt → Woche', () => {
    expect(parseTeamZeitraum('heute')).toBe('heute')
    expect(parseTeamZeitraum('monat')).toBe('monat')
    expect(parseTeamZeitraum(null)).toBe('woche')
    expect(parseTeamZeitraum('kw42')).toBe('woche')
  })

  it('Woche über einen Monatswechsel lädt ab dem Monatsanfang des ersten Tags', () => {
    const z = teamZeitraum('woche', '2026-10-01') // KW 40: 28.09.–04.10.
    expect(z.von).toBe('2026-09-28')
    expect(monatsanfang(z.von)).toBe('2026-09-01')
  })
})
