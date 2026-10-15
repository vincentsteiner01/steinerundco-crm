// BAUPLAN § 3.1.9 `csv.ts` / LE-14 – CSV-Export: UTF-8 mit BOM, `;`-getrennt (Excel DE), Datum `DD.MM.YYYY`,
// Zeitstempel `DD.MM.YYYY, HH:MM`, Dezimalkomma, CRLF. `download` hängt einen Link an und klickt ihn.
import { fmtDatum, fmtDatumZeit } from './format'
import { istTag } from './zeit'

export type CsvSpalte<R> = {
  /** Feld der Zeile (wird gelesen, wenn `wert` fehlt). */
  key: keyof R | string
  /** Kopfzeile. */
  label: string
  /** Eigener Wert je Zeile (z. B. Stufen-Label statt Enum). */
  wert?: (row: R) => unknown
}

const BOM = '﻿'
const ISO_ZEIT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Zellwert → Text (Datum/Zeit nach ux § 6.4, Booleans als ja/nein, Arrays mit `, `). */
export function csvZelle(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return fmtDatumZeit(v)
  if (typeof v === 'boolean') return v ? 'ja' : 'nein'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
  if (Array.isArray(v)) return v.map(csvZelle).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  if (istTag(s)) return fmtDatum(s)
  if (ISO_ZEIT_RE.test(s) && !Number.isNaN(Date.parse(s))) return fmtDatumZeit(s)
  return s
}

function maskieren(s: string): string {
  // Formel-Injektion in Tabellenkalkulationen entschärfen (=, +, -, @ am Anfang)
  const sicher = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[";\r\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher
}

/** CSV-Text (ohne BOM) – für Tests und Vorschau. */
export function csvText<R extends object>(rows: readonly R[], spalten: readonly CsvSpalte<R>[]): string {
  const kopf = spalten.map((s) => maskieren(s.label)).join(';')
  const zeilen = rows.map((row) =>
    spalten
      .map((s) => {
        const v = s.wert ? s.wert(row) : (row as Record<string, unknown>)[s.key as string]
        return maskieren(csvZelle(v))
      })
      .join(';'),
  )
  return [kopf, ...zeilen].join('\r\n') + '\r\n'
}

/** LE-14 – Blob `text/csv;charset=utf-8` mit BOM. */
export function csvExport<R extends object>(rows: readonly R[], spalten: readonly CsvSpalte<R>[]): Blob {
  return new Blob([BOM + csvText(rows, spalten)], { type: 'text/csv;charset=utf-8' })
}

/** Browser-Download eines Blobs unter `name` (z. B. `crm-leads-2026-10-14.csv`). */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** JSON-Datei herunterladen (Voll-Backup, Auskunft je Lead). */
export function downloadJson(daten: unknown, name: string): void {
  download(new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' }), name)
}
