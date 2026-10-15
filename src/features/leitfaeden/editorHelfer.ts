// Reine Helfer für Editor und Vorschau (getrennt von den Komponenten, damit Fast Refresh sauber bleibt).
import { PLATZHALTER, platzhalterWert, type PlatzhalterKontext, type PlatzhalterLead } from '@/lib/platzhalter'

/** Platzhalter, deren Name mit dem Filter beginnt (zuerst) oder ihn enthält (ohne Groß/Klein). */
export function platzhalterTreffer(filter: string): string[] {
  const f = filter.trim().toLowerCase()
  const alle = PLATZHALTER.map((p) => p.name)
  if (!f) return alle
  const vorn = alle.filter((n) => n.toLowerCase().startsWith(f))
  const drin = alle.filter((n) => !n.toLowerCase().startsWith(f) && n.toLowerCase().includes(f))
  return [...vorn, ...drin]
}

/** Fügt `[Name]` an Stelle von `[` + Filter (start … caret) ein; liefert neuen Text und Caret-Position. */
export function platzhalterEinfuegen(
  text: string,
  start: number,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const token = `[${name}]`
  const neu = text.slice(0, start) + token + text.slice(caret)
  return { text: neu, caret: start + token.length }
}

const QUELLE_LABEL = {
  lead: 'aus dem Lead',
  anrede: 'Herr / Frau',
  manuell: 'manuell',
  termin: 'manuell',
  meeting: 'letztes Gespräch',
  absender: 'von dir',
  anlass: 'Anrufgrund',
} as const

/** Kurzer Hinweis, woher ein Platzhalter seinen Wert bekommt. */
export function quelleLabel(name: string): string {
  const def = PLATZHALTER.find((p) => p.name === name)
  return def ? QUELLE_LABEL[def.quelle] : ''
}

/** Platzhalter, die immer manuell gefüllt werden (Felder in der Vorschau). */
export function istManuell(name: string): boolean {
  const def = PLATZHALTER.find((p) => p.name === name)
  return def?.quelle === 'manuell' || def?.quelle === 'termin'
}

/** Grund, warum Kopieren gesperrt ist („Erst [Reaktion] eintragen“, § 3.1.9a), oder null. */
export function kopierGrund(offen: readonly string[]): string | null {
  return offen.length ? `Erst [${offen[0]}] eintragen` : null
}

const TOKEN_RE = /\[([^[\]\n]{1,40})\]/g
const LITERAL_ANREDE_RE = /\b(Herr|Frau)\s+\[Nachname\]/g

export type Segment = { art: 'text' | 'gefuellt' | 'offen'; wert: string; name?: string }

/** Text in Segmente: Klartext · gefüllter Platzhalter · offener Platzhalter (Literal „Herr [Nachname]“ wie `fuellen`). */
export function segmente(text: string, lead: PlatzhalterLead, ctx: PlatzhalterKontext): Segment[] {
  const norm = text.replace(LITERAL_ANREDE_RE, '[Anrede] [Nachname]')
  const out: Segment[] = []
  let pos = 0
  for (const m of norm.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0
    if (i > pos) out.push({ art: 'text', wert: norm.slice(pos, i) })
    const name = (m[1] as string).trim()
    const w = platzhalterWert(name, lead, ctx)
    out.push(w === null ? { art: 'offen', wert: m[0], name } : { art: 'gefuellt', wert: w, name })
    pos = i + m[0].length
  }
  if (pos < norm.length) out.push({ art: 'text', wert: norm.slice(pos) })
  return out
}
