// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Tasten der Team-Seite (Registrierung in src/app/tasten.ts
// macht die Integration, runde2-wuensche/team.md).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Team',
    eintraege: [
      { tasten: ['G A'], beschreibung: 'Team öffnen' },
      { tasten: ['1', '2', '3'], beschreibung: 'Zeitraum: Heute · Woche · Monat' },
    ],
  },
]
