// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – M6; Tasten nur aus Anhang A (/ J K ↵ C E ⌘↵ [).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Leitfäden',
    eintraege: [
      { tasten: ['/'], beschreibung: 'Leitfaden suchen' },
      { tasten: ['J', 'K'], beschreibung: 'Leitfaden wählen (Baum)' },
      { tasten: ['↵'], beschreibung: 'Leitfaden öffnen' },
      { tasten: ['C'], beschreibung: 'Vorschau kopieren' },
      { tasten: ['E'], beschreibung: 'Text bearbeiten' },
      { tasten: ['⌘↵'], beschreibung: 'Leitfaden speichern' },
      { tasten: ['['], beschreibung: 'Platzhalter einfügen (im Editor)' },
    ],
  },
]
