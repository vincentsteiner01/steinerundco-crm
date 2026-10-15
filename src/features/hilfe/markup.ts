// Auszeichnung der Handbuch-Texte (siehe Inline.tsx): Muster und Klartext für die Suche.

/** Trennt `{{geplant}}`, `{Taste}`, `**fett**` und `[Link](/pfad)` vom übrigen Text (String.split mit Gruppe). */
export const MUSTER = /(\{\{geplant\}\}|\{[^{}]+\}|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g

/** Klartext ohne Auszeichnung – für die Suche. */
export function klartext(text: string): string {
  return text
    .replace(/\{\{geplant\}\}/g, 'geplant')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
}

/** Akkord „G H“ → ['G', 'H']; alles andere („1–9“, „⌘⇧O“, „Space“) bleibt eine Taste. */
export function tastenTeile(wert: string): string[] {
  return /^[A-ZÄÖÜ](?: [A-ZÄÖÜ])+$/.test(wert) ? wert.split(' ') : [wert]
}
