// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Tasten des Feedbacks (Dialog und Seite /feedback).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Feedback',
    eintraege: [
      { tasten: ['⌥F'], beschreibung: 'Feedback geben (überall, mit Screenshot der Seite)' },
      { tasten: ['1', '2', '3'], beschreibung: 'Im Dialog: Fehler · Wunsch · Frage (in Feldern ⌥1–3)' },
      { tasten: ['⌘↵'], beschreibung: 'Im Dialog: senden · auf der Seite: Notiz speichern' },
      { tasten: ['J', 'K'], beschreibung: 'Meldungen: nächste · vorige' },
      { tasten: ['G B'], beschreibung: 'Zur Feedback-Seite' },
    ],
  },
]
