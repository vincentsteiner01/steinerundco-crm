// BAUPLAN § 3.8 presets/leitfaeden.ts · § 6.2 „DM-Leitfäden“: Tabs 1–4 (Präfix = legacy_phase), Spalten Leitfaden · Wann verwenden? ·
// Nachricht · Notizen → rows [{ legacy_phase, legacy_order, name, when_to_use, body, notes }] → rpc.importTemplates. Leere body → DB setzt active = false.
import type { Json } from '@/types/database'
import { translit } from '../parser/kopfwort'
import { zelleZuText, type Tab, type Zelle } from '../parser/xlsx'

export type LeitfadenZeile = {
  legacy_phase: number
  legacy_order: number
  name: string
  when_to_use: string | null
  body: string
  notes: string | null
}

export type LeitfaedenTab = { tab: string; phase: number; zeilen: LeitfadenZeile[]; kopfErkannt: boolean }
export type LeitfaedenDokument = {
  rows: LeitfadenZeile[]
  tabs: LeitfaedenTab[]
  uebersprungen: string[]
  ohneText: number
}

function kopfSpalten(zeile: readonly Zelle[]): { name: number; wann: number; text: number; notizen: number } | null {
  const idx = { name: -1, wann: -1, text: -1, notizen: -1 }
  zeile.forEach((z, j) => {
    const t = translit(zelleZuText(z) ?? '')
    if (t === '') return
    if (idx.name < 0 && /leitfaden|^name$|titel/.test(t)) idx.name = j
    else if (idx.wann < 0 && /wann|einsatz|verwenden/.test(t)) idx.wann = j
    else if (idx.text < 0 && /nachricht|text|message|copy/.test(t)) idx.text = j
    else if (idx.notizen < 0 && /notiz|tests?|bemerk/.test(t)) idx.notizen = j
  })
  return idx.name >= 0 && idx.text >= 0 ? idx : null
}

/** Tab „1 Gesprächseröffnung“ → 1; „Übersicht“ → null (§ 1.5 Nr. 41: Übersicht bleibt statisch). */
export function phaseAusTab(name: string): number | null {
  const m = /^\s*([1-4])\b/.exec(name)
  return m ? Number(m[1]) : null
}

export function leitfaedenDokument(tabs: readonly Tab[]): LeitfaedenDokument {
  const out: LeitfaedenTab[] = []
  const uebersprungen: string[] = []
  let ohneText = 0
  for (const t of tabs) {
    const phase = phaseAusTab(t.name)
    if (!phase) {
      uebersprungen.push(t.name)
      continue
    }
    let kopf: ReturnType<typeof kopfSpalten> = null
    let start = 0
    for (let i = 0; i < Math.min(12, t.zeilen.length); i++) {
      kopf = kopfSpalten(t.zeilen[i] ?? [])
      if (kopf) {
        start = i + 1
        break
      }
    }
    const zeilen: LeitfadenZeile[] = []
    if (kopf) {
      let order = 0
      for (const z of t.zeilen.slice(start)) {
        const name = zelleZuText(z[kopf.name] ?? null)
        if (!name) continue
        order += 1
        const body = (zelleZuText(z[kopf.text] ?? null) ?? '').replace(/\r\n?/g, '\n')
        if (body === '') ohneText += 1
        zeilen.push({
          legacy_phase: phase,
          legacy_order: order,
          name,
          when_to_use: kopf.wann >= 0 ? zelleZuText(z[kopf.wann] ?? null) : null,
          body,
          notes: kopf.notizen >= 0 ? zelleZuText(z[kopf.notizen] ?? null) : null,
        })
      }
    }
    out.push({ tab: t.name, phase, zeilen, kopfErkannt: !!kopf })
  }
  const rows = out.flatMap((t) => t.zeilen)
  return { rows, tabs: out, uebersprungen, ohneText }
}

export function leitfaedenRowsJson(rows: readonly LeitfadenZeile[]): Json {
  return rows as unknown as Json
}
