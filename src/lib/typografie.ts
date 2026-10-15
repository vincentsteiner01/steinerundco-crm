// BAUPLAN § 3.1.9 `typografie.ts` / E26, ux § 6.4 – nur für generierte Texte (Toasts mit Namen, Zitate aus Notizen).
// Statische UI-Strings stehen schon typografisch korrekt in de.ts und den Komponenten.

const SCHMAL = ' ' // schmales geschütztes Leerzeichen (Prozent)
const NBSP = ' ' // geschütztes Leerzeichen (Einheiten)
export const MINUS = '−'

/** Gerade Anführungszeichen → „…“ und ‚…‘ (deutsch). Apostrophe innerhalb von Wörtern bleiben als ’. */
export function tq(s: string): string {
  let out = s
  // Doppelte: öffnend nach Zeilenanfang/Leerzeichen/Klammer, sonst schließend
  out = out.replace(/(^|[\s([{–-])"/g, '$1„').replace(/"/g, '“')
  // Apostroph im Wort (don’t, Müller’s) vor einfachen Anführungszeichen behandeln
  out = out.replace(/(\p{L})'(\p{L})/gu, '$1’$2')
  out = out.replace(/(^|[\s([{„–-])'/g, '$1‚').replace(/'/g, '‘')
  return out
}

/** ` - `/` -- ` → ` – ` (Gedankenstrich), Zahlenbereiche `2-3` → `2–3`, `...` → `…`. */
export function gedankenstrich(s: string): string {
  return s
    .replace(/\s+(?:--|-|—)\s+/g, ' – ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1–$2')
    .replace(/\.{3}/g, '…')
}

/** Geschützte Leerzeichen vor Einheiten: `30 %` (U+202F), `15 Min.`, `2 h`, `3 T`, `+3 pp` (U+00A0). */
export function nbspEinheit(s: string): string {
  return s
    .replace(/(\d)\s*%/g, `$1${SCHMAL}%`)
    .replace(/(\d)\s+(Min\.|Std\.|h|T|pp|s|min|kB|MB|km|€)(?=$|[\s.,;:)!?])/g, `$1${NBSP}$2`)
}

/** Vorzeichen als echtes Minus (`-2` → `−2`), nur vor Ziffern. */
export function echtesMinus(s: string): string {
  return s.replace(/(^|[\s(])-(\d)/g, `$1${MINUS}$2`)
}

/** Alle Regeln auf einen generierten Text anwenden. */
export function typografisch(s: string): string {
  return nbspEinheit(gedankenstrich(tq(echtesMinus(s))))
}
