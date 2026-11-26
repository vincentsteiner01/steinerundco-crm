// data/kpis.ts: Abbilden der Sicht-Zeilen (v_kpi_tage) und der Zähler-Zeilen (daily_counters). Erfundene Zahlen.
import { describe, expect, it, vi } from 'vitest'
import { MEMBER_V } from '@/test/fixtures/leads'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

const { alsKpiZeile, alsKpiZeilen, alsTageszaehler } = await import('./kpis')

describe('alsTageszaehler', () => {
  it('keine Zeile → für den Tag noch nichts eingetragen (null)', () => {
    expect(alsTageszaehler([])).toEqual({ versendet: null, angenommen: null })
  })

  it('je Zähler der eingetragene Wert; 0 ist eingetragen, nicht leer', () => {
    expect(alsTageszaehler([{ metric: 'vernetzungen_versendet', value: 20 }])).toEqual({
      versendet: 20,
      angenommen: null,
    })
    expect(
      alsTageszaehler([
        { metric: 'vernetzungen_angenommen', value: 0 },
        { metric: 'vernetzungen_versendet', value: 15 },
        { metric: 'emails_gesendet', value: 99 },
      ]),
    ).toEqual({ versendet: 15, angenommen: 0 })
  })
})

describe('alsKpiZeile', () => {
  const roh = {
    member_id: MEMBER_V,
    tag: '2026-11-26',
    period: 'tag' as const,
    vernetzungen_versendet: 20,
    vernetzungen_angenommen: 6,
    angeschrieben: 5,
    gespraech: 1,
    im_geschaeft: 0,
    verloren: null,
    emails_gesendet: null,
    email_antworten: 2,
  }

  it('übernimmt die Zahlen, null wird 0', () => {
    expect(alsKpiZeile(roh)).toEqual({ ...roh, verloren: 0, emails_gesendet: 0 })
  })

  it('Monatszähler bleiben als solche erkennbar; Zeilen ohne Tag fallen weg', () => {
    expect(alsKpiZeile({ ...roh, tag: '2026-10-01', period: 'monat' })?.period).toBe('monat')
    expect(alsKpiZeile({ ...roh, tag: null })).toBeNull()
    expect(alsKpiZeilen([roh, { ...roh, tag: null }, { ...roh, member_id: null }])).toHaveLength(2)
  })
})
