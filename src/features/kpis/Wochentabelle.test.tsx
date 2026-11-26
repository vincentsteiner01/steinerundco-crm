// Wochentabelle: Oktober 2026 aus eigenen Zeilen (01.10. 28 · 02.10. 9 · 03.10. 28 · 12.10. 17 angeschrieben) → KW 40–44 =
// 65 / 0 / 17 / — / —, Gesamt 82; „Zeitraum“ nennt die gezählten Tage (am Rand weniger als Mo–So); laufende Woche markiert;
// alte Monatszähler zählen nie; leere Spalten fallen weg; unter 900 px steht der Zeitraum unter der Woche.
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { leereSummen, TAGES_METRIKEN, tageswerte, type KpiZeile, type Summen } from './kennzahlen'
import { Wochentabelle } from './Wochentabelle'

const zeile = (
  member_id: string,
  tag: string,
  werte: Partial<Summen>,
  period: KpiZeile['period'] = 'tag',
): KpiZeile => ({ member_id, tag, period, ...leereSummen(), ...werte })

/** Zeilen wie aus v_kpi_tage: Karla Kennzahl (MEMBER_V) und Bodo Beispiel (MEMBER_M), dazu ein alter Monatszähler. */
const ZEILEN: KpiZeile[] = [
  zeile(MEMBER_V, '2026-10-01', { vernetzungen_versendet: 305, vernetzungen_angenommen: 93 }, 'monat'),
  zeile(MEMBER_V, '2026-10-01', { angeschrieben: 28, vernetzungen_versendet: 40 }),
  zeile(MEMBER_V, '2026-10-02', { angeschrieben: 9 }),
  zeile(MEMBER_V, '2026-10-03', { angeschrieben: 28 }),
  zeile(MEMBER_V, '2026-10-12', { angeschrieben: 17, gespraech: 3 }),
  zeile(MEMBER_M, '2026-10-06', { angeschrieben: 4, emails_gesendet: 12 }),
]
const VON_KARLA = ZEILEN.filter((z) => z.member_id === MEMBER_V)

const koepfe = (tabelle: HTMLElement) =>
  within(tabelle)
    .getAllByRole('columnheader')
    .map((h) => h.textContent)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Wochentabelle', () => {
  it('Oktober 2026: KW 40 65 · KW 41 0 · KW 42 17 · KW 43 — · KW 44 — · Monat gesamt 82', () => {
    const tage = tageswerte(VON_KARLA, '2026-10-01', '2026-10-31')
    render(
      <Wochentabelle
        tage={tage}
        heute="2026-10-14"
        metriken={TAGES_METRIKEN}
        aktiv="angeschrieben"
        gesamtLabel="Monat gesamt"
      />,
    )
    const tabelle = screen.getByRole('table', { name: 'Wochentabelle' })
    const zeilen = within(tabelle).getAllByRole('row').slice(1)
    expect(zeilen).toHaveLength(6)
    const werte = zeilen.slice(0, 5).map((z) => {
      const zellen = within(z).getAllByRole('cell')
      return [zellen[0]!.textContent, zellen[1]!.textContent, zellen[2]!.textContent]
    })
    expect(werte).toEqual([
      // KW 40 und KW 44 schneiden den Oktober nur an: genannt sind die Tage, die zählen
      ['KW 40', '01.10.–04.10.', '65'],
      ['KW 41', '05.10.–11.10.', '0'],
      ['KW 42', '12.10.–18.10.', '17'],
      ['KW 43', '19.10.–25.10.', '—'],
      ['KW 44', '26.10.–31.10.', '—'],
    ])
    const gesamt = within(zeilen[5]!).getAllByRole('cell')
    expect(zeilen[5]).toHaveTextContent('Monat gesamt')
    expect(gesamt[1]).toHaveTextContent('82')
    // Vernetzungen: nur die 40 aus dem Tageszähler – die 305 des alten Monatszählers zählen in der Wochentabelle nie
    expect(gesamt[2]).toHaveTextContent('40')
    expect(zeilen[2]).toHaveAttribute('data-aktuell', 'true')
    expect(zeilen[0]).not.toHaveAttribute('data-aktuell')
    expect(koepfe(tabelle)).toEqual([
      'Woche',
      'Zeitraum',
      'Angeschrieben',
      'Vernetzungen',
      'Angenommen',
      'Gespräche',
      'Im Geschäft',
      'Verloren',
      'E-Mails',
    ])
  })

  it('zeigt genau die übergebenen Kennzahlen als Spalten und summiert das Team', () => {
    const tage = tageswerte(ZEILEN, '2026-10-05', '2026-10-11')
    render(
      <Wochentabelle
        tage={tage}
        heute="2026-10-14"
        metriken={TAGES_METRIKEN.filter((m) => m.key === 'angeschrieben' || m.key === 'emails_gesendet')}
        aktiv="emails_gesendet"
      />,
    )
    const tabelle = screen.getByRole('table', { name: 'Wochentabelle' })
    expect(koepfe(tabelle)).toEqual(['Woche', 'Zeitraum', 'Angeschrieben', 'E-Mails'])
    const zeilen = within(tabelle).getAllByRole('row').slice(1)
    expect(zeilen).toHaveLength(2)
    expect(within(zeilen[0]!).getAllByRole('cell')[2]).toHaveTextContent('4')
    expect(within(zeilen[0]!).getAllByRole('cell')[3]).toHaveTextContent('12')
    expect(zeilen[1]).toHaveTextContent('Gesamt')
    expect(within(zeilen[1]!).getAllByRole('cell')[2]).toHaveTextContent('12')
  })

  it('leere Spalten fallen auf Wunsch weg, die aktive bleibt', () => {
    const tage = tageswerte(VON_KARLA, '2026-10-01', '2026-10-31')
    render(<Wochentabelle tage={tage} heute="2026-10-14" metriken={TAGES_METRIKEN} aktiv="verloren" leereAusblenden />)
    expect(koepfe(screen.getByRole('table', { name: 'Wochentabelle' }))).toEqual([
      'Woche',
      'Zeitraum',
      'Angeschrieben',
      'Vernetzungen',
      'Gespräche',
      'Verloren', // aktiv, auch wenn leer
    ])
  })

  it('angeschnittene Wochen: ein einzelner Tag steht als Tag da, nie die ganze Woche', () => {
    // November 2026: der 01.11. ist ein Sonntag (KW 44), der 30.11. ein Montag (KW 49)
    const tage = tageswerte([zeile(MEMBER_V, '2026-11-01', { angeschrieben: 2 })], '2026-11-01', '2026-11-30')
    render(<Wochentabelle tage={tage} heute="2026-11-26" metriken={TAGES_METRIKEN} aktiv="angeschrieben" />)
    const zeitraeume = Array.from(document.querySelectorAll('[data-zeitraum]')).map((z) => z.textContent)
    expect(zeitraeume).toEqual(['01.11.', '02.11.–08.11.', '09.11.–15.11.', '16.11.–22.11.', '23.11.–29.11.', '30.11.'])
    // dieselbe Woche in „7 Tage“ (20.–26.11.): KW 47 zählt nur Freitag bis Sonntag
    const sieben = tageswerte([], '2026-11-20', '2026-11-26')
    const { container } = render(
      <Wochentabelle tage={sieben} heute="2026-11-26" metriken={TAGES_METRIKEN} aktiv="angeschrieben" />,
    )
    expect(Array.from(container.querySelectorAll('[data-zeitraum]')).map((z) => z.textContent)).toEqual([
      '20.11.–22.11.',
      '23.11.–26.11.',
    ])
  })

  it('unter 900 px: keine Spalte „Zeitraum“ – er steht unter der Woche, die erste Spalte bleibt beim Wischen stehen', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((abfrage: string) => ({
        matches: abfrage.includes('max-width: 899px'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const tage = tageswerte(VON_KARLA, '2026-10-01', '2026-10-31')
    render(
      <Wochentabelle tage={tage} heute="2026-10-14" metriken={TAGES_METRIKEN} aktiv="angeschrieben" leereAusblenden />,
    )
    const tabelle = screen.getByRole('table', { name: 'Wochentabelle' })
    expect(koepfe(tabelle)).toEqual(['Woche', 'Angeschrieben', 'Vernetzungen', 'Gespräche'])
    const zeilen = within(tabelle).getAllByRole('row').slice(1)
    const erste = within(zeilen[0]!).getAllByRole('cell')
    expect(erste[0]).toHaveTextContent('KW 4001.10.–04.10.')
    expect(erste[0]).toHaveClass('sticky', 'left-0')
    expect(erste[1]).toHaveTextContent('65')
    // Summenzeile: gleich viele Zellen wie die Wochen
    expect(within(zeilen[5]!).getAllByRole('cell')).toHaveLength(erste.length)
  })

  it('scrollt bei Platzmangel in sich (Telefon) und kommt ohne Hinweistext aus', () => {
    const tage = tageswerte(VON_KARLA, '2026-10-01', '2026-10-31')
    const { container } = render(
      <Wochentabelle tage={tage} heute="2026-10-14" metriken={TAGES_METRIKEN} aktiv="angeschrieben" />,
    )
    const tabelle = screen.getByRole('table', { name: 'Wochentabelle' })
    expect(tabelle.parentElement).toHaveClass('overflow-x-auto')
    expect(container.querySelector('section')).toHaveClass('min-w-0')
    expect(screen.getByRole('heading', { name: 'Wochen' }).parentElement?.textContent).toBe('Wochen')
  })
})
