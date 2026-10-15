// BAUPLAN § 3.3 / DESIGN-SYSTEM § 5.12 – Kanban-Karte: surface, Rahmen line, Radius md, padding 12; Name Geist 500 14 px ·
// Unternehmen small ink-3 · unten Avatar + Datum Mono (Zeitfarbe) + Schritt-Chip; Badge „12 T ohne Bewegung“ (ux § 3.4: ab 5 Werktagen
// in Beantwortet/Gepitcht, sonst 14 T). Drag: shadow-float + rotate(1deg). Cursor: .cursor-bar.
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { istFrei, naechsteAktionText, schrittText, type LeadZeile } from '@/features/leads/spalten'
import type { Member } from '@/types/domain'
import { ohneBewegungTage } from './logik'

export function Karte({
  lead,
  member,
  zweiter,
  cursor,
  heute,
  feiertage,
  aktion,
  onClick,
}: {
  lead: LeadZeile
  member: Member | null
  zweiter?: Member | null
  cursor: boolean
  heute: string
  feiertage?: readonly string[]
  /** Anhänger für Popover-Aktionen (Beenden/Wiedervorlage) – rendert die Seite in der Karte */
  aktion?: ReactNode
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { stage: lead.stage },
  })
  const { text, ton } = naechsteAktionText(lead, heute)
  const ohne = ohneBewegungTage(lead, heute, feiertage)
  const schritt = schrittText(lead)
  return (
    <article
      ref={setNodeRef}
      data-id={lead.id}
      data-cursor={cursor || undefined}
      aria-selected={cursor || undefined}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'bg-surface border-line text-ink mb-2 cursor-grab rounded-md border p-3 outline-none select-none',
        cursor && 'cursor-bar',
        isDragging && 'shadow-float rotate-1 cursor-grabbing',
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn('min-w-0 flex-1 truncate text-[14px] font-medium', lead.stage === 'beendet' && 'text-ink-2')}
        >
          {lead.full_name ?? '–'}
        </span>
        {lead.firmaGesperrt ? <Chip ton="danger">Firma gesperrt</Chip> : null}
      </div>
      <div className="text-small text-ink-3 truncate">{lead.company_name ?? '–'}</div>
      <div className="mt-2.5 flex items-center gap-2">
        <Avatar member={istFrei(lead) ? null : member} zweiter={zweiter ?? null} />
        <span
          className={cn(
            'tnum font-mono text-[12.5px]',
            ton === 'today' && 'text-signal',
            ton === 'overdue' && 'text-overdue',
            (ton === 'later' || !ton) && 'text-ink-3',
          )}
        >
          {text}
        </span>
        <span className="flex-1" />
        {schritt !== '–' ? <Chip ton="muted">{schritt}</Chip> : null}
      </div>
      {ohne !== null ? (
        <div className="mt-2">
          <Chip ton="muted">{ohne} T ohne Bewegung</Chip>
        </div>
      ) : null}
      {aktion}
    </article>
  )
}
