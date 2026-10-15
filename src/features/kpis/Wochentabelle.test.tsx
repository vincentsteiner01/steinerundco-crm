// Wochentabelle: Okt 2026 aus Fixture (01.10. 28 · 02.10. 9 · 03.10. 28 · 12.10. 17) → KW 40–44 = 65 / 0 / 17 / 0 / 0, Gesamt 82;
// KW-Grenzen Mo–So; aktuelle Woche markiert; Zukunftswochen „—“.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MEMBER_V } from '@/test/fixtures/leads'
import { TAGES_METRIKEN, tageswerte } from './kennzahlen'
import { DAILY } from './_testHilfe'
import { Wochentabelle } from './Wochentabelle'

const METRIKEN = TAGES_METRIKEN.filter((m) => m.kanal === 'linkedin')

describe('Wochentabelle', () => {
  it('Oktober 2026: KW 40 65 · KW 41 0 · KW 42 17 · KW 43 0 · KW 44 0 · Monat gesamt 82 (K-01)', () => {
    const tage = tageswerte(DAILY.filter((d) => d.member_id === MEMBER_V) as never, '2026-10-01', '2026-10-31')
    render(
      <Wochentabelle
        tage={tage}
        heute="2026-10-14"
        metriken={METRIKEN}
        aktiv="gespraeche_eroeffnet"
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
      ['KW 40', '28.09.–04.10.', '65'],
      ['KW 41', '05.10.–11.10.', '0'],
      ['KW 42', '12.10.–18.10.', '17'],
      ['KW 43', '19.10.–25.10.', '—'],
      ['KW 44', '26.10.–01.11.', '—'],
    ])
    const gesamt = zeilen[5]!
    expect(gesamt).toHaveTextContent('Monat gesamt')
    expect(within(gesamt).getAllByRole('cell')[1]).toHaveTextContent('82')
    expect(zeilen[2]).toHaveAttribute('data-aktuell', 'true')
    expect(zeilen[0]).not.toHaveAttribute('data-aktuell')
    expect(
      within(tabelle)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Woche', 'Zeitraum', 'Eröffnet', 'Anfragen', 'Antworten'])
  })

  it('zeigt die Metriken des Kanals als Spalten (Telefon: Dials · Connects)', () => {
    const tage = tageswerte(DAILY as never, '2026-10-05', '2026-10-11')
    render(
      <Wochentabelle
        tage={tage}
        heute="2026-10-14"
        metriken={TAGES_METRIKEN.filter((m) => m.kanal === 'telefon')}
        aktiv="anrufe"
      />,
    )
    const tabelle = screen.getByRole('table', { name: 'Wochentabelle' })
    expect(
      within(tabelle)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Woche', 'Zeitraum', 'Dials', 'Connects'])
    const zeilen = within(tabelle).getAllByRole('row').slice(1)
    expect(zeilen).toHaveLength(2)
    expect(within(zeilen[0]!).getAllByRole('cell')[2]).toHaveTextContent('12')
    expect(within(zeilen[1]!).getAllByRole('cell')[1]).toHaveTextContent('12')
  })
})
