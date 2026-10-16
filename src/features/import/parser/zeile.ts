// Schnellimport-Zeile → import_leads-Row. Ausgelagert aus SchnellimportSeite.tsx, damit die Auftragsseite (ChatGPT-Agent)
// dieselbe Umwandlung nutzt, ohne die ganze Seite mitzuladen.
import type { Salutation, SchnellimportZeile } from '@/types/domain'
import type { ImportLeadRow } from '../presets/allgemein'

/** Zeile → import_leads-Row (Anrede explizit, Rolle aus role_title macht der Server). */
export function zeileZuRow(z: SchnellimportZeile, anrede: Salutation | null): ImportLeadRow {
  const r: ImportLeadRow = {}
  if (z.first_name) r.first_name = z.first_name
  if (z.last_name) r.last_name = z.last_name
  if (!z.first_name && !z.last_name && z.name) r.name = z.name
  if (anrede) r.salutation = anrede
  if (z.company) r.company = z.company
  if (z.role_title) r.role_title = z.role_title
  if (z.linkedin_url) r.linkedin_url = z.linkedin_url
  if (z.city) r.city = z.city
  if (z.title) r.title = z.title // vorher ein No-op – „Dr. Anna Beispiel“ verlor den Titel (§ 6.3 Beispiel 1, Review)
  return r
}

/** Zeilen, die zum Server gehen: keine Listen-Dubletten, mindestens Name oder Person-URL. */
export function sendbar(z: SchnellimportZeile): boolean {
  if (z.status_lokal === 'dublette_liste') return false
  return !!(z.first_name || z.last_name || z.url_art === 'person')
}
