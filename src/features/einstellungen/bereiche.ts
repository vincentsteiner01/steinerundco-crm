// Bereiche der Einstellungen (BAUPLAN § 3.9, Route `/einstellungen/:bereich`). v1.1: phasen · tags · icp · rechtliches.
import type { PFADE } from '@/app/pfade'

export type Bereich = Parameters<typeof PFADE.einstellungen>[0] & string

export type BereichEintrag = { key: Bereich; label: string; beschreibung: string; taste: string }

export const BEREICHE: readonly BereichEintrag[] = [
  { key: 'profil', label: 'Profil', beschreibung: 'Kürzel, LinkedIn-Plan, Rufnummer, Signatur, Kanäle', taste: '1' },
  { key: 'passcode', label: 'Passcode', beschreibung: 'Eigenen Passcode ändern, überall abmelden', taste: '2' },
  { key: 'ziele', label: 'Ziele', beschreibung: 'Tagesziel, Budget, KPI-Ziele, Feiertage', taste: '3' },
  { key: 'sequenzen', label: 'Sequenzen', beschreibung: 'Kadenzen aktivieren und bearbeiten', taste: '4' },
  { key: 'sperrliste', label: 'Sperrliste', beschreibung: 'Wer nie wieder kontaktiert wird', taste: '5' },
  { key: 'export', label: 'Export & Backup', beschreibung: 'CSV je Tabelle, Voll-Backup JSON', taste: '6' },
]

export const STANDARD_BEREICH: Bereich = 'profil'

export function istBereich(s: string | undefined): s is Bereich {
  return BEREICHE.some((b) => b.key === s)
}
