// BAUPLAN § 3.5 `ErlaubnisBadge.tsx` / § 8.1 Nr. 3 (Thema-Bindung): Chip neutral + Zitat small ink-2, nicht ausblendbar.
// none/revoked → Chip danger „Keine Erlaubnis“ / „Widerspruch“; Grundlage > 12 Monate → overdue-Chip (ux § 3.3.3).
import { Chip } from '@/components/ui/Chip'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'
import { ERLAUBNIS_LABEL, GATE_GRUND_LABEL } from '@/texte/de'
import { erlaubnisZustand, type ErlaubnisLead } from './erlaubnis'

/**
 * Erlaubnis-Badge: Chip + Zitat daneben („Hat gebeten um: ‚kurze Infos zu Solvio‘ · 05.10. · per LinkedIn“).
 * `kompakt`: nur der Chip, Zitat im Tooltip (Queue-Karte, Tabelle).
 */
export function ErlaubnisBadge({
  lead,
  kompakt,
  className,
}: {
  lead: ErlaubnisLead
  kompakt?: boolean
  className?: string
}) {
  const z = erlaubnisZustand(lead)
  const zitat = lead.email_consent_note?.trim() || null
  const voll = ERLAUBNIS_LABEL[lead.email_consent_basis] ?? lead.email_consent_basis
  const title = z.veraltet ? GATE_GRUND_LABEL.aelter_12_monate : voll
  const chip = (
    <Chip ton={z.ton} title={title} data-testid="erlaubnis-chip">
      {z.label}
    </Chip>
  )
  if (kompakt) {
    return (
      <Tooltip text={zitat ? `${voll} · ‚${zitat}‘` : voll}>
        <span className={cn('inline-flex', className)}>{chip}</span>
      </Tooltip>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)} data-testid="erlaubnis-badge">
      {chip}
      {z.gesperrt ? (
        <span className="text-small text-ink-3">
          {lead.email_consent_basis === 'revoked' ? GATE_GRUND_LABEL.widerspruch : GATE_GRUND_LABEL.keine_grundlage}
        </span>
      ) : zitat ? (
        <span className="text-small text-ink-2 min-w-0">Hat gebeten um: ‚{zitat}‘</span>
      ) : (
        <span className="text-small text-ink-3">Ohne Zitat – Beleg nachtragen.</span>
      )}
    </div>
  )
}
