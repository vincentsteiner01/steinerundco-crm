// Reine Eingabe-Logik des Blocks „Meine Vernetzungen“ (KPI-Reiter, 26.11.2026): Feldtext ↔ Zahl und „wurde etwas geändert?“.
const ZAEHLER_MAX = 9999
export const KEINE_GANZE_ZAHL = 'Bitte eine ganze Zahl eingeben.'

/** Feldtext → Zahl: leer = 0, erlaubt sind ganze Zahlen 0–9999. Alles andere (Komma, Minus, Buchstaben, zu groß) → `null`. */
export function zahlAusEingabe(text: string): number | null {
  const t = text.trim()
  if (t === '') return 0
  if (!/^[0-9]+$/.test(t)) return null
  const n = Number(t)
  return n <= ZAEHLER_MAX ? n : null
}

/** Gespeicherter Wert → Feldtext; `null` (für den Tag noch nichts eingetragen) = leeres Feld. */
export const feldText = (wert: number | null | undefined): string => (wert == null ? '' : String(wert))

/**
 * Weicht ein Feld vom gespeicherten Stand ab? Verglichen wird die Zahl, nicht der Text („07“ = 7). In einem Feld, für das
 * noch nichts eingetragen ist (`null` – auch wenn der Stand nicht bekannt ist, weil der Tag lädt oder sich nicht laden ließ),
 * zählt jede Eingabe – auch eine getippte 0 (bewusst „heute keine“); leer lassen ändert nichts.
 */
export function feldGeaendert(text: string, gespeichert: number | null): boolean {
  if (gespeichert === null) return text.trim() !== ''
  return zahlAusEingabe(text) !== gespeichert
}
