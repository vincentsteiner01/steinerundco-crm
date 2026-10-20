import type { ReactNode } from 'react'
import { cn } from './cn'

export type SegmentOption<K extends string = string> = { key: K; label: ReactNode; zaehler?: number; icon?: ReactNode }
export type SegmentProps<K extends string = string> = {
  optionen: SegmentOption<K>[]
  /** `null` = noch nichts gewählt (kein Knopf aktiv, z. B. Anrede im Schnellimport I-09) */
  wert: K | null
  onChange: (k: K) => void
  ariaLabel: string
  klein?: boolean
  className?: string
}

/** Segment wie iOS (helles Design, 20.10.2026): graue Schiene, gewählter Knopf als weißer Schieber mit zartem Schatten. */
export function Segment<K extends string>({ optionen, wert, onChange, ariaLabel, klein, className }: SegmentProps<K>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'bg-surface-hover inline-flex max-w-full [scrollbar-width:none] gap-0.5 overflow-auto rounded-sm p-0.5',
        klein ? 'h-7' : 'h-[34px]',
        className,
      )}
    >
      {optionen.map((o) => {
        const aktiv = o.key === wert
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={aktiv}
            onClick={() => onChange(o.key)}
            className={cn(
              'flex flex-none items-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap',
              'ease-brand hover:text-ink transition-[background,color,box-shadow] duration-[var(--t-1)]',
              klein ? 'text-small px-2.5' : 'px-3 text-[13px]',
              aktiv ? 'bg-surface-raised text-ink-bright shadow-card' : 'text-ink-2',
            )}
          >
            {o.icon}
            {o.label}
            {o.zaehler !== undefined ? (
              <span className={cn('tnum font-mono text-[11.5px]', aktiv ? 'text-ink-2' : 'text-ink-3')}>
                {o.zaehler}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
