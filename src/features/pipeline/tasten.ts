// BAUPLAN § 3.1.8 – Tasten der Pipeline (ux § 3.4, § 5.3); nur Anhang A, nie VERBOTEN.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Pipeline',
    eintraege: [
      { tasten: ['J', 'K'], beschreibung: 'Karte vor · zurück' },
      { tasten: ['H', 'L'], beschreibung: 'Spalte zurück · vor' },
      { tasten: ['⇧→', '⇧←'], beschreibung: 'Karte eine Phase vor · zurück (mit Pflichtangabe)' },
      { tasten: ['↵'], beschreibung: 'Lead im Peek öffnen' },
    ],
  },
]
