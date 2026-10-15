// BAUPLAN § 3.8 parser/csv.ts: papaparse, Delimiter-Erkennung (; , \t), BOM-tolerant, UTF-8/Latin-1 (§ 6.1), Kopfzeilen-Mapping (§ 6.2).
import Papa from 'papaparse'
import { zielFeldFuerKopf, type ZielFeld } from './kopfwort'

export type Tabelle = { kopf: string[]; zeilen: string[][]; delimiter: ',' | ';' | '\t' }

/** Häufigstes Trennzeichen der Kopfzeile (§ 6.3 CSV). */
export function erkenneDelimiter(kopfzeile: string): ',' | ';' | '\t' {
  const z = (c: string) => kopfzeile.split(c).length - 1
  const kandidaten: [',' | ';' | '\t', number][] = [
    [';', z(';')],
    [',', z(',')],
    ['\t', z('\t')],
  ]
  kandidaten.sort((a, b) => b[1] - a[1])
  const bester = kandidaten[0] as [',' | ';' | '\t', number]
  return bester[1] > 0 ? bester[0] : ';'
}

/** Byte-Puffer → Text: UTF-8 (strikt), bei ungültigen Bytes Latin-1/Windows-1252. BOM wird entfernt. */
export function dekodiere(puffer: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(puffer)
  } catch {
    text = new TextDecoder('windows-1252').decode(puffer)
  }
  return text.replace(/^﻿/, '')
}

/** CSV-Text → Kopf + Zeilen (leere Zeilen weg, Zellen getrimmt). */
export function parseCsv(text: string): Tabelle {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const erste = t.split('\n').find((z) => z.trim() !== '') ?? ''
  const delimiter = erkenneDelimiter(erste)
  const r = Papa.parse<string[]>(t, { delimiter, skipEmptyLines: 'greedy' })
  const zeilen = r.data.map((z) => z.map((c) => (c ?? '').trim()))
  const kopf = (zeilen.shift() ?? []).map((k) => k.replace(/^﻿/, ''))
  return { kopf, zeilen, delimiter }
}

export type Datensatz = Partial<Record<ZielFeld, string>> & { _zeile: number }

/** Kopfzeile → Zielfeld je Spalte (unerkannt = null). */
export function mappeKopf(kopf: readonly string[]): (ZielFeld | null)[] {
  const belegt = new Set<ZielFeld>()
  return kopf.map((k) => {
    const z = zielFeldFuerKopf(k)
    if (!z || belegt.has(z)) return null
    belegt.add(z)
    return z
  })
}

/** Tabelle + Mapping → Datensätze (Felder nur, wenn die Zelle nicht leer ist). `start` = Zeilennummer der ersten Datenzeile. */
export function tabelleZuDatensaetze(
  zeilen: readonly (readonly string[])[],
  mapping: readonly (ZielFeld | null)[],
  start = 2,
): Datensatz[] {
  const out: Datensatz[] = []
  zeilen.forEach((z, i) => {
    const d: Datensatz = { _zeile: start + i }
    let leer = true
    mapping.forEach((feld, j) => {
      if (!feld) return
      const v = (z[j] ?? '').trim()
      if (v === '') return
      d[feld] = v
      leer = false
    })
    if (!leer) out.push(d)
  })
  return out
}
