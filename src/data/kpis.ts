// KPI-Reiter (26.11.2026): Zeilen der Sicht crm.v_kpi_tage je Zeitraum und Person sowie die zwei Tageszähler
// (Vernetzungen versendet/angenommen), die einmal am Tag von Hand eingetragen werden (crm.daily_counters über crm.set_counter).
// Bewusst nicht im Barrel data/index.ts – nur der KPI-Reiter lädt diese Datei. Alle Keys beginnen mit qk.kpis.all.
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { KENNZAHLEN, leereSummen, type KpiZeile } from '@/features/kpis/kennzahlen'
import { istTag, type Tag } from '@/lib/zeit'
import type { Database } from '@/types/database'
import { pruefe, useAlleSeiten, type AlleSeiten } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

/** Zeile der Sicht, wie PostgREST sie typisiert (bei Sichten ist jede Spalte nullable). */
type KpiTageRoh = Database['crm']['Views']['v_kpi_tage']['Row']

/** Sicht-Zeile → KpiZeile: Zahlen sind laut Sicht nie null (hier trotzdem als 0 gelesen); eine Zeile ohne Tag fällt weg. */
export function alsKpiZeile(z: KpiTageRoh): KpiZeile | null {
  if (!istTag(z.tag)) return null
  const zeile: KpiZeile = {
    member_id: z.member_id,
    tag: z.tag,
    period: z.period === 'monat' ? 'monat' : 'tag',
    ...leereSummen(),
  }
  for (const k of KENNZAHLEN) zeile[k] = z[k] ?? 0
  return zeile
}

export function alsKpiZeilen(zeilen: readonly KpiTageRoh[]): KpiZeile[] {
  return zeilen.map(alsKpiZeile).filter((z): z is KpiZeile => z !== null)
}

/** Abfrage von v_kpi_tage; `hatDaten`: es sind Zeilen geladen – auch wenn das letzte Neuladen scheiterte. */
export type KpiAbfrage = AlleSeiten<KpiZeile> & { hatDaten: boolean }

/**
 * Zeilen von v_kpi_tage im Zeitraum (Kalendertage, inkl. `bis`), Seiten à 500; ohne `member` die aller Personen.
 * Ein Fehler ist es nur ohne Daten: Scheitert ein Neuladen im Hintergrund (Board-Zug, Realtime, Fensterfokus – etwa mit noch
 * fehlendem WLAN), bleiben die geladenen Zeilen stehen; der nächste Anlass lädt erneut.
 */
function useZeilen(
  key: QueryKey,
  von: Tag,
  bis: Tag,
  filter: { member?: string; period?: 'monat' },
  aktiv = true,
): KpiAbfrage {
  const qc = useQueryClient()
  const q = useAlleSeiten<KpiTageRoh>(
    key,
    async (v, b) => {
      let abfrage = supabase.from('v_kpi_tage').select('*').gte('tag', von).lte('tag', bis)
      if (filter.member) abfrage = abfrage.eq('member_id', filter.member)
      if (filter.period) abfrage = abfrage.eq('period', filter.period)
      return pruefe(
        await abfrage
          .order('tag', { ascending: true })
          .order('period', { ascending: true })
          .order('member_id', { ascending: true })
          .range(v, b),
      )
    },
    aktiv,
  )
  // useAlleSeiten meldet jeden Fehler der Abfrage; ob schon Zeilen da sind, steht im Cache (dieselbe Abfrage, eben gelesen).
  const hatDaten = qc.getQueryData(key) !== undefined
  // Erst nach dem Laden abbilden: ob eine weitere Seite folgt, hängt an der Zahl der geladenen Zeilen (useAlleSeiten).
  return { ...q, data: alsKpiZeilen(q.data), hatDaten, fehler: hatDaten ? null : q.fehler }
}

/**
 * Alle Zeilen von v_kpi_tage im Zeitraum (Kalendertage, inkl. `bis`); `member = 'team'` = alle Personen.
 * `aktiv = false` lädt nichts und liest nur, was schon geladen ist.
 */
export function useKpiZeilen(member: string | 'team', von: Tag, bis: Tag, aktiv = true): KpiAbfrage {
  const filter = member === 'team' ? {} : { member }
  return useZeilen([...qk.kpis.all, 'tage', member, von, bis], von, bis, filter, aktiv)
}

/**
 * Die alten Monatszähler ALLER Personen im Zeitraum. Steht in einem Monat einer, sind die Tageswerte dieser Kennzahl dort
 * unvollständig – auch für eine Person ohne eigenen Monatszähler (ihre Zeilen allein zeigen das nicht).
 */
export function useKpiMonatszaehler(von: Tag, bis: Tag, aktiv = true): KpiAbfrage {
  return useZeilen([...qk.kpis.all, 'monatszaehler', von, bis], von, bis, { period: 'monat' }, aktiv)
}

/** Die zwei Tageszähler einer Person an einem Tag; `null` = für den Tag noch nichts eingetragen. */
export type Tageszaehler = { versendet: number | null; angenommen: number | null }

const ZAEHLER = ['vernetzungen_versendet', 'vernetzungen_angenommen'] as const

/** Zeilen aus daily_counters (höchstens eine je Zähler) → Tageszaehler. */
export function alsTageszaehler(zeilen: readonly { metric: string; value: number | null }[]): Tageszaehler {
  const wert = (metric: (typeof ZAEHLER)[number]): number | null => {
    const z = zeilen.find((x) => x.metric === metric)
    return z ? (z.value ?? 0) : null
  }
  return { versendet: wert('vernetzungen_versendet'), angenommen: wert('vernetzungen_angenommen') }
}

export function useTageszaehler(memberId: string | null | undefined, tag: Tag) {
  return useQuery<Tageszaehler>({
    queryKey: [...qk.kpis.all, 'tageszaehler', memberId ?? '', tag],
    enabled: !!memberId,
    queryFn: async () =>
      alsTageszaehler(
        pruefe(
          await supabase
            .from('daily_counters')
            .select('metric, value')
            .eq('member_id', memberId as string)
            .eq('date', tag)
            .eq('period', 'tag')
            .in('metric', [...ZAEHLER]),
        ),
      ),
  })
}

/** Ganze Zahl ab 0 – set_counter nimmt `int` und schneidet selbst bei 0 ab. */
const ganz = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)

/** Was gespeichert wird: nur die genannten Zähler – ein weggelassener bleibt in der Datenbank, wie er ist. */
export type TageszaehlerEingabe = { tag: Tag; versendet?: number; angenommen?: number }

/**
 * Tageszähler für einen Tag speichern – nur die Zähler, die mitgegeben werden (ein nicht angefasstes Feld überschreibt so
 * nie einen gespeicherten Wert). Der Wert ist die Zahl des ganzen Tages – erneutes Eintragen ersetzt sie.
 * set_counter schreibt für die angemeldete Person. Danach lädt alles unter qk.kpis.all neu (Kacheln, Verlauf, Zähler).
 */
export function useTageszaehlerSpeichern() {
  const qc = useQueryClient()
  return useMutation<void, Error, TageszaehlerEingabe>({
    mutationFn: async (p) => {
      if (p.versendet !== undefined)
        await rpc.setCounter({ metric: 'vernetzungen_versendet', value: ganz(p.versendet), date: p.tag })
      if (p.angenommen !== undefined)
        await rpc.setCounter({ metric: 'vernetzungen_angenommen', value: ganz(p.angenommen), date: p.tag })
    },
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}
