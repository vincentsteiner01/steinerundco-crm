// Tastenliste „Heute“ fürs `?`-Overlay (BAUPLAN § 3.2 tasten.ts, Anhang A, ux § 5.3). Nur Tasten außerhalb von VERBOTEN
// (§ 1.5 Nr. 23: keine ⌘-Ziffern, kein ⌘R, kein ⌘⇧M/⌘⇧V).
import type { TastenGruppe } from '@/app/tasten'

export const TASTEN: TastenGruppe[] = [
  {
    gruppe: 'Heute',
    eintraege: [
      { tasten: ['J', 'K', '↓', '↑'], beschreibung: 'Karte wechseln (klappt auf)' },
      {
        tasten: ['↵'],
        beschreibung: 'Kopieren · Telefon-Karte: Anrufen · E-Mail-Karte: In Gmail öffnen · Abhakzeile: Peek',
      },
      { tasten: ['⌘↵'], beschreibung: 'Kopieren + Gesendet' },
      { tasten: ['C'], beschreibung: 'Gefüllten Text kopieren' },
      {
        tasten: ['E'],
        beschreibung: 'Gesendet · Erledigt · Angenommen · Anfrage gesendet · Zurückgezogen (je Sektion)',
      },
      { tasten: ['Space'], beschreibung: 'Abhaken (Annahme prüfen · Neue Anfragen · Zurückziehen)' },
      { tasten: ['⇧E'], beschreibung: 'Anfrage mit Notiz gesendet (Neue Anfragen)' },
      {
        tasten: ['S'],
        beschreibung: 'Später (1 morgen · 2 +3 T · 3 Montag · 4 +1 W · 5 +2 Mo · D Datum) · Antworten: morgen',
      },
      { tasten: ['N'], beschreibung: 'Notiz' },
      { tasten: ['A'], beschreibung: 'Antwort erhalten (1–9 Reaktion)' },
      { tasten: ['P'], beschreibung: 'Pitch gesendet (Antworten, Phase Beantwortet/Gepitcht)' },
      { tasten: ['T'], beschreibung: 'Termin eintragen' },
      { tasten: ['W'], beschreibung: 'Wiedervorlage · Wiedervorlage-Karte: weiter (+3 Monate)' },
      { tasten: ['B'], beschreibung: 'Beenden (Grund)' },
      { tasten: ['O'], beschreibung: 'Profil öffnen (neuer Tab)' },
      { tasten: ['X'], beschreibung: 'Abgelehnt (Annahme prüfen) · Passt nicht (Neue Anfragen)' },
      { tasten: ['D'], beschreibung: 'Datum der Annahme (Annahme prüfen)' },
      { tasten: ['1', '2', '3', '7'], beschreibung: 'Telefon-Karte: Schnell-Ergebnis · Meeting-Karte: 1–4 Status' },
      { tasten: ['⇧↓'], beschreibung: 'Bereich auswählen (Abhakzeilen), dann E/Space für alle · Esc hebt auf' },
      { tasten: ['⌥1', '⌥9'], beschreibung: 'Batch-Chip 1–9 · ⌥0 alle' },
      { tasten: ['⌥R'], beschreibung: 'Liste neu sortieren' },
      { tasten: ['⌥H'], beschreibung: 'Alle verschieben auf heute (Schritte ab −14 T)' },
      { tasten: ['⌥M'], beschreibung: 'E-Mail an den Lead der Karte' },
      { tasten: ['⌘⇧E'], beschreibung: 'Vorlage wechseln' },
      { tasten: ['+', '⇧+'], beschreibung: 'Zähler Anfragen heute +1 / +5' },
      { tasten: ['Z'], beschreibung: 'Rückgängig (6 s)' },
    ],
  },
]
