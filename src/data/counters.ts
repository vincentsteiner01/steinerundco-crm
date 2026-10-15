// BAUPLAN § 3.1.6 counters.ts: useCounters(memberId, von, bis) (View v_daily_activity), useCounterSetzen() (optimistisch, set_counter).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { DailyActivity, DailyCounter, Metric } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

export async function ladeCounters(memberId: string, von: string, bis: string): Promise<DailyActivity[]> {
  return pruefe(
    await supabase
      .from('v_daily_activity')
      .select('*')
      .eq('member_id', memberId)
      .gte('day', von)
      .lte('day', bis)
      .order('day', { ascending: true }),
  )
}

export function useCounters(memberId: string | null | undefined, von: string, bis: string) {
  return useQuery({
    queryKey: qk.counters(memberId ?? '', von, bis),
    enabled: !!memberId,
    queryFn: () => ladeCounters(memberId as string, von, bis),
  })
}

export type CounterEingabe = { metric: Metric; value: number; date: string; memberId: string; delta?: boolean }

/** Tageszähler setzen (`set_counter`); optimistisch in allen gecachten `counters`-Zeiträumen. */
export function useCounterSetzen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CounterEingabe) => rpc.setCounter(p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ['counters'] })
      const vorher = qc.getQueriesData<DailyActivity[]>({ queryKey: ['counters'] })
      qc.setQueriesData<DailyActivity[]>({ queryKey: ['counters'] }, (alt) =>
        alt?.map((z) => {
          if (z.member_id !== p.memberId || z.day !== p.date || !(p.metric in z)) return z
          const feld = p.metric as keyof DailyActivity
          const bisher = (z[feld] as number | null) ?? 0
          return { ...z, [feld]: p.delta ? bisher + p.value : p.value }
        }),
      )
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      for (const [key, daten] of ctx?.vorher ?? []) qc.setQueryData(key, daten)
      mutationFehler(e)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['counters'] })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}

export type TageswertEingabe = {
  metric: Metric
  /** Neuer Tageswert (getrackt + manuell), z. B. Direkteingabe „40“ */
  ziel: number
  /** Aktueller Tageswert aus `v_daily_activity` */
  aktuell: number
  /** Getrackter Anteil (Ereignisse); der Tageswert fällt nie darunter */
  getrackt: number
  date: string
  memberId: string
}

/**
 * Tageswert setzen (H-11, FOUNDATION-WUNSCH M1): `set_counter` schreibt nur den manuellen Anteil, die View addiert die
 * getrackten Ereignisse. Deshalb geht die Eingabe als Delta auf den aktuellen Wert: manuell_neu = Ziel − getrackt
 * (40 bei 12 getrackten → manuell 28). Hält auch die optimistische Anzeige richtig. Rückgabe `false` = nichts zu tun.
 */
export function useTageswertSetzen() {
  const setzen = useCounterSetzen()
  const ausfuehren = useCallback(
    (p: TageswertEingabe): boolean => {
      const ziel = Math.max(Math.round(p.ziel), p.getrackt, 0)
      const diff = ziel - p.aktuell
      if (diff === 0) return false
      setzen.mutate({ metric: p.metric, value: diff, date: p.date, memberId: p.memberId, delta: true })
      return true
    },
    [setzen],
  )
  return { ausfuehren, isPending: setzen.isPending }
}

export type ZaehlerQuelle = Pick<DailyCounter, 'member_id' | 'date' | 'metric' | 'period' | 'source'>

/**
 * Manuell gesetzte Tageszähler im Zeitraum (`daily_counters.source = 'manuell'`) – Fußnote „Zähler, teilweise manuell“ (K-09);
 * `v_daily_activity` kennt die Quelle nicht. Key verlängert `qk.counters` (Realtime-Präfix `['counters']`).
 */
export function useManuelleZaehler(member: string | 'team', von: string, bis: string) {
  return useQuery({
    queryKey: [...qk.counters(member, von, bis), 'manuell'],
    queryFn: async (): Promise<ZaehlerQuelle[]> => {
      let q = supabase
        .from('daily_counters')
        .select('member_id, date, metric, period, source')
        .eq('source', 'manuell')
        .gte('date', von)
        .lte('date', bis)
      if (member !== 'team') q = q.eq('member_id', member)
      return pruefe(await q.range(0, 999))
    },
  })
}
