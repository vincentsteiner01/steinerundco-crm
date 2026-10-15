// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – M3 (Scope liste und anruf, ux § 5.3/§ 5.4, Anhang A).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Telefon – Anrufliste',
    eintraege: [
      { tasten: ['J', 'K', '↓', '↑'], beschreibung: 'Zeile wählen' },
      { tasten: ['↵'], beschreibung: 'Anrufen · Call-Block starten' },
      { tasten: ['R'], beschreibung: 'Zeile heute aus der Liste entfernen' },
      { tasten: ['S'], beschreibung: 'Später (Versuch oder Rückruf verschieben)' },
      { tasten: ['N'], beschreibung: 'Notiz' },
      { tasten: ['⌘⇧K'], beschreibung: 'Anrufen (Lead-Zeile, Peek)' },
    ],
  },
  {
    gruppe: 'Anruf-Screen',
    eintraege: [
      { tasten: ['↵'], beschreibung: 'Anrufen · Weiter' },
      { tasten: ['1–9 0 X W K Q D'], beschreibung: 'Ergebnis' },
      { tasten: ['N'], beschreibung: 'Notiz fokussieren' },
      { tasten: ['Tab', '⇧Tab'], beschreibung: 'Skript-Phase weiter · zurück' },
      { tasten: ['⌘⇧X'], beschreibung: 'Überspringen (ans Listenende, kein Versuch)' },
      { tasten: ['⌘↵'], beschreibung: 'Weiter ohne Wrap-up' },
      { tasten: ['Esc'], beschreibung: 'Anruf ohne Ergebnis verwerfen (Bestätigung)' },
    ],
  },
]
