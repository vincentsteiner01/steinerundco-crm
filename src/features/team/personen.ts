// Team-Personen: Mitglieder (View crm.members) in fester Reihenfolge Vincent · Mike (Register features/auth/personen), weitere
// alphabetisch; `slug` = URL-Wert (`?person=vincent`). Dazu die Protokoll-Filter aus der URL.
import { PERSONEN } from '@/features/auth/personen'
import type { Channel, Member } from '@/types/domain'
import { anzeigeName } from '@/lib/mitglied'

export type TeamPerson = { id: string; slug: string; name: string; member: Member }

export function teamPersonen(members: readonly Member[]): TeamPerson[] {
  const slug = (m: Member) =>
    PERSONEN.find((p) => p.email === m.email?.toLowerCase())?.id ?? anzeigeName(m, m.id ?? '').toLowerCase()
  const rang = (s: string) => {
    const i = PERSONEN.findIndex((p) => p.id === s)
    return i < 0 ? 99 : i
  }
  return members
    .filter((m): m is Member & { id: string } => !!m.id)
    .map((m) => ({ id: m.id, slug: slug(m), name: anzeigeName(m, m.id ?? ''), member: m as Member }))
    .sort((a, b) => rang(a.slug) - rang(b.slug) || a.name.localeCompare(b.name))
}

export type KanalWahl = Channel | 'alle'

export function parseKanal(s: string | null): KanalWahl {
  return s === 'linkedin' || s === 'telefon' || s === 'email' || s === 'sonstiges' ? s : 'alle'
}

/** `?person=<slug>` → eine Person; sonst beide (`null`). */
export function parsePerson(s: string | null, personen: readonly TeamPerson[]): TeamPerson | null {
  return personen.find((p) => p.slug === s) ?? null
}
