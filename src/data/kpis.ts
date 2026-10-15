// BAUPLAN § 3.1.6 kpis.ts: useFunnelMonatlich(member | 'team', monthKey), useFunnelZeitraum (Summen über v_metric_events),
// useAntwortzeit, useDailyActivity. § 7: `member = 'team'` = beide Personen summiert.
import { useQuery } from '@tanstack/react-query'
import type { Antwortzeit, DailyActivity, FunnelMonat, Metric, MetricEvent } from '@/types/domain'
import { pruefe, useAlleSeiten, zeitraumGrenzen, type AlleSeiten } from './_helfer'
import { qk } from './queryKeys'
import { supabase } from './supabase'

const quote = (z: number | null, n: number | null, faktor = 1, stellen = 4): number | null =>
  n ? Number((((z ?? 0) * faktor) / n).toFixed(stellen)) : null

const ZAEHL_FELDER = [
  'vernetzungen_versendet',
  'vernetzungen_angenommen',
  'ausstehend',
  'gespraeche_eroeffnet',
  'dm_beantwortet',
  'erstgespraech_gepitcht',
  'erstgespraeche_vereinbart',
  'erstgespraeche',
  'strategiegespraeche',
  'kunden_gewonnen',
  'erstgespraech_no_show',
  'erstgespraech_abgesagt',
  'strategiegespraech_no_show',
  'strategiegespraech_abgesagt',
  'anrufe',
  'anrufe_erreicht',
  'entscheider_gespraeche',
  'termine_telefon',
  'emails_gesendet',
] as const satisfies readonly (keyof FunnelMonat)[]

/** Summiert Funnel-Zeilen (Team) und rechnet die Quoten wie v_funnel_monthly neu. */
export function summiereFunnel(zeilen: FunnelMonat[], monthKey: string): FunnelMonat | null {
  if (!zeilen.length) return null
  const s = { ...(zeilen[0] as FunnelMonat), member_id: null, month_key: monthKey }
  for (const f of ZAEHL_FELDER) s[f] = zeilen.reduce((acc, z) => acc + (z[f] ?? 0), 0)
  s.annahme_quote = quote(s.vernetzungen_angenommen, s.vernetzungen_versendet)
  s.antwort_quote = quote(s.dm_beantwortet, s.gespraeche_eroeffnet)
  s.pitch_quote = quote(s.erstgespraech_gepitcht, s.dm_beantwortet)
  s.erstgespraech_quote = quote(s.erstgespraeche, s.erstgespraech_gepitcht)
  s.strategiegespraech_quote = quote(s.strategiegespraeche, s.erstgespraeche)
  s.kunden_quote = quote(s.kunden_gewonnen, s.strategiegespraeche)
  s.connect_rate = quote(s.anrufe_erreicht, s.anrufe)
  s.entscheider_quote = quote(s.entscheider_gespraeche, s.anrufe)
  s.termine_pro_100_anrufe = quote(s.termine_telefon, s.anrufe, 100, 2)
  return s
}

/** `monthKey = null` → keine Anfrage (z. B. KPIs außerhalb der Monatsansicht; FOUNDATION-WUNSCH M5). */
export function useFunnelMonatlich(member: string | 'team', monthKey: string | null) {
  return useQuery({
    queryKey: qk.kpis.funnel(member, monthKey ?? '–'),
    enabled: !!monthKey,
    queryFn: async (): Promise<FunnelMonat | null> => {
      const key = monthKey as string
      let q = supabase.from('v_funnel_monthly').select('*').eq('month_key', key)
      if (member !== 'team') q = q.eq('member_id', member)
      const zeilen = pruefe(await q)
      return member === 'team' ? summiereFunnel(zeilen, key) : (zeilen[0] ?? null)
    },
  })
}

export type MetricEventZeile = Pick<MetricEvent, 'member_id' | 'day' | 'metric' | 'value' | 'source' | 'period'>

/**
 * Zeilen von `v_metric_events` je Zeitraum/Person **mit** `period`/`source` (Monatszähler-Regel § 3.6: Sheet-Werte nur in der
 * Monatsansicht; Badge „aus Sheet“, K-09). Alle Seiten à 500; Key verlängert `qk.kpis.zeitraum`.
 */
export function useMetricEventZeilen(member: string | 'team', von: string, bis: string): AlleSeiten<MetricEventZeile> {
  return useAlleSeiten<MetricEventZeile>([...qk.kpis.zeitraum(member, von, bis), 'zeilen'], async (v, b) => {
    let q = supabase
      .from('v_metric_events')
      .select('member_id, day, metric, value, source, period')
      .gte('day', von)
      .lte('day', bis)
    if (member !== 'team') q = q.eq('member_id', member)
    return pruefe(
      await q
        .order('day', { ascending: true })
        .order('metric', { ascending: true })
        .order('member_id', { ascending: true })
        .range(v, b),
    )
  })
}

export type FunnelSummen = Partial<Record<Metric, number>>

/** Summen je Metrik über einen Zeitraum (Kalendertage, inkl. `bis`). */
export function useFunnelZeitraum(member: string | 'team', von: string, bis: string) {
  return useQuery({
    queryKey: qk.kpis.zeitraum(member, von, bis),
    queryFn: async (): Promise<FunnelSummen> => {
      let q = supabase.from('v_metric_events').select('*').gte('day', von).lte('day', bis)
      if (member !== 'team') q = q.eq('member_id', member)
      const zeilen: MetricEvent[] = pruefe(await q.range(0, 999))
      const summen: FunnelSummen = {}
      for (const z of zeilen) if (z.metric) summen[z.metric] = (summen[z.metric] ?? 0) + (z.value ?? 0)
      return summen
    },
  })
}

/** Antwortzeiten (Werktage) je eingehender Nachricht im Zeitraum (`inbound_at`); M5 bildet den Durchschnitt. */
export function useAntwortzeit(member: string | 'team', von: string, bis: string) {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  return useQuery({
    queryKey: qk.kpis.antwortzeit(member, von, bis),
    queryFn: async (): Promise<Antwortzeit[]> => {
      let q = supabase.from('v_antwortzeit').select('*').gte('inbound_at', ab).lt('inbound_at', vor)
      if (member !== 'team') q = q.eq('member_id', member)
      return pruefe(await q.range(0, 999))
    },
  })
}

/** Tageswerte (v_daily_activity) je Mitglied oder Team im Zeitraum. */
export function useDailyActivity(member: string | 'team', von: string, bis: string) {
  return useQuery({
    queryKey: [...qk.kpis.all, 'daily', member, von, bis],
    queryFn: async (): Promise<DailyActivity[]> => {
      let q = supabase.from('v_daily_activity').select('*').gte('day', von).lte('day', bis)
      if (member !== 'team') q = q.eq('member_id', member)
      return pruefe(await q.order('day', { ascending: true }).range(0, 999))
    },
  })
}
