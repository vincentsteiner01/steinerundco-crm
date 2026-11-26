// Bereiche der Einstellungen (Route `/einstellungen/:bereich`). Neustart 25.11.2026: fünf Bereiche – nur was im einfachen CRM
// noch etwas bewirkt. Die Reihenfolge hier ist die Reihenfolge in der Unternavigation.
import type { PFADE } from '@/app/pfade'

/** Bereiche = Union von `PFADE.einstellungen`; Pfade baut `PFADE.einstellungen(b)`. */
export type Bereich = Parameters<typeof PFADE.einstellungen>[0] & string

export type BereichEintrag = { key: Bereich; label: string }

export const BEREICHE: readonly BereichEintrag[] = [
  { key: 'profil', label: 'Profil' },
  { key: 'passcode', label: 'Passcode' },
  { key: 'sperrliste', label: 'Sperrliste' },
  { key: 'feiertage', label: 'Feiertage' },
  { key: 'export', label: 'Export & Backup' },
]

export const STANDARD_BEREICH: Bereich = 'profil'

export function istBereich(s: string | undefined): s is Bereich {
  return BEREICHE.some((b) => b.key === s)
}
