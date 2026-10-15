// Zeile der Tabs Entwürfe/Gesendet (DESIGN-SYSTEM § 5.9/§ 5.10 angelehnt): Datum Mono · Lead-Name · Adresse Mono · Betreff ·
// Status-Chip · Aktionen rechts. Cursor `.cursor-bar`, `role=option` im Listbox der Liste.
import type { ReactNode } from 'react'
import { Chip, type ChipTon } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { useLead } from '@/data'
import { fmtDatumKurz, fmtZeit } from '@/lib/format'
import type { Email } from '@/types/domain'
import { STATUS_LABEL } from './status'

/** Lead-Name aus dem Detail-Cache (eine Query je Lead, dedupliziert). */
export function LeadName({ leadId }: { leadId: string }) {
  const { data } = useLead(leadId)
  return <>{data?.full_name ?? '…'}</>
}

export function EmailZeile({
  email,
  cursor,
  onClick,
  aktionen,
  widerspruch,
}: {
  email: Email
  cursor: boolean
  onClick: () => void
  aktionen: ReactNode
  /** Lead hat widersprochen → Chip „Widerspruch“ statt Status. */
  widerspruch?: boolean
}) {
  const zeit = email.sent_at ?? email.status_at
  const status = widerspruch ? { label: 'Widerspruch', ton: 'danger' as ChipTon } : STATUS_LABEL[email.status]
  return (
    <li
      role="option"
      aria-selected={cursor}
      data-cursor={cursor || undefined}
      data-cursor-id={email.id}
      onClick={onClick}
      className={cn(
        'border-line text-table ease-brand grid cursor-default grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b px-3 py-2 transition-[background] duration-[var(--t-1)] max-xl:grid-cols-[120px_minmax(0,1fr)] max-md:grid-cols-[minmax(0,1fr)]',
        cursor && 'cursor-bar',
      )}
    >
      {/* „Do 15.10. 09:00“ braucht 113 px Mono – die alte 88-px-Spalte schob die Uhrzeit unter den Namen (Sichtprüfung) */}
      <span className="text-ink-3 tnum font-mono text-[12.5px] whitespace-nowrap max-md:order-3">
        {fmtDatumKurz(zeit)} {fmtZeit(zeit)}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate-1 max-w-[60%] flex-none font-medium">
            <LeadName leadId={email.lead_id} />
          </span>
          <span
            className="truncate-1 text-ink-3 tnum min-w-0 font-mono text-[12px]"
            title={email.to_address ?? undefined}
          >
            {email.to_address ?? '–'}
          </span>
        </span>
        <span className="truncate-1 text-small text-ink-2 block" title={email.subject?.trim() || undefined}>
          {email.subject?.trim() || 'Ohne Betreff'}
        </span>
      </span>
      {/* Unter 1280 px rutschen Status + Aktionen in eine zweite Zeile unter den Namen – sonst bleiben 93 px für den Namen */}
      <span className="flex flex-wrap items-center gap-2 max-xl:col-start-2 max-md:order-2 max-md:col-start-1">
        <Chip ton={status.ton}>{status.label}</Chip>
        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {aktionen}
        </span>
      </span>
    </li>
  )
}
