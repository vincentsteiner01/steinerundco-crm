// Reine Logik der Pipeline (ux § 3.4, DESIGN-SYSTEM § 5.12, P-01/P-07): eingeklappte Spalten (localStorage), Sortierung in der Spalte,
// Konversion zur Vorstufe aus dem Bestand und die Badge-Regel „n T ohne Bewegung“.
import type { LeadZeile } from '@/features/leads/spalten'
import { PHASEN, phaseVon } from '@/lib/stufen'
import { werktageZwischen } from '@/lib/werktage'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import type { Lead, PhaseKey } from '@/types/domain'

/** Badge-Regel ux § 3.4: Beantwortet/Gepitcht ab 5 Werktagen, andere ab 14 Kalendertagen; nie mit aktivem Sequenzschritt. */
export function ohneBewegungTage(
  l: Pick<Lead, 'stage' | 'last_activity_at' | 'created_at' | 'next_action_kind'>,
  heute: string,
  feiertage?: readonly string[],
): number | null {
  if (l.stage === 'beendet' || l.stage === 'kunde') return null
  if (l.next_action_kind === 'sequenz_schritt') return null
  const seit = berlinTag(l.last_activity_at ?? l.created_at)
  const phase = phaseVon(l.stage).key
  const tage = tageDifferenz(seit, heute)
  if (phase === 'beantwortet' || phase === 'gepitcht')
    return werktageZwischen(seit, heute, feiertage) >= 5 ? tage : null
  return tage >= 14 ? tage : null
}

const EINGEKLAPPT_KEY = 'crm.pipeline.eingeklappt'
const EINGEKLAPPT_STANDARD: PhaseKey[] = ['angefragt', 'wiedervorlage', 'beendet']

export function liesEingeklappt(): Set<PhaseKey> {
  try {
    const roh = localStorage.getItem(EINGEKLAPPT_KEY)
    const liste = roh ? (JSON.parse(roh) as unknown) : null
    if (Array.isArray(liste)) return new Set(liste.filter((k): k is PhaseKey => PHASEN.some((p) => p.key === k)))
  } catch {
    /* kein Storage */
  }
  return new Set(EINGEKLAPPT_STANDARD)
}

/** Sortierung in der Spalte (ux § 3.4): nächste Aktion ↑ (ohne zuletzt), dann Letzte Bewegung ↓. */
export function sortiereSpalte<T extends Pick<LeadZeile, 'next_action_at' | 'last_activity_at'>>(
  leads: readonly T[],
): T[] {
  return [...leads].sort((a, b) => {
    if (a.next_action_at && b.next_action_at && a.next_action_at !== b.next_action_at)
      return a.next_action_at.localeCompare(b.next_action_at)
    if (!!a.next_action_at !== !!b.next_action_at) return a.next_action_at ? -1 : 1
    return (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? '')
  })
}

/** Funnel-Spalten mit Konversion: Vernetzt (1) … Kunde (7). Wiedervorlage und Beendet sind Parkplätze, keine Folgestufe. */
export const LETZTE_FUNNEL_SPALTE = 7

/**
 * Konversion zur Vorstufe aus dem aktuellen Bestand (P-07, „19 / 82 = 23 %“): Leads dieser Spalte ÷ Leads der Spalte davor –
 * keine Periodenquote. Erste Spalte, Parkplätze (Wiedervorlage, Beendet) und leere Vorstufe → null.
 */
export function konversion(zaehler: readonly number[], i: number): number | null {
  if (i === 0 || i > LETZTE_FUNNEL_SPALTE) return null
  const vor = zaehler[i - 1] ?? 0
  const jetzt = zaehler[i] ?? 0
  return vor > 0 ? jetzt / vor : null
}

export function schreibeEingeklappt(s: ReadonlySet<PhaseKey>): void {
  try {
    localStorage.setItem(EINGEKLAPPT_KEY, JSON.stringify([...s]))
  } catch {
    /* kein Storage */
  }
}
