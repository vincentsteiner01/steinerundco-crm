// BAUPLAN § 3.1.6 meetings.ts: useMeetings(leadId), useMeetingErstellen(), useMeetingStatus().
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Meeting, MeetingStatus } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type MeetingInsert = Database['crm']['Tables']['meetings']['Insert']

export function useMeetings(leadId: string | null | undefined) {
  return useQuery({
    queryKey: qk.meetings.lead(leadId ?? ''),
    enabled: !!leadId,
    queryFn: async (): Promise<Meeting[]> =>
      pruefe(
        await supabase
          .from('meetings')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('scheduled_at', { ascending: false }),
      ),
  })
}

/** Geplante Termine einer Person (Kalenderblock, M3/M5). */
export function useMeetingsMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: qk.meetings.member(memberId ?? ''),
    enabled: !!memberId,
    queryFn: async (): Promise<Meeting[]> =>
      pruefe(
        await supabase
          .from('meetings')
          .select('*')
          .eq('member_id', memberId as string)
          .eq('status', 'geplant')
          .order('scheduled_at', { ascending: true }),
      ),
  })
}

function useMeetingInvalidierung() {
  const qc = useQueryClient()
  return (leadId: string) => {
    void qc.invalidateQueries({ queryKey: qk.meetings.lead(leadId) })
    void qc.invalidateQueries({ queryKey: ['meetings', 'member'] })
    void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    void qc.invalidateQueries({ queryKey: qk.leads.all })
    void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.kpis.all })
  }
}

export function useMeetingErstellen() {
  const inval = useMeetingInvalidierung()
  return useMutation({
    mutationFn: async (m: MeetingInsert): Promise<Meeting> =>
      pruefe(await supabase.from('meetings').insert(m).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, m) => inval(m.lead_id),
  })
}

/** Status setzen (stattgefunden / no_show / abgesagt / verschoben); Trigger meetings_after_write schreibt die Aktivität. */
export function useMeetingStatus() {
  const inval = useMeetingInvalidierung()
  return useMutation({
    mutationFn: async (p: {
      id: string
      leadId: string
      status: MeetingStatus
      outcomeNote?: string | null
      scheduledAt?: string
    }): Promise<Meeting> =>
      pruefe(
        await supabase
          .from('meetings')
          .update({
            status: p.status,
            ...(p.outcomeNote !== undefined ? { outcome_note: p.outcomeNote } : {}),
            ...(p.scheduledAt !== undefined ? { scheduled_at: p.scheduledAt } : {}),
          })
          .eq('id', p.id)
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}
