// BAUPLAN § 3.1.6 connections.ts: useConnections(leadId), useConnectionsOffen(memberId), useConnectionZurueckziehen(), useConnectionAblehnen()
// (§ 1.5 Nr. 34). Beide Patches liefern die vom Trigger erzeugte `vernetzung_zurueckgezogen`-Aktivität für den Undo-Toast.
// Integration M1–M8 (FOUNDATION-WUNSCH M1/M5): useMarkAccepted, useLogRequest (optimistisch), useConnectionsZeitraum.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/authStore'
import type { Activity, LinkedinConnection } from '@/types/domain'
import { pruefe, pruefeNull, useAlleSeiten, zeitraumGrenzen, type AlleSeiten } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { queueOptimistischEntfernen } from './queue'
import { rpc } from './rpc'
import { supabase } from './supabase'

/** Leads (aus `leadIds`), zu denen `memberId` schon eine Verbindung im CRM hat – „Neue Anfragen“ überspringt sie (23.10.2026). */
export async function ladeVerbundeneLeads(leadIds: readonly string[], memberId: string): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < leadIds.length; i += 200) {
    const teil = leadIds.slice(i, i + 200)
    const zeilen = pruefe(
      await supabase.from('linkedin_connections').select('lead_id').eq('member_id', memberId).in('lead_id', teil),
    )
    for (const z of zeilen) out.add(z.lead_id)
  }
  return out
}

export function useConnections(leadId: string | null | undefined) {
  return useQuery({
    queryKey: qk.connections.lead(leadId ?? ''),
    enabled: !!leadId,
    queryFn: async (): Promise<LinkedinConnection[]> =>
      pruefe(
        await supabase
          .from('linkedin_connections')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('requested_at', { ascending: false, nullsFirst: false }),
      ),
  })
}

export function useConnectionsOffen(memberId: string | null | undefined) {
  return useQuery({
    queryKey: qk.connections.offen(memberId ?? ''),
    enabled: !!memberId,
    queryFn: async (): Promise<LinkedinConnection[]> =>
      pruefe(
        await supabase
          .from('linkedin_connections')
          .select('*')
          .eq('member_id', memberId as string)
          .eq('status', 'ausstehend')
          .order('requested_at', { ascending: true, nullsFirst: false }),
      ),
  })
}

export type ConnectionZurueck = { connection: LinkedinConnection; activity: Activity | null }

async function zurueckziehen(
  p: { id: string; leadId: string },
  note: 'zurueckgezogen' | 'abgelehnt',
): Promise<ConnectionZurueck> {
  const connection = pruefe(
    await supabase
      .from('linkedin_connections')
      .update({ status: 'zurueckgezogen', withdrawn_at: new Date().toISOString(), note })
      .eq('id', p.id)
      .select('*')
      .single(),
  )
  // Nachlese: die vom Trigger connections_after_write geschriebene Aktivität (für den Undo-Toast, § 1.5 Nr. 34)
  const activity = pruefeNull(
    await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', p.leadId)
      .eq('type', 'vernetzung_zurueckgezogen')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  return { connection, activity }
}

function useZurueck(note: 'zurueckgezogen' | 'abgelehnt') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; leadId: string }) => zurueckziehen(p, note),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.connections.lead(p.leadId) })
      void qc.invalidateQueries({ queryKey: ['connections', 'offen'] })
      void qc.invalidateQueries({ queryKey: qk.activities(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.detail(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}

/** Sektion „Zurückziehen“: status = zurueckgezogen, withdrawn_at = now(), note = 'zurueckgezogen'. */
export const useConnectionZurueckziehen = () => useZurueck('zurueckgezogen')
/** „Annahme prüfen“ `X`: dito mit note = 'abgelehnt' (§ 1.5 Nr. 34). */
export const useConnectionAblehnen = () => useZurueck('abgelehnt')

/** Invalidierung nach `log_request`/`mark_accepted` (Trigger: Aktivität, Zähler, Sequenz A/B, Opener heute). */
function useAnfragenInvalidierung() {
  const qc = useQueryClient()
  return (leadId: string) => {
    void qc.invalidateQueries({ queryKey: ['connections'] })
    void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    void qc.invalidateQueries({ queryKey: qk.leads.all })
    void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
    void qc.invalidateQueries({ queryKey: ['activities', 'zeitraum'] })
    void qc.invalidateQueries({ queryKey: qk.enrollments(leadId) })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: ['counters'] })
    void qc.invalidateQueries({ queryKey: qk.kpis.all })
    void qc.invalidateQueries({ queryKey: qk.nav })
  }
}

/** „Angenommen“ (`mark_accepted`): der Trigger startet Sequenz A/B und legt den Opener heute an. Optimistisch aus „Annahme prüfen“. */
export function useMarkAccepted() {
  const qc = useQueryClient()
  const inval = useAnfragenInvalidierung()
  return useMutation({
    mutationFn: (p: { leadId: string; memberId?: string | null; date?: string | null }) =>
      rpc.markAccepted({ leadId: p.leadId, memberId: p.memberId, date: p.date }),
    onMutate: (p) => ({
      vorher: queueOptimistischEntfernen(qc, (i) => i.lead_id === p.leadId && i.section === 'annahme_pruefen'),
    }),
    onError: (e, _p, ctx) => {
      for (const [key, daten] of ctx?.vorher ?? []) qc.setQueryData(key, daten)
      mutationFehler(e)
    },
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** „Anfrage gesendet“ (`log_request`): Zähler tickt über den Trigger. Optimistisch aus „Neue Anfragen“. */
export function useLogRequest() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.member?.user_id ?? null)
  const inval = useAnfragenInvalidierung()
  return useMutation({
    mutationFn: (p: { leadId: string; noteVariant?: 'ohne' | 'note_v1' | 'note_v2'; date?: string | null }) =>
      rpc.logRequest({ leadId: p.leadId, memberId: me, noteVariant: p.noteVariant, date: p.date }),
    onMutate: (p) => ({
      vorher: queueOptimistischEntfernen(qc, (i) => i.lead_id === p.leadId && i.section === 'neue_anfragen'),
    }),
    onError: (e, _p, ctx) => {
      for (const [key, daten] of ctx?.vorher ?? []) qc.setQueryData(key, daten)
      mutationFehler(e)
    },
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

export type ConnectionZeitraum = Pick<
  LinkedinConnection,
  'id' | 'lead_id' | 'member_id' | 'requested_at' | 'accepted_at' | 'status' | 'note_variant' | 'kpi_relevant'
>

/**
 * Anfragen je Zeitraum (`requested_at`, Europe/Berlin) und Person – Notiz-Variante der KPIs (§ 7.3). Key verlängert
 * `qk.kpis.zeitraum` (Realtime invalidiert `qk.kpis.all` bei `linkedin_connections`); alle Seiten à 500.
 */
export function useConnectionsZeitraum(
  member: string | 'team',
  von: string,
  bis: string,
): AlleSeiten<ConnectionZeitraum> {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  return useAlleSeiten<ConnectionZeitraum>([...qk.kpis.zeitraum(member, von, bis), 'connections'], async (v, b) => {
    let q = supabase
      .from('linkedin_connections')
      .select('id, lead_id, member_id, requested_at, accepted_at, status, note_variant, kpi_relevant')
      .gte('requested_at', ab)
      .lt('requested_at', vor)
    if (member !== 'team') q = q.eq('member_id', member)
    return pruefe(await q.order('requested_at', { ascending: true }).order('id', { ascending: true }).range(v, b))
  })
}
