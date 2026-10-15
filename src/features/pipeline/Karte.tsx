// BAUPLAN § 3.3 / DESIGN-SYSTEM § 5.12 – Kanban-Karte: surface, Rahmen line, Radius md, padding 12; Name Geist 500 14 px ·
// Unternehmen small ink-3 · unten Avatar + Datum Mono (Zeitfarbe) + Schritt-Chip; Badge „12 T ohne Bewegung“ (ux § 3.4: ab 5 Werktagen
// in Beantwortet/Gepitcht, sonst 14 T). Drag: shadow-float + rotate(1deg). Cursor: .cursor-bar.
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { istFrei, naechsteAktionKurz, naechsteAktionText, schrittText, type LeadZeile } from '@/features/leads/spalten'
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
  // Genau ein Datum (Zeitfarbe); überfällig mit sichtbarem „−7 T“ (DESIGN-SYSTEM: Datum + −n T, Runde 2), Langform im title
  const { text, ton } = naechsteAktionKurz(lead, heute)
  const lang = naechsteAktionText(lead, heute).text
  const minus = ton === 'overdue' && lang.startsWith(text) && lang !== text ? lang.slice(text.length).trim() : null
  const ohne = ohneBewegungTage(lead, heute, feiertage)
  // Rückruf: Uhrzeit steht schon am Datum – der Chip sagt nur „Rückruf“ (sonst „Di 06.10. 09:00 · Rückruf 09:00“)
  const schritt = lead.next_action_kind === 'rueckruf' && lead.stage !== 'beendet' ? 'Rückruf' : schrittText(lead)
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
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn('min-w-0 flex-1 truncate text-[14px] font-medium', lead.stage === 'beendet' && 'text-ink-2')}
          title={lead.full_name ?? undefined}
        >
          {lead.full_name ?? '–'}
        </span>
        {lead.firmaGesperrt ? (
          <Chip ton="danger" className="shrink-0">
            Firma gesperrt
          </Chip>
        ) : null}
      </div>
      <div className="text-small text-ink-3 truncate" title={lead.company_name ?? undefined}>
        {lead.company_name ?? '–'}
      </div>
      {/* Meta-Zeile: bricht nie um – Avatar und Datum fest, Schritt-Chip kürzt mit Ellipse (data-meta für den Test) */}
      <div className="mt-2.5 flex min-w-0 flex-nowrap items-center gap-2" data-meta>
        <Avatar member={istFrei(lead) ? null : member} zweiter={zweiter ?? null} className="shrink-0" />
        <span
          className={cn(
            'tnum shrink-0 font-mono text-[12.5px] whitespace-nowrap',
            ton === 'today' && 'text-signal',
            ton === 'overdue' && 'text-overdue',
            (ton === 'later' || !ton) && 'text-ink-3',
          )}
          title={lead.next_action_label ? `${lang} · ${lead.next_action_label}` : lang}
        >
          {text}
          {minus ? <span className="ml-1.5">{minus}</span> : null}
        </span>
        {schritt !== '–' ? (
          <Chip ton="muted" title={schritt} className="ml-auto min-w-0 shrink [&>span]:min-w-0 [&>span]:truncate">
            {schritt}
          </Chip>
        ) : null}
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
