// Labelscan mit synthetischem Tab: 288/55/…, Tageswerte, Sa/So vorhanden, MONAT GESAMT ignoriert (BAUPLAN § 3.8, E30).
import { describe, expect, it } from 'vitest'
import type { Tab, Zelle } from '../parser/xlsx'
import { kpiMonatAusTab, kpiMonatDokument, monatAusTab, personAusTitel, tagesSumme } from './kpiMonat'

const d = (tag: number) => new Date(2026, 8, tag)
const z = (...c: Zelle[]): Zelle[] => c

const TAB: Tab = {
  name: 'KPIs - SEPTEMBER 2026',
  zeilen: [
    z(null, 'LINKEDIN VERTRIEBS-KPI DASHBOARD - Vincent Steiner'),
    z(null, 'Monat', d(1)),
    z(null, 'CONNECTIONS', null, null, null, null, 'Tag', 'Gespräche eröffnet'),
    z(null, 'Kennzahl', 'Wert', 'Conversion', null, null, 'Woche 1', 10),
    z(null, 'Vernetzung versendet', 288, null, null, null, d(1), 3),
    z(null, 'Angenommene Vernetzungen', 55, 0.19, null, null, d(2), 4),
    z(null, 'Ausstehend', 233, null, null, null, d(5), 0),
    z(null, 'OUTREACH', null, null, null, null, d(6), 3),
    z(null, 'Gespräch eröffnet', 51, null, null, null, 'Woche 2', 5),
    z(null, 'DM beantwortet', 10, 0.196, null, null, d(7), 5),
    z(null, 'Erstgespräch gepitcht', 1, 0.1),
    z(null, 'Erstgespräche', 1, 1),
    z(null, 'Strategiegespräche', null, null),
    z(null, 'Kunden gewonnen', null, null),
    z(null, 'SALES-CALLS', null, null, null, null, 'MONAT GESAMT', 164),
    z(null, 'Erstgespräche', 1, null),
    z(null, 'NO-SHOWS / CANCELLATION'),
    z(null, 'Erstgespräch – No-Show', 0),
    z(null, 'Erstgespräch – abgesagt', 2),
    z(null, 'Strategiegespräch – No-Show', null),
    z(null, 'Strategiegespräch – abgesagt', null),
  ],
}

describe('presets/kpiMonat', () => {
  it('Monat aus dem Tab-Namen, Person aus dem Titel', () => {
    expect(monatAusTab('KPIs - SEPTEMBER 2026')).toBe('2026-09')
    expect(monatAusTab('KPIs – Oktober 2026')).toBe('2026-10')
    expect(monatAusTab('KPIs - MÄRZ 2027')).toBe('2027-03')
    expect(monatAusTab('Anleitung')).toBeNull()
    expect(personAusTitel('LINKEDIN VERTRIEBS-KPI DASHBOARD - Vincent Steiner')).toBe('Vincent Steiner')
    expect(personAusTitel('Dashboard')).toBeNull()
  })

  it('Labelscan: Sektionen, Werte rechts vom Label, Zellbezug', () => {
    const m = kpiMonatAusTab(TAB, null)
    expect(m).not.toBeNull()
    if (!m) return
    expect(m.month).toBe('2026-09')
    expect(m.person).toBe('Vincent Steiner')
    expect(m.sections.map((s) => s.key)).toEqual(['connections', 'outreach', 'sales_calls', 'no_shows_cancellation'])
    const conn = m.sections[0]?.metrics
    expect(conn).toEqual([
      { key: 'vernetzung_versendet', label: 'Vernetzung versendet', value: 288, cell: 'C5' },
      { key: 'angenommene_vernetzungen', label: 'Angenommene Vernetzungen', value: 55, cell: 'C6' },
      { key: 'ausstehend', label: 'Ausstehend', value: 233, cell: 'C7' },
    ])
    const outreach = Object.fromEntries((m.sections[1]?.metrics ?? []).map((x) => [x.key, x.value]))
    expect(outreach).toEqual({
      gespraech_eroeffnet: 51,
      dm_beantwortet: 10,
      erstgespraech_gepitcht: 1,
      erstgespraeche: 1,
      strategiegespraeche: null,
      kunden_gewonnen: null,
    })
    expect(m.sections[2]?.metrics).toEqual([{ key: 'erstgespraeche', label: 'Erstgespräche', value: 1, cell: 'C16' }])
    const ns = Object.fromEntries((m.sections[3]?.metrics ?? []).map((x) => [x.key, x.value]))
    expect(ns).toEqual({
      erstgespraech_no_show: 0,
      erstgespraech_abgesagt: 2,
      strategiegespraech_no_show: null,
      strategiegespraech_abgesagt: null,
    })
  })

  it('Tageswerte: Datumszelle + Zahl derselben Zeile, Sa/So vorhanden, Wochen- und Monatssummen ignoriert', () => {
    const m = kpiMonatAusTab(TAB, 'Vincent')
    if (!m) throw new Error('kein Monat')
    expect(m.person).toBe('Vincent')
    expect(m.daily).toEqual([
      { date: '2026-09-01', gespraeche_eroeffnet: 3, row: 5 },
      { date: '2026-09-02', gespraeche_eroeffnet: 4, row: 6 },
      { date: '2026-09-05', gespraeche_eroeffnet: 0, row: 7 },
      { date: '2026-09-06', gespraeche_eroeffnet: 3, row: 8 },
      { date: '2026-09-07', gespraeche_eroeffnet: 5, row: 10 },
    ])
    expect(tagesSumme(m)).toBe(15)
  })

  it('Dokument: nur KPI-Tabs, andere übersprungen', () => {
    const doc = kpiMonatDokument([TAB, { name: 'Anleitung', zeilen: [] }], null)
    expect(doc.months).toHaveLength(1)
    expect(doc.uebersprungen).toEqual(['Anleitung'])
    expect(doc.doc).toMatchObject({ months: [{ month: '2026-09', tab: 'KPIs - SEPTEMBER 2026' }] })
  })
})
