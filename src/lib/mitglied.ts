// Runde 2 (echte Daten): `crm.members.short_name` ist ein Kürzel („VS“), das Vincent im Profil gesetzt hat – als Anzeigename
// ergab das „Guten Tag, VS.“, „VS | Mike“ und „Eröffnet von VS“. Namen kommen deshalb aus `display_name` (Vorname); das Kürzel
// bzw. die Initialen aus PERSONEN gehören nur an Avatar und kompakte Badges.
import { PERSONEN, type PersonId } from '@/features/auth/personen'

export type NamensMitglied = {
  id?: string | null
  display_name?: string | null
  short_name?: string | null
  email?: string | null
}

function registerPerson(m: NamensMitglied) {
  const mail = m.email?.toLowerCase()
  const name = m.display_name?.trim().toLowerCase()
  return PERSONEN.find((p) => p.email === mail || (!!name && p.name.toLowerCase() === name))
}

/** „VS“, „MM“: ein Kürzel (bis 3 Großbuchstaben) ist kein Name. */
export function istKuerzel(s: string | null | undefined): boolean {
  return !!s && /^[A-ZÄÖÜ]{1,3}$/.test(s.trim())
}

/**
 * Vorname zum Anzeigen: short_name, sofern es kein Kürzel ist („Mike“) → erstes Wort von display_name („Vincent“) → Register
 * (E-Mail) → Ersatz. Ein Kürzel wie „VS“ erscheint nie als Name.
 */
export function anzeigeName(m: NamensMitglied | null | undefined, ersatz = ''): string {
  if (!m) return ersatz
  const s = m.short_name?.trim()
  if (s && !istKuerzel(s)) return s
  const d = m.display_name?.trim().split(/\s+/)[0]
  if (d) return d
  const p = registerPerson(m)
  if (p) return p.name
  return s || ersatz
}

/** Slug für `?person=` (vincent | mike); unbekannte Personen: Vorname klein. */
export function personSlug(m: NamensMitglied | null | undefined): PersonId | string {
  if (!m) return ''
  return registerPerson(m)?.id ?? anzeigeName(m, m.id ?? '').toLowerCase()
}
