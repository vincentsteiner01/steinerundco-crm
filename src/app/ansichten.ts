// System-Ansichten der Leads-Tabelle (ux § 3.2.3; v1 nur diese, § 1.3 Nr. 2). Hier nur Key + Name für Palette (`*`) und Links
// (`/leads?ansicht=<key>`); die Filterdefinitionen baut M2 in `features/leads/` – die Keys sind der URL-Vertrag und bleiben.
export type SystemAnsicht = { key: string; name: string }

export const SYSTEM_ANSICHTEN: readonly SystemAnsicht[] = [
  { key: 'alle', name: 'Alle' },
  { key: 'meine', name: 'Meine' },
  { key: 'faellig', name: 'Fällig' },
  { key: 'ueberfaellig', name: 'Überfällig' },
  { key: 'antwort_offen', name: 'Antwort offen' },
  { key: 'angefragt', name: 'Angefragt' },
  { key: 'abgelaufen', name: 'Zurückziehen' },
  { key: 'in_gespraech', name: 'In Gespräch' },
  { key: 'termine', name: 'Termine' },
  { key: 'wiedervorlage', name: 'Wiedervorlage' },
  { key: 'beendet', name: 'Beendet' },
  { key: 'frei', name: 'Freigegeben' },
  { key: 'ohne_unternehmen', name: 'Unvollständig' },
  { key: 'anrufliste', name: 'Anrufliste' },
  { key: 'ohne_nummer', name: 'Ohne Telefonnummer' },
  { key: 'papierkorb', name: 'Papierkorb' },
]
