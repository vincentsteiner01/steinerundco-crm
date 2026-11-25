// Bereiche der Einstellungen (BAUPLAN § 3.9, Route `/einstellungen/:bereich`). v1.1: phasen · tags · icp · rechtliches.
import type { PFADE } from '@/app/pfade'

/** Bereiche = Union von `PFADE.einstellungen` (seit Runde 3 inkl. 'verbindungen'); Pfade baut `PFADE.einstellungen(b)`. */
export type Bereich = Parameters<typeof PFADE.einstellungen>[0] & string

export type BereichEintrag = { key: Bereich; label: string; beschreibung: string }

export const BEREICHE: readonly BereichEintrag[] = [
  { key: 'profil', label: 'Profil', beschreibung: 'Kürzel, LinkedIn-Plan, Rufnummer, Signatur, Kanäle' },
  { key: 'passcode', label: 'Passcode', beschreibung: 'Eigenen Passcode ändern, überall abmelden' },
  { key: 'ziele', label: 'Ziele', beschreibung: 'Tagesziel, Budget, KPI-Ziele, Feiertage' },
  { key: 'sequenzen', label: 'Sequenzen', beschreibung: 'Kadenzen aktivieren und bearbeiten' },
  { key: 'sperrliste', label: 'Sperrliste', beschreibung: 'Wer nie wieder kontaktiert wird' },
  { key: 'export', label: 'Export & Backup', beschreibung: 'CSV je Tabelle, Voll-Backup JSON' },
  {
    key: 'verbindungen',
    label: 'Verbindungen',
    beschreibung: 'LinkedIn-Mails aus Gmail, Chrome-Erweiterung, Eingang',
  },
]

export const STANDARD_BEREICH: Bereich = 'profil'

export function istBereich(s: string | undefined): s is Bereich {
  return BEREICHE.some((b) => b.key === s)
}
