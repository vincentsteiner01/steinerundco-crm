// „Zuständig wählen“ (BAUPLAN § 3.1.10b, Tabelle/Inline-Edit): Select Vincent · Mike · Frei → rpc.transferLead (Kurznotiz
// „per Tabelle“) bzw. rpc.releaseLead; Undo über die `uebergabe`-/`freigabe`-Aktivität.
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Select } from '@/components/ui/Select'
import { mutationFehler } from '@/data/errors'
import { useLead } from '@/data/leads'
import { useMembers } from '@/data/members'
import { rpc } from '@/data/rpc'
import { useUndo } from '@/data/undo'
import type { Lead } from '@/types/domain'
import { nachleseAktivitaet, useLeadInvalidierung, type AktionProps } from './_gemeinsam'
import { FREIGABE_PER_TABELLE } from './gruende'
import { anzeigeName } from '@/lib/mitglied'

export const FREI = 'frei'

export type ZustaendigWaehlenProps = Pick<AktionProps, 'leadId' | 'onFertig' | 'className'> & {
  /** Zeile aus der Tabelle (spart den Detail-Request); sonst `useLead` */
  lead?: Pick<Lead, 'id' | 'owner_id' | 'released'> | null
  ariaLabel?: string
  autoFocus?: boolean
  onAbbrechen?: () => void
}

export function ZustaendigWaehlen({
  leadId,
  lead: leadProp,
  onFertig,
  onAbbrechen,
  className,
  ariaLabel = 'Zuständig',
  autoFocus,
}: ZustaendigWaehlenProps) {
  const { data: geladen } = useLead(leadProp ? null : leadId)
  const lead = leadProp ?? geladen
  const { data: members } = useMembers()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()
  const [laeuft, setLaeuft] = useState(false)

  const aktuell = !lead || lead.released || !lead.owner_id ? FREI : lead.owner_id

  const setze = async (wert: string) => {
    if (!lead || laeuft || wert === aktuell) return
    setLaeuft(true)
    try {
      if (wert === FREI) await rpc.releaseLead({ leadId, reason: FREIGABE_PER_TABELLE })
      else await rpc.transferLead({ leadId, toMember: wert, note: FREIGABE_PER_TABELLE })
    } catch (e) {
      mutationFehler(e)
      setLaeuft(false)
      return
    }
    setLaeuft(false)
    inval(leadId)
    const m = members?.find((x) => x.id === wert)
    const text =
      wert === FREI ? 'Freigegeben.' : `Übergeben an ${anzeigeName(m, 'die andere Person')}.`
    const a = await nachleseAktivitaet(leadId, wert === FREI ? ['freigabe'] : ['uebergabe'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    onFertig?.()
  }

  return (
    <Select
      aria-label={ariaLabel}
      className={className}
      value={aktuell}
      disabled={!lead || laeuft}
      autoFocus={autoFocus}
      onChange={(e) => void setze(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onAbbrechen?.()
      }}
      optionen={[
        ...(members ?? [])
          .filter((m) => !!m.id)
          .map((m) => ({ value: m.id as string, label: anzeigeName(m, '') })),
        { value: FREI, label: 'Frei' },
      ]}
    />
  )
}
