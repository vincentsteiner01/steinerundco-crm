// Lokale Mutationen des Moduls (BAUPLAN § 3.0 Nr. 4: nur über M0-Hooks/RPC-Wrapper): Gesendet bestätigen, Entwurf verwerfen,
// Beantwortet (log_reply Kanal email + emails.status replied), Bounce (status bounced → Trigger legt den Sperrlisten-Eintrag an).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mutationFehler, qk, rpc, useCompleteStep, useEmailUpdate } from '@/data'
import type { Email } from '@/types/domain'

/** „Gesendet?“ → sent_confirmed; aus einer Sequenz: Schritt erledigt (`complete_step(gesendet)`, M-06). */
export function useGesendetBestaetigen() {
  const update = useEmailUpdate()
  const schritt = useCompleteStep()
  return useMutation({
    mutationFn: async (
      e: Pick<Email, 'id' | 'lead_id' | 'enrollment_id' | 'template_id' | 'channel'>,
    ): Promise<Email> => {
      const z = await update.mutateAsync({
        id: e.id,
        leadId: e.lead_id,
        patch: { status: 'sent_confirmed', sent_at: new Date().toISOString() },
      })
      if (e.enrollment_id)
        await schritt.mutateAsync({
          enrollmentId: e.enrollment_id,
          leadId: e.lead_id,
          outcome: 'gesendet',
          templateId: e.template_id,
        })
      return z
    },
  })
}

/** „Verworfen“ → failed mit bounce_reason 'verworfen'. */
export function useEntwurfVerwerfen() {
  const update = useEmailUpdate()
  return useMutation({
    mutationFn: (e: Pick<Email, 'id' | 'lead_id'>) =>
      update.mutateAsync({ id: e.id, leadId: e.lead_id, patch: { status: 'failed', bounce_reason: 'verworfen' } }),
  })
}

/** „Beantwortet“ → log_reply (Kanal email, ohne Label) + emails.status replied. */
export function useBeantwortet() {
  const update = useEmailUpdate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: Pick<Email, 'id' | 'lead_id'>): Promise<number> => {
      const activityId = await rpc.logReply({ leadId: e.lead_id, channel: 'email' })
      await update.mutateAsync({
        id: e.id,
        leadId: e.lead_id,
        patch: { status: 'replied', replied_at: new Date().toISOString() },
      })
      return activityId
    },
    onError: mutationFehler,
    onSettled: (_d, _e, e) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(e.lead_id) })
      void qc.invalidateQueries({ queryKey: qk.activities(e.lead_id) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}

/** „Bounce“ → status bounced (§ 8.1 Nr. 6: Trigger schreibt die Sperrliste, Grund bounce). */
export function useBounce() {
  const update = useEmailUpdate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (e: Pick<Email, 'id' | 'lead_id'> & { grund?: string | null }) =>
      update.mutateAsync({
        id: e.id,
        leadId: e.lead_id,
        patch: { status: 'bounced', bounce_reason: e.grund?.trim() || 'manuell' },
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sperrliste })
    },
  })
}
