// BAUPLAN § 3.8 presets/kpiMonat.ts · § 6.2 „KPI-Monat“: je Tab „KPIs - <MONAT> <JAHR>“ Labelscan über alle Zellen →
// sections[] + daily[] (Datumszelle + Zahl in derselben Zeile) → { months: [...] } → rpc.importSheetKpis. „MONAT GESAMT“ wird ignoriert (E30).
import type { Json } from '@/types/database'
import { snake } from '../parser/kopfwort'
import { dateZuIso, serialZuIso, type Tab, type Zelle } from '../parser/xlsx'

const MONATE: Record<string, string> = {
  januar: '01',
  februar: '02',
  maerz: '03',
  april: '04',
  mai: '05',
  juni: '06',
  juli: '07',
  august: '08',
  september: '09',
  oktober: '10',
  november: '11',
  dezember: '12',
}

export type KpiMetrik = { key: string; label: string; value: number | null; cell: string }
export type KpiSektion = { key: string; metrics: KpiMetrik[] }
export type KpiTag = { date: string; gespraeche_eroeffnet: number; row: number }
export type KpiMonat = {
  person: string
  month: string
  tab: string
  title: string | null
  sections: KpiSektion[]
  daily: KpiTag[]
}

/** Sektionen und ihre Metrik-Keys (§ 6.2); `sales_calls` wird erzeugt, von der DB übersprungen. */
const SEKTIONEN: { re: RegExp; key: string; metriken: readonly string[] }[] = [
  {
    re: /^connections/i,
    key: 'connections',
    metriken: ['vernetzung_versendet', 'angenommene_vernetzungen', 'ausstehend'],
  },
  {
    re: /^outreach/i,
    key: 'outreach',
    metriken: [
      'gespraech_eroeffnet',
      'dm_beantwortet',
      'erstgespraech_gepitcht',
      'erstgespraeche',
      'strategiegespraeche',
      'kunden_gewonnen',
    ],
  },
  { re: /^sales/i, key: 'sales_calls', metriken: ['erstgespraeche', 'strategiegespraeche', 'kunden_gewonnen'] },
  {
    re: /^no-?\s?shows/i,
    key: 'no_shows_cancellation',
    metriken: [
      'erstgespraech_no_show',
      'erstgespraech_abgesagt',
      'strategiegespraech_no_show',
      'strategiegespraech_abgesagt',
    ],
  },
]

/** Tab-Name „KPIs - SEPTEMBER 2026“ → „2026-09“ oder null. */
export function monatAusTab(name: string): string | null {
  const m = /^kpis?\s*[-–—]\s*([a-zäöü]+)\s+(\d{4})/i.exec(name.trim())
  if (!m) return null
  const monat = MONATE[snake(m[1] ?? '')]
  return monat ? `${m[2]}-${monat}` : null
}

/** Titel „LINKEDIN VERTRIEBS-KPI DASHBOARD - Vincent Steiner“ → „Vincent Steiner“. */
export function personAusTitel(titel: string | null): string | null {
  if (!titel || !/ [-–] /.test(titel)) return null
  return (
    titel
      .split(/ [-–] /)
      .pop()
      ?.trim() || null
  )
}

function spaltenBuchstabe(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function ersteZahlRechts(zeile: readonly Zelle[], ab: number): { wert: number; spalte: number } | null {
  for (let j = ab + 1; j < zeile.length; j++) {
    const v = zeile[j]
    if (typeof v === 'number' && Number.isFinite(v)) return { wert: v, spalte: j }
    if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()))
      return { wert: Number(v.replace(',', '.')), spalte: j }
  }
  return null
}

function datumAusZelle(v: Zelle): string | null {
  if (v instanceof Date) return dateZuIso(v)
  if (typeof v === 'number' && v > 40000 && v < 80000) return serialZuIso(v)
  return null
}

export function kpiMonatAusTab(tab: Tab, personWahl: string | null): KpiMonat | null {
  const month = monatAusTab(tab.name)
  if (!month) return null
  let title: string | null = null
  for (const zeile of tab.zeilen.slice(0, 5)) {
    const t = zeile.find((c): c is string => typeof c === 'string' && /kpi/i.test(c) && / [-–] /.test(c))
    if (t) {
      title = t
      break
    }
  }
  const person = personWahl ?? personAusTitel(title) ?? 'Vincent'
  const sections: KpiSektion[] = []
  const daily: KpiTag[] = []
  let aktuell: KpiSektion | null = null
  let aktuelleMetriken: readonly string[] = []

  tab.zeilen.forEach((zeile, r) => {
    zeile.forEach((zelle, j) => {
      if (typeof zelle === 'string') {
        const text = zelle.trim()
        if (/^monat gesamt/i.test(text)) return
        const sek = SEKTIONEN.find((s) => s.re.test(text))
        if (sek && text === text.toUpperCase()) {
          aktuell = { key: sek.key, metrics: [] }
          aktuelleMetriken = sek.metriken
          sections.push(aktuell)
          return
        }
        const key = snake(text)
        if (aktuell && aktuelleMetriken.includes(key) && !aktuell.metrics.some((m) => m.key === key)) {
          const z = ersteZahlRechts(zeile, j)
          aktuell.metrics.push({
            key,
            label: text,
            value: z ? z.wert : null,
            cell: `${spaltenBuchstabe(z ? z.spalte : j + 1)}${r + 1}`,
          })
        }
        return
      }
      const datum = datumAusZelle(zelle)
      if (datum && datum.startsWith(month)) {
        const z = ersteZahlRechts(zeile, j)
        if (z && !daily.some((d) => d.date === datum))
          daily.push({ date: datum, gespraeche_eroeffnet: z.wert, row: r + 1 })
      }
    })
  })
  return { person, month, tab: tab.name, title, sections, daily }
}

export type KpiDokument = { doc: Json; months: KpiMonat[]; uebersprungen: string[] }

/** Alle KPI-Tabs → Dokument für import_sheet_kpis. `person` = short_name der gewählten Person (Standard Vincent). */
export function kpiMonatDokument(tabs: readonly Tab[], person: string | null): KpiDokument {
  const months: KpiMonat[] = []
  const uebersprungen: string[] = []
  for (const t of tabs) {
    const m = kpiMonatAusTab(t, person)
    if (m) months.push(m)
    else uebersprungen.push(t.name)
  }
  return { doc: { months } as unknown as Json, months, uebersprungen }
}

/** Monatssumme aus Tageswerten (E30). */
export function tagesSumme(m: KpiMonat): number {
  return m.daily.reduce((s, d) => s + (d.gespraeche_eroeffnet ?? 0), 0)
}
