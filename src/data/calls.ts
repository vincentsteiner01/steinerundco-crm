// BAUPLAN § 3.1.6 calls.ts: useCalls(leadId, limit), useCallsSession(sessionKey), useCallsHeute(memberId), useCallsZeitraum (§ 1.5 Nr. 40), useLogCall().
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcomeDef } from '@/types/domain'
import { heuteBerlin, pruefe, useAlleSeiten, zeitraumGrenzen } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

export function useCalls(leadId: string | null | undefined, limit = 20) {
  return useQuery({
    queryKey: [...qk.calls.lead(leadId ?? ''), limit],
    enabled: !!leadId,
    queryFn: async (): Promise<Call[]> =>
      pruefe(
        await supabase
          .from('calls')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('started_at', { ascending: false })
          .limit(limit),
      ),
  })
}

/**
 * Call-Block (M3): `sessionKey = '<memberId>|<ISO-Start>'` – die Tabelle hat keine Session-Spalte;
 * die Sitzung ist „alle eigenen Anrufe seit Start des Blocks“.
 */
export const sessionKey = (memberId: string, startIso: string): string => `${memberId}|${startIso}`

export function useCallsSession(key: string | null | undefined) {
  const [memberId, start] = (key ?? '').split('|')
  return useQuery({
    queryKey: qk.calls.session(key ?? ''),
    enabled: !!memberId && !!start,
    queryFn: async (): Promise<Call[]> =>
      pruefe(
        await supabase
          .from('calls')
          .select('*')
          .eq('member_id', memberId as string)
          .gte('started_at', start as string)
          .order('started_at', { ascending: false }),
      ),
  })
}

export function useCallsHeute(memberId: string | null | undefined) {
  const heute = heuteBerlin()
  const { ab, vor } = zeitraumGrenzen(heute, heute)
  return useQuery({
    queryKey: [...qk.calls.heute(memberId ?? ''), heute],
    enabled: !!memberId,
    queryFn: async (): Promise<Call[]> =>
      pruefe(
        await supabase
          .from('calls')
          .select('*')
          .eq('member_id', memberId as string)
          .gte('started_at', ab)
          .lt('started_at', vor)
          .order('started_at', { ascending: false }),
      ),
  })
}

/** Ausgehende Anrufe je Mitglied/Zeitraum (Europe/Berlin-Grenzen in UTC), alle Seiten à 500 (§ 1.5 Nr. 40). */
export function useCallsZeitraum(member: string | 'team', von: string, bis: string) {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  return useAlleSeiten<Call>(qk.calls.zeitraum(member, von, bis), async (seiteVon, seiteBis) => {
    let q = supabase.from('calls').select('*').eq('direction', 'out').gte('started_at', ab).lt('started_at', vor)
    if (member !== 'team') q = q.eq('member_id', member)
    return pruefe(
      await q.order('started_at', { ascending: true }).order('id', { ascending: true }).range(seiteVon, seiteBis),
    )
  })
}

/** Anruf protokollieren (`log_call`, Ergebnis-Pflicht E11). */
export function useLogCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.logCall>[0]) => rpc.logCall(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.calls.lead(p.leadId) })
      void qc.invalidateQueries({ queryKey: ['calls', 'session'] })
      void qc.invalidateQueries({ queryKey: ['calls', 'heute'] })
      void qc.invalidateQueries({ queryKey: ['calls', 'zeitraum'] })
      void qc.invalidateQueries({ queryKey: qk.leads.detail(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.activities(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.tasks.lead(p.leadId) })
      // log_call legt Rückruf-Tasks an und ersetzt Enrollments (Anrufliste, FOUNDATION-WUNSCH M3)
      void qc.invalidateQueries({ queryKey: ['tasks', 'faellig'] })
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
      void qc.invalidateQueries({ queryKey: ['calls', 'letzte'] })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
      void qc.invalidateQueries({ queryKey: qk.nav })
    },
  })
}

/** Ergebnis-Stammdaten `call_outcome_defs` (Hotkey, Label, Gruppe, is_connect/is_dm) – Anruf-Screen (M3), KPIs (M5). */
export function useCallOutcomeDefs() {
  return useQuery({
    queryKey: qk.calls.outcomeDefs,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CallOutcomeDef[]> =>
      pruefe(await supabase.from('call_outcome_defs').select('*').order('sort_order', { ascending: true })),
  })
}

export type LetzterAnruf = Pick<
  Call,
  'id' | 'lead_id' | 'started_at' | 'outcome' | 'reached_person' | 'reached_name' | 'attempt_no'
>

/** Neuester Anruf je Lead (Eingabe beliebig sortiert). */
export function letzterJeLead(calls: readonly LetzterAnruf[]): Map<string, LetzterAnruf> {
  const m = new Map<string, LetzterAnruf>()
  for (const c of calls) {
    const alt = m.get(c.lead_id)
    if (!alt || c.started_at > alt.started_at) m.set(c.lead_id, c)
  }
  return m
}

/** Letzter Anruf je Lead für Listen-Chips (Anrufliste, ux § 3.5.1) – eine Abfrage über die Lead-IDs. */
export function useLetzteAnrufe(leadIds: readonly string[]) {
  const ids = [...leadIds].sort()
  return useQuery({
    queryKey: qk.calls.letzte(ids.join(',')),
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, LetzterAnruf>> =>
      letzterJeLead(
        pruefe(
          await supabase
            .from('calls')
            .select('id, lead_id, started_at, outcome, reached_person, reached_name, attempt_no')
            .in('lead_id', ids)
            .order('started_at', { ascending: false })
            .range(0, 999),
        ),
      ),
  })
}
