// Team-Vergleich (Vincent | Mike): Kennzahlen je Person aus denselben Quellen wie die KPI-Seite – v_metric_events-Zeilen
// (Ereignisse mit kpi_relevant + Tageszähler; Sheet-Monatszähler nur in der Monatsansicht, summiereEvents aus features/kpis) –
// plus „Follow-ups gesendet“ aus activities (keine KPI-Metrik). Dazu Balkenanteile, „zuletzt aktiv“ und die Tagesgruppen des
// Team-Protokolls. Reine Funktionen.
import type { ActivityZeitraum } from '@/data/activities'
import type { MetricEventZeile } from '@/data/kpis'
import { ERLEDIGT_TYPEN as ERLEDIGT_TYPEN_DATEN } from '@/data/tagesbilanz'
import { summiereEvents } from '@/features/kpis/kennzahlen'
import { fmtDatumKurz, fmtZeit } from '@/lib/format'
import { berlinTag, tagPlus, type Tag } from '@/lib/zeit'
import type { ActivityType, Metric } from '@/types/domain'

export type TeamMetrikKey =
  'anfragen' | 'annahmen' | 'eroeffnet' | 'followups' | 'antworten' | 'anrufe' | 'termine' | 'emails'

export type TeamMetrik = {
  key: TeamMetrikKey
  label: string
  /** Erklärung (title): woher die Zahl kommt */
  hinweis: string
  /** Quelle: KPI-Metrik aus v_metric_events oder Aktivitäten `nachricht_gesendet` */
  metric: Metric | null
}

export const TEAM_METRIKEN: readonly TeamMetrik[] = [
  {
    key: 'anfragen',
    label: 'Anfragen versendet',
    hinweis: 'LinkedIn-Vernetzungsanfragen (Tageszähler, im Monat auch Sheet-Werte) – wie KPIs „Vernetzung versendet“',
    metric: 'vernetzungen_versendet',
  },
  {
    key: 'annahmen',
    label: 'Annahmen',
    hinweis: 'Angenommene Vernetzungsanfragen – wie KPIs „Angenommen“',
    metric: 'vernetzungen_angenommen',
  },
  {
    key: 'eroeffnet',
    label: 'Gespräche eröffnet',
    hinweis: 'Gesendete Gesprächseröffnungen (erste DM) – wie KPIs „Gespräche eröffnet“',
    metric: 'gespraeche_eroeffnet',
  },
  {
    key: 'followups',
    label: 'Follow-ups gesendet',
    hinweis: 'Nachrichten nach der Gesprächseröffnung: Sequenz-Follow-ups und Antworten im Gespräch',
    metric: null,
  },
  {
    key: 'antworten',
    label: 'Antworten erhalten',
    hinweis: 'Leads, die auf eine DM geantwortet haben (erste Antwort je Lead) – wie KPIs „DM beantwortet“',
    metric: 'dm_beantwortet',
  },
  {
    key: 'anrufe',
    label: 'Anrufe',
    hinweis: 'Ausgehende Anrufe (Dials); darunter, wie viele erreicht wurden',
    metric: 'anrufe',
  },
  {
    key: 'termine',
    label: 'Termine vereinbart',
    hinweis: 'Gebuchte Erstgespräche nach Buchungsdatum – wie KPIs „vereinbart“',
    metric: 'erstgespraeche_vereinbart',
  },
  {
    key: 'emails',
    label: 'E-Mails gesendet',
    hinweis: 'Gesendete und bestätigte E-Mails – wie KPIs „E-Mails gesendet“',
    metric: 'emails_gesendet',
  },
]

/** Aktivitätstyp hinter „Follow-ups gesendet“. */
export const FOLLOWUP_TYPEN: ActivityType[] = ['nachricht_gesendet']

/**
 * „Heute erledigt“ je Person – EINE Liste mit dem Heute-Kopf (`src/data/tagesbilanz.ts`, Runde 3). Kopie als veränderbares Array,
 * weil `useActivitiesZeitraum` es so erwartet; gleiche Reihenfolge → gleicher Query-Key wie `useErledigtHeute`.
 */
export const ERLEDIGT_TYPEN: ActivityType[] = [...ERLEDIGT_TYPEN_DATEN]

export type PersonWerte = {
  werte: Record<TeamMetrikKey, number>
  /** Davon erreicht (Anrufe) */
  erreicht: number
  /** Kennzahlen, deren Wert ausschließlich aus Sheet-Monatszählern stammt (Badge „aus Sheet“) */
  nurSheet: Set<TeamMetrikKey>
  /** Im geladenen Monat liegen Sheet-Monatswerte dieser Person: Einzelereignisse zählen dort nicht (kpi_relevant) */
  sheetMonat: boolean
}

export type Spanne = { von: Tag; bis: Tag; monatszaehler: boolean }

/** Werte einer Person im Zeitraum. `zeilen` darf breiter geladen sein (ab Monatsanfang); gezählt wird nur [von, bis]. */
export function werteJePerson(
  memberId: string,
  zeilen: readonly MetricEventZeile[],
  followups: readonly Pick<ActivityZeitraum, 'member_id' | 'occurred_at' | 'type'>[],
  z: Spanne,
): PersonWerte {
  const eigene = zeilen.filter((r) => r.member_id === memberId)
  const imZeitraum = eigene.filter((r) => !!r.day && r.day >= z.von && r.day <= z.bis)
  const { summen, nurSheet } = summiereEvents(imZeitraum, z.monatszaehler)
  const werte = {} as Record<TeamMetrikKey, number>
  const sheet = new Set<TeamMetrikKey>()
  for (const m of TEAM_METRIKEN) {
    if (m.metric) {
      werte[m.key] = summen[m.metric] ?? 0
      if (nurSheet.has(m.metric)) sheet.add(m.key)
    } else {
      werte[m.key] = followups.filter((a) => a.member_id === memberId && FOLLOWUP_TYPEN.includes(a.type)).length
    }
  }
  return {
    werte,
    erreicht: summen.anrufe_erreicht ?? 0,
    nurSheet: sheet,
    sheetMonat: eigene.some((r) => r.period === 'monat'),
  }
}

/** Erledigt heute je Person (Anzahl Aktivitäten der Erledigt-Typen). */
export function erledigtJePerson(
  memberId: string,
  aktivitaeten: readonly Pick<ActivityZeitraum, 'member_id' | 'type'>[],
): number {
  return aktivitaeten.filter((a) => a.member_id === memberId && ERLEDIGT_TYPEN.includes(a.type)).length
}

/** Balkenanteile 0…1 relativ zum größeren Wert (Schmetterlingsbalken: links Vincent, rechts Mike). */
export function anteile(links: number, rechts: number): { links: number; rechts: number } {
  const max = Math.max(links, rechts, 0)
  if (max <= 0) return { links: 0, rechts: 0 }
  return { links: Math.max(links, 0) / max, rechts: Math.max(rechts, 0) / max }
}

const NBSP = '\u00A0'

/**
 * „zuletzt aktiv“: `gerade eben` · `vor 4 Min.` · `vor 3 Std.` (gleicher Tag) · `gestern, 17:02` · `Mo 12.10.`;
 * ohne Aktivität `noch nichts erfasst`.
 */
export function zuletztAktiv(iso: string | null | undefined, jetzt: Date = new Date()): string {
  if (!iso) return 'noch nichts erfasst'
  const d = new Date(iso)
  const ms = jetzt.getTime() - d.getTime()
  if (!Number.isFinite(ms)) return 'noch nichts erfasst'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min}${NBSP}Min.`
  const tag = berlinTag(d)
  const heute = berlinTag(jetzt)
  if (tag === heute) return `vor ${Math.floor(min / 60)}${NBSP}Std.`
  if (tag === tagPlus(heute, -1)) return `gestern, ${fmtZeit(d)}`
  return fmtDatumKurz(d)
}

/** Jüngster Zeitpunkt aus den Kandidaten (ISO-Strings), `null` ohne Werte. */
export function juengster(...kandidaten: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const k of kandidaten) {
    if (!k) continue
    const ms = new Date(k).getTime()
    if (Number.isFinite(ms) && ms > bestMs) {
      best = k
      bestMs = ms
    }
  }
  return best
}

export type TagGruppe<T> = { tag: Tag; label: string; zeilen: T[] }

/** Tagesgruppen (neueste zuerst, Reihenfolge der Eingabe bleibt): „Heute“ · „Gestern“ · „Mo 12.10.“. */
export function nachTagen<T extends { occurred_at: string }>(zeilen: readonly T[], heute: Tag): TagGruppe<T>[] {
  const gruppen: TagGruppe<T>[] = []
  for (const z of zeilen) {
    const tag = berlinTag(z.occurred_at)
    let g = gruppen[gruppen.length - 1]
    if (!g || g.tag !== tag) {
      const label = tag === heute ? 'Heute' : tag === tagPlus(heute, -1) ? 'Gestern' : fmtDatumKurz(z.occurred_at)
      g = { tag, label, zeilen: [] }
      gruppen.push(g)
    }
    g.zeilen.push(z)
  }
  return gruppen
}
