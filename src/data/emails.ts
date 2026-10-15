// BAUPLAN § 3.1.6 emails.ts: useEmails(leadId), useEmailsStatus(memberId, status[]), useEmailErstellen(), useEmailUpdate(), useEmailsZeitraum.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Email, EmailStatus } from '@/types/domain'
import { pruefe, useAlleSeiten, zeitraumGrenzen } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type EmailInsert = Database['crm']['Tables']['emails']['Insert']
export type EmailUpdate = Database['crm']['Tables']['emails']['Update']

export function useEmails(leadId: string | null | undefined) {
  return useQuery({
    queryKey: qk.emails.lead(leadId ?? ''),
    enabled: !!leadId,
    queryFn: async (): Promise<Email[]> =>
      pruefe(
        await supabase
          .from('emails')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('status_at', { ascending: false, nullsFirst: false }),
      ),
  })
}

export function useEmailsStatus(memberId: string | null | undefined, status: EmailStatus[]) {
  return useQuery({
    queryKey: qk.emails.status(memberId ?? '', [...status].sort()),
    enabled: !!memberId && status.length > 0,
    queryFn: async (): Promise<Email[]> =>
      pruefe(
        await supabase
          .from('emails')
          .select('*')
          .eq('member_id', memberId as string)
          .in('status', status)
          .order('status_at', { ascending: false, nullsFirst: false }),
      ),
  })
}

function useEmailInvalidierung() {
  const qc = useQueryClient()
  return (leadId: string | null | undefined) => {
    if (leadId) void qc.invalidateQueries({ queryKey: qk.emails.lead(leadId) })
    if (leadId) void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    if (leadId) void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
    void qc.invalidateQueries({ queryKey: ['emails', 'status'] })
    void qc.invalidateQueries({ queryKey: ['emails', 'zeitraum'] })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.kpis.all })
  }
}

/** Insert (Entwurf oder bestätigter Versand); Trigger emails_before_write erzwingt das Gate (§ 1.5 Nr. 33). */
export function useEmailErstellen() {
  const inval = useEmailInvalidierung()
  return useMutation({
    mutationFn: async (e: EmailInsert): Promise<Email> =>
      pruefe(await supabase.from('emails').insert(e).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, e) => inval(e.lead_id),
  })
}

export function useEmailUpdate() {
  const inval = useEmailInvalidierung()
  return useMutation({
    mutationFn: async (p: { id: string; leadId: string; patch: EmailUpdate }): Promise<Email> =>
      pruefe(await supabase.from('emails').update(p.patch).eq('id', p.id).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** Ausgehende E-Mails je Mitglied/Zeitraum (`sent_at`), alle Seiten (§ 1.5 Nr. 40). */
export function useEmailsZeitraum(member: string | 'team', von: string, bis: string) {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  return useAlleSeiten<Email>(qk.emails.zeitraum(member, von, bis), async (seiteVon, seiteBis) => {
    let q = supabase.from('emails').select('*').eq('direction', 'out').gte('sent_at', ab).lt('sent_at', vor)
    if (member !== 'team') q = q.eq('member_id', member)
    return pruefe(
      await q.order('sent_at', { ascending: true }).order('id', { ascending: true }).range(seiteVon, seiteBis),
    )
  })
}
