// „Erledigt heute“ – eine Zählweise für Heute-Kopf und Team-Vergleich (Runde 3; vorher zwei Listen: Heute 6 Typen + abgehakte
// Zeilen nur in der Sitzung, Team 10 Typen). Fällig/Überfällig kommen aus `zaehleQueue`/`useQueueZaehler` (queue.ts).
import type { ActivityType } from '@/types/domain'
import { berlinTag, heuteBerlin } from './_helfer'
import { useActivitiesZeitraum, type ActivityZeitraum } from './activities'

/**
 * Erledigt = Arbeit, die eine Person heute getan hat: gesendet (Opener, Nachricht, Pitch, Mail), Aufgabe erledigt, Schritt
 * übersprungen, Anruf, Vernetzung angefragt/angenommen abgehakt/zurückgezogen. Dauerhaft aus `crm.activities` (überlebt Reload).
 * Nicht: Antworten anderer, Notizen, Stufenwechsel, verschobene Schritte („später“ zählt der Heute-Kopf getrennt).
 */
export const ERLEDIGT_TYPEN: readonly ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'aufgabe_erledigt',
  'schritt_uebersprungen',
  'anruf',
  'vernetzung_gesendet',
  'vernetzung_angenommen',
  'vernetzung_zurueckgezogen',
]

type ErledigtZeile = Pick<ActivityZeitraum, 'type' | 'member_id' | 'occurred_at'>

/** Zählt Erledigt-Zeilen; `memberId` = nur diese Person (sonst alle), `tag` = nur dieser Kalendertag Europe/Berlin (sonst alle). */
export function zaehleErledigt(zeilen: readonly ErledigtZeile[], memberId?: string | null, tag?: string): number {
  let n = 0
  for (const a of zeilen) {
    if (!ERLEDIGT_TYPEN.includes(a.type)) continue
    if (memberId && a.member_id !== memberId) continue
    if (tag && berlinTag(new Date(a.occurred_at)) !== tag) continue
    n += 1
  }
  return n
}

export type ErledigtHeute = { anzahl: number; jePerson: Map<string, number>; istLaden: boolean }

/** Erledigt heute einer Person (`memberId`) oder des Teams (`null` → je Person in `jePerson`). */
export function useErledigtHeute(memberId: string | null | undefined, tag: string = heuteBerlin()): ErledigtHeute {
  const r = useActivitiesZeitraum(memberId ?? 'team', tag, tag, [...ERLEDIGT_TYPEN])
  const jePerson = new Map<string, number>()
  for (const a of r.data) {
    if (!a.member_id || !ERLEDIGT_TYPEN.includes(a.type)) continue
    jePerson.set(a.member_id, (jePerson.get(a.member_id) ?? 0) + 1)
  }
  return { anzahl: zaehleErledigt(r.data, memberId ?? null), jePerson, istLaden: r.istLaden }
}
