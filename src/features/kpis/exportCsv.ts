// BAUPLAN § 3.6 `exportCsv.ts` / K-12: Funnel-Zeilen + Tageswerte des gewählten Zeitraums → eine CSV (lib/csv: `;`, BOM, CRLF).
import { csvText, download, type CsvSpalte } from '@/lib/csv'
import { fmtAnteil } from '@/lib/format'
import { TAGES_METRIKEN, type FunnelZeile, type TagesWert } from './kennzahlen'

export type KpiExport = {
  person: string
  kanal: string
  zeitraumLabel: string
  von: string
  bis: string
  vorLabel: string
  zeilen: readonly FunnelZeile[]
  tage: readonly TagesWert[]
}

const pp = (n: number | null) => (n === null ? '' : `${Math.round(n * 10) / 10}`.replace('.', ','))
const prozent = (q: number | null | undefined) => (q === undefined || q === null ? '' : fmtAnteil(q))

const FUNNEL_SPALTEN: CsvSpalte<FunnelZeile>[] = [
  { key: 'nr', label: 'Nr.' },
  { key: 'label', label: 'Kennzahl' },
  { key: 'wert', label: 'Wert' },
  { key: 'quote', label: 'Konversion', wert: (z) => prozent(z.quote) },
  { key: 'vorWert', label: 'Vorperiode' },
  { key: 'vorQuote', label: 'Konversion Vorperiode', wert: (z) => prozent(z.vorQuote) },
  { key: 'delta', label: 'Delta' },
  { key: 'deltaPp', label: 'Delta pp', wert: (z) => pp(z.deltaPp) },
  { key: 'ziel', label: 'Ziel', wert: (z) => prozent(z.ziel) },
  { key: 'erreicht', label: 'Ziel erreicht', wert: (z) => (z.erreicht === null ? '' : z.erreicht) },
  {
    key: 'fussnote',
    label: 'Quelle',
    wert: (z) => (z.fussnote === 'sheet' ? 'aus Sheet' : z.fussnote === 'zaehler' ? 'Zähler, teilweise manuell' : ''),
  },
]

const TAGE_SPALTEN: CsvSpalte<TagesWert>[] = [
  { key: 'tag', label: 'Tag' },
  ...TAGES_METRIKEN.map((m): CsvSpalte<TagesWert> => ({ key: m.key, label: m.label, wert: (t) => t.werte[m.key] })),
]

/** CSV-Text (ohne BOM): Kopfzeile mit Person/Kanal/Zeitraum, Block Funnel, Leerzeile, Block Tageswerte. */
export function kpisCsvText(e: KpiExport): string {
  const kopf = csvText(
    [{ person: e.person, kanal: e.kanal, zeitraum: e.zeitraumLabel, von: e.von, bis: e.bis, vorperiode: e.vorLabel }],
    [
      { key: 'person', label: 'Person' },
      { key: 'kanal', label: 'Kanal' },
      { key: 'zeitraum', label: 'Zeitraum' },
      { key: 'von', label: 'Von' },
      { key: 'bis', label: 'Bis' },
      { key: 'vorperiode', label: 'Vorperiode' },
    ],
  )
  return `${kopf}\r\n${csvText(e.zeilen, FUNNEL_SPALTEN)}\r\n${csvText(e.tage, TAGE_SPALTEN)}`
}

export function kpisDateiname(e: Pick<KpiExport, 'person' | 'von' | 'bis'>): string {
  const p = e.person.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `crm-kpis-${p}-${e.von}_${e.bis}.csv`
}

export function exportiereKpis(e: KpiExport): void {
  download(new Blob(['﻿' + kpisCsvText(e)], { type: 'text/csv;charset=utf-8' }), kpisDateiname(e))
}
