// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Tasten nur aus Anhang A, nie aus VERBOTEN.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Einstellungen',
    eintraege: [
      {
        tasten: ['1', '2', '3', '4', '5', '6'],
        beschreibung: 'Bereich: Profil · Passcode · Ziele · Sequenzen · Sperrliste · Export',
      },
      { tasten: ['⌘↵'], beschreibung: 'Block speichern' },
      { tasten: ['N'], beschreibung: 'Sperrliste: Eintrag hinzufügen' },
      { tasten: ['J', 'K', '↵'], beschreibung: 'Sperrliste: Cursor · Eintrag entfernen' },
      { tasten: ['B'], beschreibung: 'Export: Voll-Backup JSON' },
      { tasten: ['Esc'], beschreibung: 'Sequenz-Editor schließen · Dialog abbrechen' },
    ],
  },
]
