// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Tasten von M5 (§ 3.6: ← → Zeitraum, 1 2 3 Person, Enter → Peek).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'KPIs',
    eintraege: [
      { tasten: ['←', '→'], beschreibung: 'Zeitraum zurück · vor' },
      { tasten: ['1', '2', '3'], beschreibung: 'Person: Vincent · Mike · Team' },
      { tasten: ['↵'], beschreibung: 'Lead im Peek öffnen (Ohne Bewegung)' },
      { tasten: ['W', 'B'], beschreibung: 'Wiedervorlage · Beenden (Zeile unter dem Cursor)' },
    ],
  },
]
