// „Antwort erhalten“ (A) ohne Doppel (Runde 3): Kam die Antwort schon über den Gmail-Eingang (crm.eingang → log_reply ohne Label),
// trägt A nur die Reaktion an dieser Aktivität nach (rpc.setReplyLabel) statt eine zweite `nachricht_erhalten` zu schreiben.
import { useQuery } from '@tanstack/react-query'
import type { Activity, ActivityType, Channel, ReplyLabel } from '@/types/domain'
import { pruefe } from './_helfer'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

/** Eingehende Antworten (wie `v_inbound` im Trigger `activities_after_insert`). */
export const ANTWORT_TYPEN: readonly ActivityType[] = ['nachricht_erhalten', 'email_erhalten']
/** Eigene Kontakte, nach denen eine frühere Antwort als „beantwortet“ gilt – eine neue Antwort ist dann ein neues Ereignis. */
export const EIGENE_KONTAKT_TYPEN: readonly ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'anruf',
]

/**
 * Jüngste eingegangene Antwort am Lead (optional nur dieses Kanals), sofern sie noch KEINE Reaktion hat und seitdem kein eigener
 * Kontakt (Nachricht, Pitch, Mail, Anruf) folgte. Sonst `null` – dann ist A eine neue Antwort (`rpc.logReply`).
 */
export async function lastUnlabeledReply(leadId: string, channel?: Channel): Promise<Activity | null> {
  let q = supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .in('type', [...ANTWORT_TYPEN])
  if (channel) q = q.eq('channel', channel)
  const [a] = pruefe(await q.order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(1))
  if (!a || a.reply_label) return null
  const danach = pruefe(
    await supabase
      .from('activities')
      .select('id')
      .eq('lead_id', leadId)
      .in('type', [...EIGENE_KONTAKT_TYPEN])
      .gt('occurred_at', a.occurred_at)
      .limit(1),
  )
  return danach.length ? null : a
}

/** Hook zu `lastUnlabeledReply`; Key unter `qk.activities(leadId)` → Realtime/Invalidierung der Timeline lädt ihn mit neu. */
export function useLastUnlabeledReply(leadId: string | null | undefined, channel?: Channel, enabled = true) {
  return useQuery({
    queryKey: [...qk.activities(leadId ?? ''), 'antwortOhneReaktion', channel ?? 'alle'] as const,
    enabled: !!leadId && enabled,
    staleTime: 5_000,
    queryFn: () => lastUnlabeledReply(leadId as string, channel),
  })
}

export type AntwortEingabe = {
  leadId: string
  channel?: Channel
  label: ReplyLabel
  note?: string | null
  occurredAt?: string
}
/** `nachgetragen = true`: Reaktion an einer schon erfassten Antwort (kein Undo anbieten – das löschte die Eingangs-Antwort). */
export type AntwortErfasst = { activityId: number; nachgetragen: boolean }

/**
 * A-Pfad ohne Doppel: offene Antwort ohne Reaktion vorhanden → `set_reply_label` (Notiz nur, wenn sie noch keinen Text hat),
 * sonst `log_reply` wie bisher. Kanal-Standard wie `log_reply`: linkedin.
 */
export async function antwortErfassen(p: AntwortEingabe): Promise<AntwortErfasst> {
  const offen = await lastUnlabeledReply(p.leadId, p.channel ?? 'linkedin')
  if (offen) {
    const activityId = await rpc.setReplyLabel({ activityId: offen.id, label: p.label, note: p.note })
    return { activityId, nachgetragen: true }
  }
  const activityId = await rpc.logReply({
    leadId: p.leadId,
    channel: p.channel,
    label: p.label,
    note: p.note,
    occurredAt: p.occurredAt,
  })
  return { activityId, nachgetragen: false }
}
