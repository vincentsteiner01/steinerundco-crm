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
  /** Passender Zeitraum-Parameter der KPI-Seite (Link „In den KPIs ansehen“) */
  kpiZeitraum: string
}

export const TEAM_ZEITRAEUME: { key: TeamZeitraumArt; label: string; taste: string }[] = [
  { key: 'heute', label: 'Heute', taste: '1' },
  { key: 'woche', label: 'Woche', taste: '2' },
  { key: 'monat', label: 'Monat', taste: '3' },
]

/** Standard ohne Parameter: die laufende Woche (genug Bewegung für einen Vergleich, anders als „Heute“ am Morgen). */
export const STANDARD_ZEITRAUM: TeamZeitraumArt = 'woche'

export function parseTeamZeitraum(s: string | null): TeamZeitraumArt {
  return s === 'heute' || s === 'woche' || s === 'monat' ? s : STANDARD_ZEITRAUM
}

export function teamZeitraum(art: TeamZeitraumArt, heute: Tag): TeamZeitraum {
  if (art === 'heute') {
    return { art, von: heute, bis: heute, label: 'Heute', monatszaehler: false, kpiZeitraum: 'custom' }
  }
  if (art === 'woche') {
    const k = kwVon(heute)
    const s = kwSpanne(k.jahr, k.nr)
    return { art, ...s, label: `KW ${k.nr}`, monatszaehler: false, kpiZeitraum: `kw${k.nr}` }
  }
  const key = monatVon(heute)
  return { art, ...monatsSpanne(key), label: monatLabel(key), monatszaehler: true, kpiZeitraum: key }
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

/** Link auf die KPI-Seite mit derselben Spanne (Heute = eigener Zeitraum von heute bis heute). */
export function kpiLink(z: TeamZeitraum): string {
  const p = new URLSearchParams({ zeitraum: z.kpiZeitraum, person: 'team' })
  if (z.kpiZeitraum === 'custom') {
    p.set('von', z.von)
    p.set('bis', z.bis)
  }
  return `/kpis?${p.toString()}`
}

/** Erster Tag des Monats von `tag` – Ladebeginn der Kennzahlen (Sheet-Monatszeilen liegen auf dem 1.). */
export const monatsanfang = (tag: Tag): Tag => `${tag.slice(0, 7)}-01`
