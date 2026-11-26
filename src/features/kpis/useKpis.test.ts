// useKpis.ts, der reine Teil: geladene Zeilen → Zahlen des Reiters. Schwerpunkt: die alten Monatszähler. In der Monatsansicht
// zählen sie mit; in jedem anderen Zeitraum nicht – dann gibt es für ihre Kennzahlen keinen Vergleich. Das gilt auch für eine
// Person ohne eigenen Monatszähler (die der anderen kommen als viertes Argument). Erfundene Zahlen.
import { describe, expect, it, vi } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { leereSummen, type KpiZeile, type Summen } from './kennzahlen'
import { auswerten, ladenAb } from './useKpis'
import { parseZeitraum } from './zeitraum'

const HEUTE = '2026-11-26'
const zeitraum = (z: string) => parseZeitraum(new URLSearchParams(`zeitraum=${z}`), HEUTE)
const zeile = (tag: string, werte: Partial<Summen>, period: KpiZeile['period'] = 'tag'): KpiZeile => ({
  member_id: MEMBER_V,
  tag,
  period,
  ...leereSummen(),
  ...werte,
})

// Oktober: versendet fast nur im Monatszähler (305), dazu wenige Tageswerte; Annahmen als Tageswerte
const ZEILEN: KpiZeile[] = [
  zeile('2026-10-01', { vernetzungen_versendet: 305 }, 'monat'),
  zeile('2026-10-05', { vernetzungen_versendet: 10, vernetzungen_angenommen: 60, angeschrieben: 40 }),
  zeile('2026-10-20', { vernetzungen_versendet: 7, vernetzungen_angenommen: 57, angeschrieben: 50, gespraech: 3 }),
  zeile('2026-10-29', { vernetzungen_versendet: 4, angeschrieben: 5 }),
  zeile('2026-11-10', { vernetzungen_versendet: 300, vernetzungen_angenommen: 80, angeschrieben: 70 }),
  zeile('2026-11-24', { vernetzungen_versendet: 200, vernetzungen_angenommen: 42, angeschrieben: 38 }),
]
const geladen = (von: string, bis: string) => ZEILEN.filter((z) => z.tag >= von && z.tag <= bis)

/** Wie useKpis: beide Spannen ab `ladenAb` laden und auswerten. */
function zahlen(z: string) {
  const zr = zeitraum(z)
  return auswerten(geladen(ladenAb(zr.von, zr), zr.bis), geladen(ladenAb(zr.vorperiode.von, zr), zr.vorperiode.bis), zr)
}

describe('ladenAb', () => {
  it('Monatsansicht: ab dem ersten Tag des Zeitraums; sonst ab dem Monatsersten davor', () => {
    expect(ladenAb('2026-10-01', { art: 'monat' })).toBe('2026-10-01')
    expect(ladenAb('2026-10-28', { art: '30t' })).toBe('2026-10-01')
    expect(ladenAb('2026-11-23', { art: 'kw' })).toBe('2026-11-01')
    expect(ladenAb('2026-11-01', { art: 'custom' })).toBe('2026-11-01')
  })
})

describe('auswerten', () => {
  it('„30 Tage“ über den Oktober: kein Vergleich für versendet (und die Quote daraus) – statt „vs. davor 17“', () => {
    // 28.10.–26.11. gegen 28.09.–27.10.
    const d = zahlen('30t')
    expect(d.werte).toMatchObject({ vernetzungen_versendet: 504, vernetzungen_angenommen: 122, angeschrieben: 113 })
    expect(d.vorwerte.vernetzungen_versendet).toBeNull()
    // Annahmen und Board-Zahlen stehen als Tageswerte da: der Vergleich bleibt
    expect(d.vorwerte).toMatchObject({ vernetzungen_angenommen: 117, angeschrieben: 90, gespraech: 3 })
    expect([...d.monatszaehler]).toEqual(['vernetzungen_versendet'])
    expect(d.sheet.size).toBe(0)
  })

  it('Tage vor dem Zeitraum (nur wegen der Monatszähler mitgeladen) zählen nirgends', () => {
    const d = zahlen('30t')
    expect(d.tage[0]!.tag).toBe('2026-10-28')
    expect(d.tage).toHaveLength(30)
    expect(d.tage.reduce((a, t) => a + t.werte.angeschrieben, 0)).toBe(113)
  })

  it('Woche im November gegen Woche im November: alles vergleichbar', () => {
    const d = zahlen('kw48')
    expect(d.werte.vernetzungen_versendet).toBe(200)
    expect(d.vorwerte.vernetzungen_versendet).toBe(0)
    expect(d.monatszaehler.size).toBe(0)
  })

  it('Woche, deren Vorwoche im Oktober liegt: kein Vergleich, auch wenn der Monatserste nicht in der Woche liegt', () => {
    // KW 45 (02.–08.11.) gegen KW 44 (26.10.–01.11.)
    const d = zahlen('kw45')
    expect(d.vorwerte.vernetzungen_versendet).toBeNull()
    expect(d.vorwerte.angeschrieben).toBe(5)
    expect(d.monatszaehler.size).toBe(0)
  })

  it('Monatsansicht: Monatszähler zählen auf beiden Seiten mit, der Vergleich bleibt', () => {
    const nov = zahlen('2026-11')
    expect(nov.werte.vernetzungen_versendet).toBe(500)
    expect(nov.vorwerte.vernetzungen_versendet).toBe(326) // 305 aus dem Monatszähler + 21 Tageswerte
    expect(nov.monatszaehler.size).toBe(0)
    const okt = zahlen('2026-10')
    expect(okt.werte.vernetzungen_versendet).toBe(326)
    expect(okt.vorwerte.vernetzungen_versendet).toBe(0)
    // die Wochentabelle des Oktobers kennt nur die 21 aus den Tageswerten
    expect([...okt.monatszaehler]).toEqual(['vernetzungen_versendet'])
    expect(okt.tage.reduce((a, t) => a + t.werte.vernetzungen_versendet, 0)).toBe(21)
  })
})

describe('auswerten für eine Person ohne eigenen Monatszähler', () => {
  // Die zweite Person: kein Monatszähler, „versendet“ erst ab Ende Oktober als Tageswert, Annahmen schon vorher
  const zweite = (tag: string, werte: Partial<Summen>): KpiZeile => ({ ...zeile(tag, werte), member_id: MEMBER_M })
  const EIGENE: KpiZeile[] = [
    zweite('2026-10-06', { vernetzungen_angenommen: 55, angeschrieben: 9 }),
    zweite('2026-10-26', { vernetzungen_versendet: 14, angeschrieben: 3 }),
    zweite('2026-11-10', { vernetzungen_versendet: 402, vernetzungen_angenommen: 86, angeschrieben: 20 }),
  ]
  /** Was die dritte Abfrage liefert: die Monatszähler aller Personen – hier nur die der ersten. */
  const ZAEHLER_ALLE = ZEILEN.filter((z) => z.period === 'monat')
  const eigene = (von: string, bis: string) => EIGENE.filter((z) => z.tag >= von && z.tag <= bis)
  function zahlen(z: string, zaehlerAlle: readonly KpiZeile[]) {
    const zr = zeitraum(z)
    return auswerten(
      eigene(ladenAb(zr.von, zr), zr.bis),
      eigene(ladenAb(zr.vorperiode.von, zr), zr.vorperiode.bis),
      zr,
      zaehlerAlle,
    )
  }

  it('„30 Tage“: kein Vergleich für versendet – statt „+388 vs. davor 14“', () => {
    const d = zahlen('30t', ZAEHLER_ALLE)
    expect(d.werte.vernetzungen_versendet).toBe(402)
    expect(d.vorwerte.vernetzungen_versendet).toBeNull()
    // Board-Zahlen und Annahmen (kein Monatszähler dafür) behalten ihn
    expect(d.vorwerte).toMatchObject({ vernetzungen_angenommen: 55, angeschrieben: 12 })
    // ohne die Monatszähler der anderen wäre die Lücke unsichtbar
    expect(zahlen('30t', []).vorwerte.vernetzungen_versendet).toBe(14)
  })

  it('Monatsansicht: der Vormonat mit fremdem Monatszähler ist kein Vergleich – ohne ihn schon', () => {
    const nov = zahlen('2026-11', ZAEHLER_ALLE)
    expect(nov.werte.vernetzungen_versendet).toBe(402)
    expect(nov.vorwerte.vernetzungen_versendet).toBeNull()
    expect(nov.vorwerte.angeschrieben).toBe(12)
    // Dezember gegen November: kein Monatszähler in Sicht
    expect(zahlen('2026-12', []).vorwerte.vernetzungen_versendet).toBe(402)
  })

  it('wer den Monatszähler selbst hat, behält in der Monatsansicht den Vergleich – auch mit den Zählern aller', () => {
    const zr = zeitraum('2026-11')
    const d = auswerten(geladen(zr.von, zr.bis), geladen(zr.vorperiode.von, zr.vorperiode.bis), zr, ZAEHLER_ALLE)
    expect(d.vorwerte.vernetzungen_versendet).toBe(326)
  })
})
