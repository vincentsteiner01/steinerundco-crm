// Vertrag (BAUPLAN § 3.1.8): `export const TASTEN: TastenGruppe[]` – Tasten M4 (§ 3.5, Anhang A); nur aus Anhang A, nie aus VERBOTEN.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'E-Mail',
    eintraege: [
      { tasten: ['⌘↵'], beschreibung: 'In Gmail öffnen (Composer) · Ja im Prompt „gesendet?“' },
      { tasten: ['Esc'], beschreibung: 'Composer schließen (Entwurf bleibt)' },
      { tasten: ['['], beschreibung: 'Platzhalter-Autovervollständigung im Text' },
      { tasten: ['⌘⇧E'], beschreibung: 'Vorlage wechseln' },
      { tasten: ['J', 'K'], beschreibung: 'Cursor in Fällig · Entwürfe · Gesendet' },
      { tasten: ['↵'], beschreibung: 'Verfassen / weiter bearbeiten (Fällig, Entwürfe) · Lead öffnen (Gesendet)' },
      { tasten: ['⌥M'], beschreibung: 'E-Mail verfassen an den Lead unter dem Cursor' },
    ],
  },
]
