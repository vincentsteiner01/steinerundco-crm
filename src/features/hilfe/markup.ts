// Auszeichnung der Handbuch-Texte (siehe Inline.tsx): Muster und Klartext für die Suche.
// 25.11.2026: Die Tasten-Auszeichnung `{Taste}` ist mit den Tastenkürzeln entfallen – geschweifte Klammern haben keine Bedeutung mehr.

/** Ein Link `[Text](/pfad)` – Gruppe 1 = Text, Gruppe 2 = Ziel. */
export const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/
const ALLE_LINKS = new RegExp(LINK.source, 'g')

/** Trennt `{{geplant}}`, `**fett**` und `[Link](/pfad)` vom übrigen Text (String.split mit Gruppe). */
export const MUSTER = /(\{\{geplant\}\}|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g

/** Klartext ohne Auszeichnung – für die Suche. */
export function klartext(text: string): string {
  return text
    .replace(/\{\{geplant\}\}/g, 'geplant')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(ALLE_LINKS, '$1')
}

/** Ziele aller Links eines Textes, wie geschrieben (`/pfad`) – für die Prüfung gegen die Routentabelle. */
export function linkZiele(text: string): string[] {
  return [...text.matchAll(ALLE_LINKS)].map((m) => m[2]!)
}
