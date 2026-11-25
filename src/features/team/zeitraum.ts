// Team (/team?zeitraum=heute|woche|monat): Zeitraum aus der URL → Berliner Kalendertage. Woche = ISO-KW (Mo–So) und Monat =
// Kalendermonat wie auf der KPI-Seite (features/kpis/zeitraum), damit beide Seiten für dieselbe Spanne dieselben Zahlen zeigen.
import { kwSpanne, kwVon, monatsSpanne, monatVon, spanneText } from '@/features/kpis/zeitraum'
import { monatLabel } from '@/lib/format'
import type { Tag } from '@/lib/zeit'

export type TeamZeitraumArt = 'heute' | 'woche' | 'monat'

export type TeamZeitraum = {
  art: TeamZeitraumArt
  von: Tag
  bis: Tag
  /** „Heute“ · „KW 42“ · „Oktober 2026“ */
  label: string
  /** Sheet-Monatszähler (`period = 'monat'`) zählen nur in der Monatsansicht – Regel der KPI-Seite (§ 3.6) */
  monatszaehler: boolean
}

export const TEAM_ZEITRAEUME: { key: TeamZeitraumArt; label: string }[] = [
  { key: 'heute', label: 'Heute' },
  { key: 'woche', label: 'Woche' },
  { key: 'monat', label: 'Monat' },
]

/** Standard ohne Parameter: die laufende Woche (genug Bewegung für einen Vergleich, anders als „Heute“ am Morgen). */
export const STANDARD_ZEITRAUM: TeamZeitraumArt = 'woche'

export function parseTeamZeitraum(s: string | null): TeamZeitraumArt {
  return s === 'heute' || s === 'woche' || s === 'monat' ? s : STANDARD_ZEITRAUM
}

export function teamZeitraum(art: TeamZeitraumArt, heute: Tag): TeamZeitraum {
  if (art === 'heute') {
    return { art, von: heute, bis: heute, label: 'Heute', monatszaehler: false }
  }
  if (art === 'woche') {
    const k = kwVon(heute)
    const s = kwSpanne(k.jahr, k.nr)
    return { art, ...s, label: `KW ${k.nr}`, monatszaehler: false }
  }
  const key = monatVon(heute)
  return { art, ...monatsSpanne(key), label: monatLabel(key), monatszaehler: true }
}

/** Dateline-Spanne bis höchstens heute: „15.10.2026“ · „12.–15.10.2026“ · „01.–15.10.2026“. */
export function teamSpanne(z: TeamZeitraum, heute: Tag): string {
  const bis = z.bis < heute ? z.bis : heute
  if (z.von === bis) {
    const [j, m, t] = bis.split('-') as [string, string, string]
    return `${t}.${m}.${j}`
  }
  return spanneText(z.von, bis)
}

/** Erster Tag des Monats von `tag` – Ladebeginn der Kennzahlen (Sheet-Monatszeilen liegen auf dem 1.). */
export const monatsanfang = (tag: Tag): Tag => `${tag.slice(0, 7)}-01`
