// BAUPLAN § 6.2 „Allgemein“ + § 6.3 (MDTABELLE/CSV/JSON): Kopfzeilen-Treffer sind Teilstrings, case-insensitiv, Umlaute transliteriert.
// Gemeinsame Quelle für Schnellimport (Markdown-Tabelle, CSV-Block, JSON-Keys) und das Preset „Allgemein“.

export type ZielFeld =
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'salutation'
  | 'company'
  | 'role_title'
  | 'linkedin_url'
  | 'city'
  | 'phone'
  | 'email'
  | 'notes'
  | 'tags'

export const ZIEL_FELDER: readonly ZielFeld[] = [
  'name',
  'first_name',
  'last_name',
  'salutation',
  'company',
  'role_title',
  'linkedin_url',
  'city',
  'phone',
  'email',
  'notes',
  'tags',
]

export const ZIEL_LABEL: Record<ZielFeld, string> = {
  name: 'Name (Vor- und Nachname)',
  first_name: 'Vorname',
  last_name: 'Nachname',
  salutation: 'Anrede',
  company: 'Unternehmen',
  role_title: 'Position',
  linkedin_url: 'LinkedIn-URL',
  city: 'Ort',
  phone: 'Telefon',
  email: 'E-Mail',
  notes: 'Notizen',
  tags: 'Tags',
}

const TRANS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Umlaute transliteriert (ä→ae …), klein, getrimmt – wie `snake()` in import/tools/parse_sheets.py. */
export function translit(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANS[c] ?? c)
}

/** Kopfzeile → snake_case-Key (parse_sheets.py: nicht-alphanumerisch → `_`, Ränder getrimmt). */
export function snake(s: string): string {
  return translit(s)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Kopfwort → Zielfeld oder null (Reihenfolge entscheidet: „Vor- und Nachname“ vor „Nachname“, „Unternehmen“ vor „Name“). */
export function zielFeldFuerKopf(kopf: string | null | undefined): ZielFeld | null {
  if (!kopf) return null
  const h = translit(String(kopf))
  if (h === '') return null
  if (/vor-?\s*(und|&|\/|u\.)\s*nachname|vor-?\s*\/?\s*nachname|full\s*_?name|voller name|vollstaendiger name/.test(h))
    return 'name'
  if (/e-?_?mail|^mail$/.test(h)) return 'email'
  if (/linkedin|url|profil|link/.test(h)) return 'linkedin_url'
  if (/unternehmen|firma|company|organisation|organization|betrieb|arbeitgeber/.test(h)) return 'company'
  if (/vorname|first_?name|given/.test(h)) return 'first_name'
  if (/nachname|last_?name|surname|familienname/.test(h)) return 'last_name'
  if (/anrede|salutation|geschlecht|gender/.test(h)) return 'salutation'
  if (/position|rolle|role|titel|title|funktion|job|taetigkeit/.test(h)) return 'role_title'
  if (/stadt|city|standort|region|wohnort|(^|[^a-z])ort($|[^a-z])/.test(h)) return 'city'
  if (/telefon|phone|rufnummer|nummer|mobil|handy|zentrale|durchwahl|(^|[^a-z])tel($|[^a-z])/.test(h)) return 'phone'
  if (/notiz|note|bemerk|kommentar/.test(h)) return 'notes'
  if (/(^|[^a-z])tags?($|[^a-z])|schlagwort|label/.test(h)) return 'tags'
  if (/(^|[^a-z])(name|person|kontakt|contact)($|[^a-z])/.test(h)) return 'name'
  return null
}

/** Anzahl erkannter Kopfwörter (CSV-Erkennung § 6.3: ≥ 2). */
export function erkannteKopfwoerter(kopf: readonly string[]): number {
  return kopf.filter((k) => zielFeldFuerKopf(k) !== null).length
}
