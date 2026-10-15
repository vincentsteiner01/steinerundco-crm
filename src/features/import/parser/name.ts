// BAUPLAN § 3.8 parser/name.ts · § 6.3 NAME: Anrede (Herr|Frau|Hr.|Fr.) → salutation, entfernt; Titel (Dr.|Prof.) → title;
// letztes Wort = last_name, Adelspartikel (von|van|de|zu|der …) gehört zum Nachnamen; Rest = first_name.
import type { Salutation } from '@/types/domain'

export type NameTeile = {
  /** Name ohne Anrede, mit Titel („Dr. Anna Beispiel“) */
  name: string | null
  first_name: string | null
  last_name: string | null
  title: string | null
  salutation: Salutation | null
}

const ANREDE = /^(herr|hr\.?|frau|fr\.?)\s+/i
const TITEL_TOKEN =
  /^(prof\.?|dr\.?|med\.?|rer\.?|nat\.?|pol\.?|jur\.?|ing\.?|h\.?c\.?|dipl\.?-?[a-z]*\.?|mba|phd|ph\.d\.)$/i
const PARTIKEL = new Set([
  'von',
  'van',
  'de',
  'zu',
  'der',
  'den',
  'vom',
  'zur',
  'da',
  'di',
  'du',
  'del',
  'della',
  'le',
  'la',
  'dos',
  'das',
  'ter',
  'ten',
  'af',
  'av',
  'y',
  'el',
  'al',
])

const LEER: NameTeile = { name: null, first_name: null, last_name: null, title: null, salutation: null }

/** Fettdruck, Mehrfach-Leerzeichen und Rand-Satzzeichen entfernen. */
export function nameBereinigen(s: string): string {
  return s
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim()
}

export function parseName(roh: string | null | undefined): NameTeile {
  if (!roh) return LEER
  let s = nameBereinigen(roh)
  if (s === '') return LEER
  let salutation: Salutation | null = null
  const a = ANREDE.exec(s)
  if (a) {
    salutation = /^h/i.test(a[1] ?? '') ? 'herr' : 'frau'
    s = s.slice(a[0].length).trim()
  }
  const woerter = s.split(' ').filter(Boolean)
  const titel: string[] = []
  while (woerter.length > 1 && TITEL_TOKEN.test(woerter[0] ?? '')) titel.push(woerter.shift() as string)
  const title = titel.length ? titel.join(' ') : null
  if (woerter.length === 0) return { ...LEER, salutation, title }
  if (woerter.length === 1) {
    const einziges = woerter[0] as string
    return { name: s, first_name: null, last_name: einziges, title, salutation }
  }
  let i = woerter.length - 1
  const nach: string[] = [woerter[i] as string]
  i -= 1
  while (i >= 1 && PARTIKEL.has((woerter[i] as string).toLowerCase())) {
    nach.unshift(woerter[i] as string)
    i -= 1
  }
  const first_name = woerter.slice(0, i + 1).join(' ') || null
  return { name: s, first_name, last_name: nach.join(' '), title, salutation }
}

/** Anrede-Wort (Herr/Frau/–/H/F/m/w) → Salutation oder null. */
export function parseAnrede(v: string | null | undefined): Salutation | null {
  if (!v) return null
  const s = v.trim().toLowerCase()
  if (/^(herr|hr\.?|h|m|male|mann|mr\.?)$/.test(s)) return 'herr'
  if (/^(frau|fr\.?|f|w|female|ms\.?|mrs\.?)$/.test(s)) return 'frau'
  if (/^(neutral|divers|d|-|–|—)$/.test(s)) return 'neutral'
  return null
}
