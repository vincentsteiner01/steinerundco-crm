// BAUPLAN § 3.1.6 tasks.ts: useTasks(leadId), useTasksFaellig(memberId), useTaskErstellen(), useTaskUpdate() (+ RPC-Hooks für Aufgaben).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Task } from '@/types/domain'
import { berlinMitternachtIso, heuteBerlin, pruefe, tagPlus } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

export type TaskInsert = Database['crm']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['crm']['Tables']['tasks']['Update']

export function useTasks(leadId: string | null | undefined) {
  return useQuery({
    queryKey: qk.tasks.lead(leadId ?? ''),
    enabled: !!leadId,
    queryFn: async (): Promise<Task[]> =>
      pruefe(
        await supabase
          .from('tasks')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('status', { ascending: true })
          .order('due_at', { ascending: true, nullsFirst: false }),
      ),
  })
}

/** Offene Aufgaben der Person bis einschließlich heute (Europe/Berlin). */
export function useTasksFaellig(memberId: string | null | undefined) {
  return useQuery({
    queryKey: qk.tasks.faellig(memberId ?? ''),
    enabled: !!memberId,
    queryFn: async (): Promise<Task[]> =>
      pruefe(
        await supabase
          .from('tasks')
          .select('*')
          .eq('member_id', memberId as string)
          .eq('status', 'offen')
          .lt('due_at', berlinMitternachtIso(tagPlus(heuteBerlin(), 1)))
          .order('due_at', { ascending: true }),
      ),
  })
}

/**
 * Alle offenen Rückruf-Tasks einer Person (`memberId`) oder aller (`null`) – auch künftige. `useTasksFaellig` endet heute;
 * ein künftig vereinbarter Rückruf hält den Lead trotzdem aus der Anrufliste (ux § 2.5 Schritt 1, M3).
 */
export function useRueckrufeOffen(memberId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.tasks.rueckrufeOffen(memberId),
    enabled,
    queryFn: async (): Promise<Task[]> => {
      let q = supabase.from('tasks').select('*').eq('kind', 'rueckruf').eq('status', 'offen')
      if (memberId) q = q.eq('member_id', memberId)
      return pruefe(await q.order('due_at', { ascending: true }).range(0, 999))
    },
  })
}

function useTaskInvalidierung() {
  const qc = useQueryClient()
  return (leadId: string | null | undefined) => {
    if (leadId) void qc.invalidateQueries({ queryKey: qk.tasks.lead(leadId) })
    if (leadId) void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    void qc.invalidateQueries({ queryKey: ['tasks', 'faellig'] })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.nav })
  }
}

export function useTaskErstellen() {
  const inval = useTaskInvalidierung()
  return useMutation({
    mutationFn: async (t: TaskInsert): Promise<Task> =>
      pruefe(await supabase.from('tasks').insert(t).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, t) => inval(t.lead_id),
  })
}

export function useTaskUpdate() {
  const inval = useTaskInvalidierung()
  return useMutation({
    mutationFn: async (p: { id: string; leadId: string; patch: TaskUpdate }): Promise<Task> =>
      pruefe(await supabase.from('tasks').update(p.patch).eq('id', p.id).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

export function useCompleteTask() {
  const inval = useTaskInvalidierung()
  return useMutation({
    mutationFn: (p: { taskId: string; leadId: string; note?: string | null }) => rpc.completeTask(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

export function useSnoozeTask() {
  const inval = useTaskInvalidierung()
  return useMutation({
    mutationFn: (p: { taskId: string; leadId: string; until?: string | null; days?: number | null }) =>
      rpc.snoozeTask(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** Wiedervorlage = Stufe + Aufgabe in einer Transaktion (§ 1.5 Nr. 15). */
export function useSetWiedervorlage() {
  const inval = useTaskInvalidierung()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.setWiedervorlage>[0]) => rpc.setWiedervorlage(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      inval(p.leadId)
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.activities(p.leadId) })
    },
  })
}
