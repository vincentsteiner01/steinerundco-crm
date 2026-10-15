// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – Palette-Befehle der Team-Seite. Registrierung in src/app/befehle.ts
// macht die Integration (runde2-wuensche/team.md).
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'

export const BEFEHLE: Befehl[] = [
  {
    id: 'team-woche',
    label: 'Team: Vincent und Mike diese Woche',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.team}?zeitraum=woche`),
  },
  {
    id: 'team-heute',
    label: 'Team: heute',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.team}?zeitraum=heute`),
  },
  {
    id: 'team-monat',
    label: 'Team: dieser Monat',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.team}?zeitraum=monat`),
  },
  {
    id: 'team-protokoll-mike',
    label: 'Team-Protokoll: was macht Mike',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.team}?zeitraum=woche&person=mike`),
  },
  {
    id: 'team-protokoll-vincent',
    label: 'Team-Protokoll: was macht Vincent',
    gruppe: 'seiten',
    ausfuehren: ({ navigate }) => navigate(`${PFADE.team}?zeitraum=woche&person=vincent`),
  },
]
