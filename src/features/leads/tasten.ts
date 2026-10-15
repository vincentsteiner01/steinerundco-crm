// BAUPLAN § 3.1.8 – Tasten der Leads-Tabelle und des Peeks (ux § 5.3 mit § 1.5 Nr. 23); nur Anhang A, nie VERBOTEN.
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Leads',
    eintraege: [
      { tasten: ['J', 'K'], beschreibung: 'Zeile vor · zurück (im Peek: Lead wechseln)' },
      { tasten: ['↵', '⌘↵'], beschreibung: 'Peek öffnen · Vollansicht' },
      { tasten: ['Space', '⇧↓', '⌘A'], beschreibung: 'Auswählen · Bereich · alle sichtbaren' },
      { tasten: ['E', 'Tab'], beschreibung: 'Zelle bearbeiten · nächste editierbare Zelle' },
      { tasten: ['⌥B'], beschreibung: 'Bulk-Menü (mit Auswahl)' },
      { tasten: ['⌫'], beschreibung: 'Filter zurücksetzen' },
      { tasten: ['O'], beschreibung: 'LinkedIn-Profil öffnen' },
      { tasten: ['Esc'], beschreibung: 'Peek schließen · Auswahl aufheben' },
    ],
  },
]
