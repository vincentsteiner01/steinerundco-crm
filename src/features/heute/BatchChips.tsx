// Batch-Chips (ux § 3.1.1 Nr. 3, DESIGN-SYSTEM § 5.6): „Alle 23 · Opener 8 · Kurzfristig 1 9 …“, Nullwerte aus, aktiv filtert alle
// Sektionen; ⌥1–9 / ⌥0 (kbd zeigt „⌥1“) – keine ⌘-Ziffern (BAUPLAN § 1.5 Nr. 23, H-10).
import { cn } from '@/components/ui/cn'
import { gleicherFilter, type BatchChip, type BatchFilter } from './sektionen'

export type BatchChipsProps = {
  chips: BatchChip[]
  aktiv: BatchFilter
  onChange: (f: BatchFilter) => void
  className?: string
}

export function BatchChips({ chips, aktiv, onChange, className }: BatchChipsProps) {
  if (chips.length === 0 || (chips.length === 1 && chips[0]?.zaehler === 0)) return null
  return (
    <div role="group" aria-label="Batch-Filter" className={cn('mb-4 flex flex-wrap gap-1.5', className)}>
      {chips.map((c) => {
        const an = gleicherFilter(c.filter, aktiv)
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={an}
            onClick={() => onChange(an && c.filter !== null ? null : c.filter)}
            className={cn(
              'ease-brand hover:bg-surface-hover hover:text-ink inline-flex h-7 items-center gap-1.5 rounded-xs border px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-[background,color] duration-[var(--t-1)]',
              an ? 'border-line-strong bg-surface-hover text-ink' : 'border-line text-ink-2',
            )}
          >
            {c.label}
            <span className={cn('tnum font-mono text-[11.5px]', an ? 'text-ink' : 'text-ink-3')}>{c.zaehler}</span>
            {c.kbd ? <kbd className="kbd">{c.kbd}</kbd> : null}
          </button>
        )
      })}
    </div>
  )
}
