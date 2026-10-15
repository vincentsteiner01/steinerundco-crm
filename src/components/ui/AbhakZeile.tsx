import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type AbhakZeileProps = {
  cursor: boolean
  name: string
  unternehmen?: string
  meta: ReactNode
  rechts: ReactNode
  onClick: () => void
  /** Häkchen-Button (28 px) links der rechten Aktionen; `angehakt` färbt es Sage */
  onAbhaken?: () => void
  angehakt?: boolean
  ausgewaehlt?: boolean
  className?: string
}

/** DESIGN-SYSTEM § 5.9: 44 px, Haarlinie, 0 12: Name table 500 · Unternehmen small ink-3 · Meta Mono · rechts Häkchen 28 px + Aktionen. Cursor `.cursor-bar`. */
export function AbhakZeile({
  cursor,
  name,
  unternehmen,
  meta,
  rechts,
  onClick,
  onAbhaken,
  angehakt,
  ausgewaehlt,
  className,
}: AbhakZeileProps) {
  return (
    // Listeneintrag mit Knöpfen: keine `option` (deren Kinder sind präsentational, Screenreader verschluckten Häkchen/Aktionen);
    // der Cursor ist `aria-current` (Review A11y)
    <li
      aria-current={cursor || undefined}
      data-cursor={cursor || undefined}
      onClick={onClick}
      className={cn(
        'border-line text-table ease-brand flex h-11 cursor-default items-center gap-3 border-b px-3 transition-[background] duration-[var(--t-1)]',
        cursor && 'cursor-bar',
        ausgewaehlt && !cursor && 'bg-surface-hover',
        className,
      )}
    >
      <span className="truncate-1 min-w-0 font-medium">{name}</span>
      {unternehmen ? <span className="truncate-1 text-small text-ink-3 min-w-0">{unternehmen}</span> : null}
      <span className="text-ink-3 tnum ml-auto font-mono text-[12.5px] whitespace-nowrap">{meta}</span>
      {onAbhaken ? (
        <button
          type="button"
          aria-label="Abhaken"
          aria-pressed={angehakt}
          onClick={(e) => {
            e.stopPropagation()
            onAbhaken()
          }}
          className={cn(
            'ease-brand hover:bg-surface-hover hover:text-ink grid h-7 w-7 flex-none place-items-center rounded-xs border transition-[color,border-color,background] duration-[var(--t-1)]',
            angehakt ? 'border-done text-done' : 'border-line-strong text-ink-3',
          )}
        >
          <Check size={14} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <span className="flex flex-none items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {rechts}
      </span>
    </li>
  )
}
