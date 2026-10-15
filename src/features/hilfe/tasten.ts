// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Hilfe und Tour (Integration: in src/app/tasten.ts aufnehmen).
// Nur Tasten außerhalb von VERBOTEN; G S ist in GlobaleTasten belegt, → ← Esc gelten nur, solange eine Tour läuft.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Hilfe & Tour',
    eintraege: [
      { tasten: ['G S'], beschreibung: 'Hilfe öffnen' },
      { tasten: ['/'], beschreibung: 'Hilfe durchsuchen' },
      { tasten: ['→', '↵'], beschreibung: 'Tour: weiter' },
      { tasten: ['←'], beschreibung: 'Tour: zurück' },
      { tasten: ['Esc'], beschreibung: 'Tour überspringen' },
    ],
  },
]
