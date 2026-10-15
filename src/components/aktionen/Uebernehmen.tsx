// „Übernehmen“ `Ü` (BAUPLAN § 3.1.10b, ux § 2.6 Schritt 2): useLeadUpdate({ owner_id: me, released: false }); Hinweis bei
// Freigabegrund „will keine Nachrichten“; Undo über die vom Trigger geschriebene `uebergabe`-Aktivität (from = null).
import { toast } from '@/components/toast'
import { cn } from '@/components/ui/cn'
import { useLead, useLeadUpdate } from '@/data/leads'
import { useAndere, useMeId } from '@/data/members'
import { useUndo } from '@/data/undo'
import { nachleseAktivitaet, useAktionTaste, useLeadInvalidierung, type AktionProps } from './_gemeinsam'
import { AktionButton, TriggerHuelle } from './_Teile'
import { willKeineNachrichten } from './gruende'

export function Uebernehmen({ leadId, trigger, onFertig, aktiv, className }: AktionProps) {
  const { data: lead } = useLead(leadId)
  const me = useMeId()
  const andere = useAndere()
  const update = useLeadUpdate()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const hinweis = willKeineNachrichten(lead?.released_reason)
  const moeglich = !!lead && !!me && (lead.released || lead.owner_id !== me)
  const wer = andere?.short_name ?? andere?.display_name ?? 'die andere Person'

  const uebernehmen = async () => {
    if (!lead || !me || !moeglich || update.isPending) return
    try {
      await update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: { owner_id: me, released: false },
      })
    } catch {
      return
    }
    inval(leadId)
    const text = hinweis ? `Übernommen – vor erneuter Kontaktaufnahme ${wer} fragen.` : 'Übernommen.'
    const a = await nachleseAktivitaet(leadId, ['uebergabe'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    onFertig?.()
  }

  useAktionTaste('ü', trigger === undefined && !!aktiv && moeglich, () => void uebernehmen())

  if (trigger !== undefined) return <TriggerHuelle onClick={() => void uebernehmen()}>{trigger}</TriggerHuelle>
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <AktionButton kbd="Ü" disabled={!moeglich} busy={update.isPending} onClick={() => void uebernehmen()}>
        Übernehmen
      </AktionButton>
      {hinweis ? <span className="text-small text-overdue">Vor erneuter Kontaktaufnahme {wer} fragen.</span> : null}
    </span>
  )
}
