// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – M7 (Schnellimport: ⌘V ↑↓ H F – ⌫ ⌘Enter Esc; Assistent: Enter, Esc).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Schnellimport',
    eintraege: [
      { tasten: ['⌘V'], beschreibung: 'Liste einfügen' },
      { tasten: ['↑', '↓'], beschreibung: 'Zeile wählen' },
      { tasten: ['H', 'F', '–'], beschreibung: 'Anrede Herr · Frau · neutral' },
      { tasten: ['⌫'], beschreibung: 'Zeile entfernen' },
      { tasten: ['⌘↵'], beschreibung: 'Übernehmen' },
      { tasten: ['Esc'], beschreibung: 'Abbrechen (Entwurf bleibt)' },
    ],
  },
  {
    gruppe: 'Import-Assistent',
    eintraege: [
      { tasten: ['↵'], beschreibung: 'Weiter · Prüfen · Importieren' },
      { tasten: ['Esc'], beschreibung: 'Zurück' },
    ],
  },
]
