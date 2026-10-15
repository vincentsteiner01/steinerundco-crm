// M3 – Anrufgrund-Logik (BAUPLAN § 3.4 Gate, § 8.2 Nr. 1, § 1.5 Nr. 14): Vorbelegung aus dem LinkedIn-Zustand, Setzen =
// useLeadUpdate({ call_basis, call_basis_note, call_basis_url }) + Aktivität einwilligung/anrufgrund (auch für die Bulk-Aktion).
import { useAktivitaetErstellen } from '@/data/activities'
import { useLeadUpdate } from '@/data/leads'
import { stageRank } from '@/lib/stufen'
import type { CallBasis, Lead } from '@/types/domain'

export const HINWEIS_NUR_VERNETZT = '‚nur vernetzt‘ ist die schwächere Grundlage'

/** Vorbelegung aus dem LinkedIn-Zustand: Antwort vorhanden → vernetzt + Antwort, sonst vernetzt → vernetzt (mit Hinweis). */
export function anrufgrundVorbelegung(
  lead: Pick<Lead, 'stage' | 'last_inbound_channel' | 'last_inbound_at'>,
): CallBasis | null {
  const antwort =
    (lead.last_inbound_channel === 'linkedin' && !!lead.last_inbound_at) ||
    stageRank(lead.stage) >= stageRank('dm_beantwortet')
  if (antwort) return 'linkedin_vernetzt_antwort'
  if (stageRank(lead.stage) >= stageRank('vernetzt')) return 'linkedin_vernetzt'
  return null
}

export function useAnrufgrundSetzen() {
  const update = useLeadUpdate()
  const aktivitaet = useAktivitaetErstellen()
  const setzen = async (
    lead: Pick<Lead, 'id' | 'updated_at'>,
    basis: CallBasis,
    note: string | null,
    url: string | null,
  ) => {
    await update.mutateAsync({
      id: lead.id,
      erwartetUpdatedAt: lead.updated_at,
      patch: { call_basis: basis, call_basis_note: note, call_basis_url: url },
    })
    await aktivitaet.mutateAsync({
      lead_id: lead.id,
      type: 'einwilligung',
      channel: 'telefon',
      outcome: basis,
      note,
      metadata: { kind: 'anrufgrund', url },
    })
  }
  return { setzen, isPending: update.isPending || aktivitaet.isPending }
}
