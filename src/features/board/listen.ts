// Die vier Listen des Boards (25.11.2026, Neustart als einfaches CRM). Reihenfolge = Reihenfolge auf dem Bildschirm.
// Gespeichert in crm.leads.board_liste; null heißt „nicht auf dem Board“ (alle Leads von vor dem Neustart).
export type BoardListe = 'angeschrieben' | 'gespraech' | 'im_geschaeft' | 'verloren'

export const BOARD_LISTEN: readonly { key: BoardListe; titel: string }[] = [
  { key: 'angeschrieben', titel: 'Angeschrieben' },
  { key: 'gespraech', titel: 'Gespräch vereinbart' },
  { key: 'im_geschaeft', titel: 'Im Geschäft' },
  { key: 'verloren', titel: 'Verloren' },
]
