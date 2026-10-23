// Kundenantworten in Leitfäden (23.10.2026, Vincent: „alle Kundenantworten in blau darstellen“). Eine Zeile mit „>“ am Anfang ist
// das, was vom Kunden kommt bzw. worauf man wartet („Antwort abwarten.“, „Wenn Ja“). Blau in der Vorschau und im Anruf-Skript;
// „[…]“ (Pause für die Antwort, ältere Telefon-Leitfäden) ebenso. Beim Kopieren fällt das „>“ weg.
const MARKER_RE = /^>[ \t]?/

/** Zeile ohne Marker und ob sie eine Kundenantwort ist. */
export function kundenZeile(zeile: string): { kunde: boolean; text: string } {
  const m = MARKER_RE.exec(zeile)
  return m ? { kunde: true, text: zeile.slice(m[0].length) } : { kunde: false, text: zeile }
}

/** Text ohne „>“-Marker (zum Kopieren). */
export function ohneKundenMarker(text: string): string {
  return text
    .split('\n')
    .map((z) => kundenZeile(z).text)
    .join('\n')
}

/** `[…]` bzw. `[...]` steht für die Antwort des Gegenübers, nicht für einen Platzhalter. */
export function istKundenPause(name: string): boolean {
  return name === '…' || name === '...'
}

/**
 * Schaltet den Marker für alle Zeilen um, die die Auswahl berührt: sind alle (nicht leeren) Zeilen schon Kundenantworten, wird
 * der Marker entfernt, sonst gesetzt. Liefert den neuen Text und die Auswahl über die geänderten Zeilen.
 */
export function kundenantwortUmschalten(
  text: string,
  start: number,
  ende: number,
): { text: string; start: number; ende: number } {
  const von = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  // Auswahl endet direkt nach einem Zeilenumbruch → die nächste Zeile gehört nicht dazu
  const bisRoh = ende > start && text[ende - 1] === '\n' ? ende - 1 : ende
  const naechster = text.indexOf('\n', bisRoh)
  const bis = naechster === -1 ? text.length : naechster
  const zeilen = text.slice(von, bis).split('\n')
  const gefuellt = zeilen.filter((z) => z.trim() !== '')
  const entfernen = gefuellt.length > 0 && gefuellt.every((z) => kundenZeile(z).kunde)
  const neu = zeilen
    .map((z) => {
      if (entfernen) return kundenZeile(z).text
      if (z.trim() === '' || kundenZeile(z).kunde) return z
      return `> ${z}`
    })
    .join('\n')
  return { text: text.slice(0, von) + neu + text.slice(bis), start: von, ende: von + neu.length }
}
