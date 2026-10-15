// Namen aus LinkedIn bereinigen und in Titel / Vorname / Nachname teilen. Reine Funktionen – die Person korrigiert im Formular.

export type NamensTeile = { titel: string | null; vorname: string | null; nachname: string | null }

const NULLBREITE = /[\u200B-\u200D\u2060\uFEFF]/g
// Emojis, Piktogramme, Häkchen, Pfeile, Sterne, Variationsselektoren
const SYMBOLE = /[\p{Extended_Pictographic}\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/gu
// „(er/ihm)“, „(Sie/Ihr)“, „(he/him)“ und andere Klammerzusätze
const KLAMMERN = /\s*[([{][^)\]}]*[)\]}]/g
// „, MBA“ · „, Dipl.-Ing.“ · „ – Solar“ am Ende
const ZUSATZ_NACH_KOMMA = /\s*,\s+.*$/
const ZUSATZ_NACH_STRICH = /\s+[-|–—]\s+.*$/

/** Akademische Titel, die als `title` gespeichert werden (Dr., Prof.). */
const TITEL_RE = /^((?:Prof\.?\s*)?(?:Dr\.?(?:-?\s*(?:med|rer\.?\s*nat|phil|jur|ing|h\.?\s*c)\.?)*\s*)+|Prof\.?)\s+/i
/** Vorsätze ohne Speicherung (Dipl.-Ing., Ing., Mag., B.Sc., M.Sc.). */
const VORSATZ_RE = /^(?:Dipl\.?-?\s?(?:Ing|Kfm|Kffr|Inf|Wirt\.?-?Ing)\.?(?:\s*\(FH\))?|Ing\.|Mag\.|B\.\s?Sc\.|M\.\s?Sc\.|B\.\s?A\.|M\.\s?A\.)\s+/i

const PARTIKEL = new Set(['von', 'van', 'vom', 'zu', 'zum', 'zur', 'de', 'der', 'den', 'del', 'della', 'di', 'da', 'du', 'ten', 'ter', 'la', 'le'])

/** Leerraum zusammenziehen, Nullbreiten entfernen. */
export function sauber(s: string | null | undefined): string {
  return (s ?? '').replace(NULLBREITE, '').replace(/\s+/g, ' ').trim()
}

/** Anzeigename ohne Emojis, Pronomen-Klammern und Zusätze nach Komma/Strich; `null`, wenn nichts übrig bleibt. */
export function bereinigeName(roh: string | null | undefined): string | null {
  let s = sauber(roh)
  if (!s) return null
  s = s.replace(SYMBOLE, ' ')
  s = s.replace(KLAMMERN, ' ')
  s = s.replace(ZUSATZ_NACH_KOMMA, '')
  s = s.replace(ZUSATZ_NACH_STRICH, '')
  s = sauber(s)
  // Zeichen am Rand, die kein Name sind (✓, •, Sternchen)
  s = s.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, '').trim()
  return s.length >= 2 ? s : null
}

/** Teilt einen (bereinigten) Namen: Titel vorne, Nachname = letzter Teil inkl. Partikeln („von der Heide“). */
export function teileName(roh: string | null | undefined): NamensTeile {
  let s = bereinigeName(roh)
  if (!s) return { titel: null, vorname: null, nachname: null }
  let titel: string | null = null
  const t = TITEL_RE.exec(s)
  if (t) {
    titel = sauber(t[1])
    s = s.slice(t[0].length)
  }
  s = s.replace(VORSATZ_RE, '')
  const teile = sauber(s).split(' ').filter(Boolean)
  if (teile.length === 0) return { titel, vorname: null, nachname: null }
  if (teile.length === 1) return { titel, vorname: teile[0] ?? null, nachname: null }
  // erster Partikel nach mindestens einem Vornamen beginnt den Nachnamen
  let start = teile.length - 1
  for (let i = 1; i < teile.length - 1; i++) {
    if (PARTIKEL.has((teile[i] ?? '').toLowerCase())) {
      start = i
      break
    }
  }
  return { titel, vorname: teile.slice(0, start).join(' '), nachname: teile.slice(start).join(' ') }
}

/** Vergleichsform: klein, ohne Diakritika, nur Buchstaben und Leerzeichen. */
export function nameSchluessel(s: string | null | undefined): string {
  return sauber(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Gleiche Person? Vollständig gleich oder erster und letzter Namensteil gleich. */
export function gleicherName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nameSchluessel(bereinigeName(a))
  const y = nameSchluessel(bereinigeName(b))
  if (!x || !y) return false
  if (x === y) return true
  const tx = x.split(' ')
  const ty = y.split(' ')
  return tx.length > 1 && ty.length > 1 && tx[0] === ty[0] && tx[tx.length - 1] === ty[ty.length - 1]
}
