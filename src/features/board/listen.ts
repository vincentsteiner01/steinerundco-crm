// Die vier Listen des Boards (25.11.2026, Neustart als einfaches CRM). Reihenfolge = Reihenfolge auf dem Bildschirm.
// Gespeichert in crm.leads.board_liste; null heißt „nicht auf dem Board“ (alle Leads von vor dem Neustart).
export type BoardListe = 'angeschrieben' | 'gespraech' | 'im_geschaeft' | 'verloren'

export const BOARD_LISTEN: readonly { key: BoardListe; titel: string }[] = [
  { key: 'angeschrieben', titel: 'Angeschrieben' },
  { key: 'gespraech', titel: 'Gespräch vereinbart' },
  { key: 'im_geschaeft', titel: 'Im Geschäft' },
  { key: 'verloren', titel: 'Verloren' },
]

const TITEL = new Map<string, string>(BOARD_LISTEN.map((l) => [l.key, l.titel]))

export function istBoardListe(wert: unknown): wert is BoardListe {
  return typeof wert === 'string' && TITEL.has(wert)
}

/** Titel einer Liste („Gespräch vereinbart“); unbekannte Werte kommen unverändert zurück. */
export function listenTitel(liste: string): string {
  return TITEL.get(liste) ?? liste
}

/** Knopf auf der Karte: grün schiebt die Karte eine Station weiter, rot nach „Verloren“. */
export type KartenKnopf = { label: string; ziel: BoardListe; art: 'positiv' | 'negativ' }

const KEIN_INTERESSE: KartenKnopf = { label: 'Kein Interesse', ziel: 'verloren', art: 'negativ' }

/** Die Knöpfe je Liste (Auftrag der Inhaber). „Im Geschäft“ und „Verloren“ sind Endstationen ohne Knöpfe. */
export const KARTEN_KNOEPFE: Readonly<Record<BoardListe, readonly KartenKnopf[]>> = {
  angeschrieben: [{ label: 'Hat Interesse', ziel: 'gespraech', art: 'positiv' }, KEIN_INTERESSE],
  gespraech: [{ label: 'Im Geschäft', ziel: 'im_geschaeft', art: 'positiv' }, KEIN_INTERESSE],
  im_geschaeft: [],
  verloren: [],
}
