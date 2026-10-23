// Formatleiste im Leitfaden-Editor (23.10.2026, Mikes Editor): reine Textoperationen auf Auswahl/Zeilen. Jede liefert neuen
// Text plus Auswahl, damit die Textarea danach markiert bleibt. Auszeichnung wie in lib/leitfadenFormat.
import { ohneFormat } from '@/lib/leitfadenFormat'

export type Ergebnis = { text: string; start: number; ende: number }

export type Umschliessen = '**' | '*' | '__' | '=='

/** Auswahl mit Marker umschließen (oder, wenn schon umschlossen, entfernen); ohne Auswahl Marker-Paar mit Cursor dazwischen. */
export function umschliessen(text: string, start: number, ende: number, m: Umschliessen): Ergebnis {
  const sel = text.slice(start, ende)
  const vor = text.slice(Math.max(0, start - m.length), start)
  const nach = text.slice(ende, ende + m.length)
  if (sel && vor === m && nach === m)
    return {
      text: text.slice(0, start - m.length) + sel + text.slice(ende + m.length),
      start: start - m.length,
      ende: ende - m.length,
    }
  if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m)) {
    const innen = sel.slice(m.length, -m.length)
    return { text: text.slice(0, start) + innen + text.slice(ende), start, ende: start + innen.length }
  }
  const neu = `${m}${sel}${m}`
  return {
    text: text.slice(0, start) + neu + text.slice(ende),
    start: start + m.length,
    ende: start + m.length + sel.length,
  }
}

export type Praefix = 'ueberschrift' | 'liste' | 'nummern' | 'kunde'
const PRAEFIX_RE: Record<Praefix, RegExp> = {
  ueberschrift: /^#{1,3}[ \t]+/,
  liste: /^[-•][ \t]+/,
  nummern: /^\d{1,2}[.)][ \t]+/,
  kunde: /^>[ \t]?/,
}
const ALLE_PRAEFIXE = /^(#{1,3}[ \t]+|[-•][ \t]+|\d{1,2}[.)][ \t]+|>[ \t]?)/

function zeilenBereich(text: string, start: number, ende: number): { von: number; bis: number } {
  const von = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const bisRoh = ende > start && text[ende - 1] === '\n' ? ende - 1 : ende
  const n = text.indexOf('\n', bisRoh)
  return { von, bis: n === -1 ? text.length : n }
}

/** Zeilenformat umschalten: sind alle (nicht leeren) Zeilen schon so, wird es entfernt – sonst gesetzt (ersetzt andere Präfixe). */
export function zeilenPraefix(text: string, start: number, ende: number, art: Praefix): Ergebnis {
  const { von, bis } = zeilenBereich(text, start, ende)
  const zeilen = text.slice(von, bis).split('\n')
  const gefuellt = zeilen.filter((z) => z.trim())
  const entfernen = gefuellt.length > 0 && gefuellt.every((z) => PRAEFIX_RE[art].test(z))
  let nr = 0
  const neu = zeilen
    .map((z) => {
      if (!z.trim()) return z
      const rein = z.replace(ALLE_PRAEFIXE, '')
      if (entfernen) return rein
      nr += 1
      const p = art === 'ueberschrift' ? '# ' : art === 'liste' ? '- ' : art === 'nummern' ? `${nr}. ` : '> '
      return p + rein
    })
    .join('\n')
  return { text: text.slice(0, von) + neu + text.slice(bis), start: von, ende: von + neu.length }
}

/** „Format löschen“: Auszeichnung in den berührten Zeilen entfernen (ganzer Text, wenn nichts ausgewählt ist). */
export function formatLoeschen(text: string, start: number, ende: number): Ergebnis {
  if (start === ende) {
    const neu = ohneFormat(text).replace(/^[-•][ \t]+|^\d{1,2}[.)][ \t]+/gm, '')
    return { text: neu, start: 0, ende: 0 }
  }
  const { von, bis } = zeilenBereich(text, start, ende)
  const neu = ohneFormat(text.slice(von, bis)).replace(/^[-•][ \t]+|^\d{1,2}[.)][ \t]+/gm, '')
  return { text: text.slice(0, von) + neu + text.slice(bis), start: von, ende: von + neu.length }
}
