// Reine Helfer des Boards (25.11.2026): Name auf der Karte, Suche und Personen-Filter (beide filtern nur die Anzeige),
// Aufteilung auf die vier Listen. Die Reihenfolge kommt aus der Daten-Schicht (`board_seit desc`) und bleibt erhalten.
import type { BoardKarte } from '@/data/board'
import { PERSONEN } from '@/features/auth/personen'
import { anzeigeName, type NamensMitglied } from '@/lib/mitglied'
import { BOARD_LISTEN, type BoardListe } from './listen'

/** So viele Karten zeigt eine Liste zunächst; „Weitere anzeigen“ legt jeweils so viele nach. */
export const KARTEN_JE_SEITE = 50

/** Personen-Filter „Alle“. */
export const ALLE = 'alle'

export function kartenName(k: Pick<BoardKarte, 'full_name' | 'first_name' | 'last_name'>): string {
  return k.full_name?.trim() || [k.first_name, k.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen'
}

/** Für die Suche: klein und ohne Akzente/Umlautpunkte („muller“ findet „Müller“). */
const norm = (s: string | null | undefined): string =>
  (s ?? '').toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '')

export type BoardFilter = {
  suche: string
  /** Mitglieds-ID oder `ALLE`. */
  person: string
}

/** Suche über Name und Firma (jedes Wort muss vorkommen), dazu der Personen-Filter. */
export function filtereKarten(karten: readonly BoardKarte[], f: BoardFilter): BoardKarte[] {
  const worte = norm(f.suche).split(/\s+/).filter(Boolean)
  if (worte.length === 0 && f.person === ALLE) return [...karten]
  return karten.filter((k) => {
    if (f.person !== ALLE && k.owner_id !== f.person) return false
    if (worte.length === 0) return true
    const text = norm(`${kartenName(k)} ${k.company_name ?? ''}`)
    return worte.every((w) => text.includes(w))
  })
}

export function nachListen(karten: readonly BoardKarte[]): Record<BoardListe, BoardKarte[]> {
  const out = Object.fromEntries(BOARD_LISTEN.map((l) => [l.key, [] as BoardKarte[]])) as Record<
    BoardListe,
    BoardKarte[]
  >
  for (const k of karten) out[k.board_liste]?.push(k)
  return out
}

/** Mitglieder in der Reihenfolge des Auftrags (Vincent · Mike), Unbekannte dahinter nach Name. */
export function sortiereMitglieder<M extends NamensMitglied>(members: readonly M[] | null | undefined): M[] {
  const rang = (m: M): number => {
    const i = PERSONEN.findIndex((p) => p.name === anzeigeName(m))
    return i < 0 ? PERSONEN.length : i
  }
  return [...(members ?? [])].sort((a, b) => rang(a) - rang(b) || anzeigeName(a).localeCompare(anzeigeName(b), 'de'))
}
