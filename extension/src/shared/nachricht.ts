// Nächste Nachricht füllen – ausschließlich über lib/platzhalter.ts (fuellen/tokens), wie die Heute-Karte im CRM.
import { fuellen, tokens, type FuellErgebnis, type PlatzhalterLead, type PlatzhalterMe } from '@/lib/platzhalter'

export type Teil = { art: 'text'; text: string } | { art: 'platzhalter'; name: string; wert: string | null }

export type Gefuellt = FuellErgebnis & {
  /** alle Platzhalter der Vorlage (für „Platzhalter n/m gefüllt“) */
  alle: string[]
  /** Text in Stücken: fester Text und Platzhalter (gefüllt oder offen) – für die Hervorhebung */
  teile: Teil[]
}

const TOKEN_RE = /\[([^[\]\n]{1,40})\]/g
const LITERAL_ANREDE_RE = /\b(Herr|Frau)\s+\[Nachname\]/g

/** Füllt die Vorlage; `werte` sind manuelle Einträge der Person (offene Platzhalter, Überschreibungen). */
export function fuelleVorlage(
  body: string,
  lead: PlatzhalterLead,
  me: PlatzhalterMe | null,
  werte: Record<string, string>,
): Gefuellt {
  const ctx = { werte, me }
  const f = fuellen(body, lead, ctx)
  const norm = body.replace(LITERAL_ANREDE_RE, '[Anrede] [Nachname]')
  const teile: Teil[] = []
  let pos = 0
  for (const m of norm.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0
    if (start > pos) teile.push({ art: 'text', text: norm.slice(pos, start) })
    const name = (m[1] as string).trim()
    teile.push({ art: 'platzhalter', name, wert: f.gefuellt[name] ?? null })
    pos = start + m[0].length
  }
  if (pos < norm.length) teile.push({ art: 'text', text: norm.slice(pos) })
  return { ...f, alle: tokens(body), teile }
}

/** Offene Platzhalter in frei bearbeitetem Text. */
export function offeneImText(text: string): string[] {
  return tokens(text)
}
