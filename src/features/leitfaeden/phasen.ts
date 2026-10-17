// BAUPLAN § 3.7 / § 1.5 Nr. 41 – Phasen-Reihenfolge, Labels und Pflichtfeld `beschreibung` je Kanal.
// Die vier LinkedIn-Zwecke stehen wörtlich in import/leitfaeden.json[phases].ziel (Fixture src/test/fixtures/leitfadenPhasen.json).
import type { Channel, TemplatePhase } from '@/types/domain'

export type PhaseDef = { key: TemplatePhase; label: string; beschreibung: string }

/** Kanäle in Baum-Reihenfolge (ux § 3.8). `sonstiges` trägt seit 17.10.2026 die Sales-Leitfäden (Feedback 9959e426). */
export const KANAELE: readonly Channel[] = ['linkedin', 'telefon', 'email', 'sonstiges']

/** Zwei Bereiche über den Kanälen: Outreach (Kontakt aufbauen) und Sales (Gespräche führen). */
export const BEREICHE = [
  { key: 'outreach', label: 'Outreach', kanaele: ['linkedin', 'telefon', 'email'] },
  { key: 'sales', label: 'Sales', kanaele: ['sonstiges'] },
] as const satisfies readonly { key: string; label: string; kanaele: readonly Channel[] }[]

/** Anzeige in den Leitfäden: der Kanal „sonstiges“ heißt hier „Sales“. */
export const LEITFADEN_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn',
  telefon: 'Telefon',
  email: 'E-Mail',
  sonstiges: 'Sales',
}

export const PHASEN: Record<Channel, readonly PhaseDef[]> = {
  linkedin: [
    { key: 'vernetzung', label: '0 Vernetzung', beschreibung: 'Anfrage mit Notiz: Grund für die Vernetzung nennen' },
    { key: 'eroeffnung', label: '1 Gesprächseröffnung', beschreibung: 'Problem erkennen & Antwort auslösen' },
    {
      key: 'bedarfsermittlung',
      label: '2 Bedarfsermittlung',
      beschreibung: 'Bedarf, Priorität & Einwände qualifizieren',
    },
    { key: 'pitch', label: '3 Pitch', beschreibung: 'Unverbindliches 15-Min.-Gespräch vereinbaren' },
    { key: 'follow_up', label: '4 Follow-ups', beschreibung: 'Nicht-Antworter erneut aktivieren' },
    { key: 'langfristig', label: '4 Langfristig', beschreibung: 'Nach 2–3 Monaten ohne Druck wieder anklopfen' },
  ],
  telefon: [
    { key: 'gatekeeper', label: 'Zentrale', beschreibung: 'Durchstellen erreichen, Anlass nennen' },
    { key: 'einstieg', label: 'Einstieg', beschreibung: 'Anrufgrund in einem Satz, Erlaubnis für zwei Minuten' },
    { key: 'problem', label: 'Problem', beschreibung: 'Rückfragen im Innendienst sichtbar machen' },
    { key: 'qualifizierung', label: 'Qualifizierung', beschreibung: 'Wer beantwortet, wie oft, aus welcher Quelle' },
    { key: 'pitch', label: 'Pitch', beschreibung: '15-Minuten-Erstgespräch anbieten' },
    { key: 'einwand', label: 'Einwände', beschreibung: 'Einwand aufnehmen, nicht widerlegen' },
    { key: 'abschluss', label: 'Abschluss', beschreibung: 'Termin oder Rückruf konkret festmachen' },
    { key: 'mailbox', label: 'Mailbox', beschreibung: 'Kurz, mit Namen und Rückrufnummer' },
    { key: 'rueckruf', label: 'Rückruf', beschreibung: 'Vereinbarten Rückruf eröffnen' },
    { key: 'datenschutz', label: 'Datenschutz', beschreibung: 'Ein-Satz-Hinweis nach Art. 14' },
  ],
  email: [
    {
      key: 'zusammenfassung',
      label: 'Zusammenfassung',
      beschreibung: 'Gespräch festhalten, nächsten Schritt benennen',
    },
    { key: 'nachfassen', label: 'Nachfassen', beschreibung: 'Im Thread erinnern, ohne neuen Anlass zu erfinden' },
    { key: 'infomail', label: 'Infomail', beschreibung: 'Erbetene Kurzinfo nach Zusage' },
    { key: 'transaktional', label: 'Transaktional', beschreibung: 'Organisatorisch, keine Werbeinhalte' },
  ],
  sonstiges: [
    { key: 'erstgespraech', label: 'Erstgespräch', beschreibung: 'Ablauf, Fragen und Ziel des 15-Minuten-Gesprächs' },
    { key: 'strategiegespraech', label: 'Strategiegespräch', beschreibung: 'Analyse, Lösung und nächste Schritte' },
    {
      key: 'einwandbehandlung',
      label: 'Einwandbehandlung',
      beschreibung: 'Einwände im Sales-Gespräch aufnehmen und klären',
    },
    { key: 'angebot', label: 'Angebot & Abschluss', beschreibung: 'Angebot vorstellen, Entscheidung herbeiführen' },
  ],
}

/** Phasen eines Kanals in Baum-Reihenfolge. */
export function phasenFuer(kanal: Channel): readonly PhaseDef[] {
  return PHASEN[kanal]
}

/** Definition einer Phase in einem Kanal (`pitch` gibt es bei LinkedIn und Telefon). Unbekannt → Fallback mit dem Enum-Wert. */
export function phaseDef(kanal: Channel, phase: TemplatePhase): PhaseDef {
  return PHASEN[kanal].find((p) => p.key === phase) ?? { key: phase, label: phase, beschreibung: '' }
}

/** Position einer Phase im Kanal (Sortierung); unbekannt → ans Ende. */
export function phaseRang(kanal: Channel, phase: TemplatePhase): number {
  const i = PHASEN[kanal].findIndex((p) => p.key === phase)
  return i < 0 ? 999 : i
}

/** „1 Gesprächseröffnung“ → { ziffer: '1', text: 'Gesprächseröffnung' }; ohne Ziffer → { ziffer: null, text }. */
export function labelTeile(label: string): { ziffer: string | null; text: string } {
  const m = /^(\d+)\s+(.+)$/.exec(label)
  return m ? { ziffer: m[1] as string, text: m[2] as string } : { ziffer: null, text: label }
}

/** Kanal-Präfix für neue Schlüssel (BAUPLAN § 3.7 „DB“): `<präfix>_<slug>`. */
export const KEY_PRAEFIX: Record<Channel, string> = { linkedin: 'li', telefon: 'tel', email: 'em', sonstiges: 'sales' }
