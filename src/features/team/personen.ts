// Team-Personen: Mitglieder (View crm.members) in fester Reihenfolge Vincent · Mike (Register features/auth/personen), weitere
// dahinter nach Name. 25.11.2026 (Neustart): die Filter des alten Team-Protokolls (`?person=`, `?kanal=`) sind entfallen.
import { PERSONEN } from '@/features/auth/personen'
import { anzeigeName, personSlug } from '@/lib/mitglied'
import type { Member } from '@/types/domain'

export type TeamPerson = { id: string; name: string; member: Member }

function rang(p: TeamPerson): number {
  const slug = personSlug(p.member)
  const i = PERSONEN.findIndex((x) => x.id === slug)
  return i < 0 ? PERSONEN.length : i
}

export function teamPersonen(members: readonly Member[]): TeamPerson[] {
  return members
    .filter((m): m is Member & { id: string } => !!m.id)
    .map((m): TeamPerson => ({ id: m.id, name: anzeigeName(m, m.id), member: m }))
    .sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'))
}
