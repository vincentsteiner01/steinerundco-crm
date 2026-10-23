// Formatierung in Leitfäden (23.10.2026, Mikes Editor 1:1: fett, kursiv, unterstrichen, Markieren, Überschrift, Listen,
// Kundenantwort blau). Gespeichert wird weiter Klartext mit einfacher Auszeichnung – so bleibt jede Vorlage kopierbar, und
// beim Senden/Kopieren fällt die Auszeichnung weg (`ohneFormat`, in lib/platzhalter `fuellen`).
//
//   **fett**   *kursiv*   __unterstrichen__   ==markiert==
//   Zeilenanfang:  „# “ Überschrift · „- “ Liste · „1. “ nummerierte Liste · „> “ Kundenantwort (blau)
import { kundenZeile } from './kundenantwort'

export type InlineArt = 'text' | 'fett' | 'kursiv' | 'unter' | 'mark'
export type Inline = { art: InlineArt; text: string }

export type Block =
  | { art: 'absatz'; zeilen: string[] }
  | { art: 'ueberschrift'; text: string }
  | { art: 'kunde'; zeilen: string[] }
  | { art: 'liste'; punkte: string[] }
  | { art: 'nummern'; punkte: string[] }

const INLINE_RE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|==[^=\n]+?==|\*[^*\s\n](?:[^*\n]*?[^*\s\n])?\*)/g
const UEBERSCHRIFT_RE = /^#{1,3}[ \t]+/
const LISTE_RE = /^[-•][ \t]+/
const NUMMER_RE = /^\d{1,2}[.)][ \t]+/

/** Inline-Auszeichnung in Stücke (nicht verschachtelt – bewusst einfach). */
export function inline(text: string): Inline[] {
  const out: Inline[] = []
  let pos = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index ?? 0
    if (i > pos) out.push({ art: 'text', text: text.slice(pos, i) })
    const t = m[0]
    if (t.startsWith('**')) out.push({ art: 'fett', text: t.slice(2, -2) })
    else if (t.startsWith('__')) out.push({ art: 'unter', text: t.slice(2, -2) })
    else if (t.startsWith('==')) out.push({ art: 'mark', text: t.slice(2, -2) })
    else out.push({ art: 'kursiv', text: t.slice(1, -1) })
    pos = i + t.length
  }
  if (pos < text.length) out.push({ art: 'text', text: text.slice(pos) })
  return out
}

/** Text in Blöcke: Leerzeilen trennen Absätze; Überschrift, Kundenantwort und Listen sind eigene Blöcke. */
export function bloecke(text: string): Block[] {
  const out: Block[] = []
  let absatz: string[] = []
  const absatzEnde = () => {
    if (absatz.length) out.push({ art: 'absatz', zeilen: absatz })
    absatz = []
  }
  // nach einer Leerzeile beginnt immer ein neuer Block (zwei Kundenantworten mit Leerzeile = zwei Blöcke)
  let neuerBlock = true
  for (const roh of text.replace(/\r\n?/g, '\n').split('\n')) {
    const zeile = roh.replace(/\s+$/, '')
    if (!zeile.trim()) {
      absatzEnde()
      neuerBlock = true
      continue
    }
    const k = kundenZeile(zeile)
    if (k.kunde) {
      absatzEnde()
      const davor = out.at(-1)
      if (!neuerBlock && davor?.art === 'kunde') davor.zeilen.push(k.text)
      else out.push({ art: 'kunde', zeilen: [k.text] })
      neuerBlock = false
      continue
    }
    if (UEBERSCHRIFT_RE.test(zeile)) {
      absatzEnde()
      out.push({ art: 'ueberschrift', text: zeile.replace(UEBERSCHRIFT_RE, '') })
      neuerBlock = true
      continue
    }
    const liste = LISTE_RE.test(zeile) ? 'liste' : NUMMER_RE.test(zeile) ? 'nummern' : null
    if (liste) {
      absatzEnde()
      const punkt = zeile.replace(liste === 'liste' ? LISTE_RE : NUMMER_RE, '')
      const davor = out.at(-1)
      if (!neuerBlock && davor?.art === liste) davor.punkte.push(punkt)
      else out.push({ art: liste, punkte: [punkt] })
      neuerBlock = false
      continue
    }
    // Absatzzeile direkt nach Kundenantwort/Liste beginnt einen neuen Absatz
    absatz.push(zeile)
    neuerBlock = false
  }
  absatzEnde()
  return out
}

/** Auszeichnung entfernen (Kopieren, Senden, Kartenauszug). Listen bleiben als „- “/„1. “ lesbar. */
export function ohneFormat(text: string): string {
  return text
    .split('\n')
    .map((z) => kundenZeile(z).text.replace(UEBERSCHRIFT_RE, ''))
    .join('\n')
    .replace(INLINE_RE, (t) =>
      t.startsWith('**') || t.startsWith('__') || t.startsWith('==') ? t.slice(2, -2) : t.slice(1, -1),
    )
}

/** Kurzer Auszug für Karten: ohne Auszeichnung, Zeilen zusammengezogen. */
export function auszug(text: string, max = 180): string {
  const flach = ohneFormat(text)
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
  return flach.length > max ? `${flach.slice(0, max - 1).trimEnd()}…` : flach
}
