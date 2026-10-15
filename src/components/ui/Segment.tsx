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

/** DESIGN-SYSTEM § 5.2: Rahmen line-strong, Radius sm, 34 px, Knöpfe ui ink-2, Trenner line, aktiv surface-hover + ink, Zähler Mono 11,5. */
export function Segment<K extends string>({ optionen, wert, onChange, ariaLabel, klein, className }: SegmentProps<K>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'border-line-strong inline-flex max-w-full [scrollbar-width:none] overflow-auto rounded-sm border',
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
              'border-line flex flex-none items-center gap-1.5 border-r font-medium whitespace-nowrap last:border-r-0',
              'ease-brand hover:text-ink transition-[background,color] duration-[var(--t-1)]',
              klein ? 'text-small px-2.5' : 'px-3 text-[13px]',
              aktiv ? 'bg-surface-hover text-ink' : 'text-ink-2',
            )}
          >
            {o.icon}
            {o.label}
            {o.zaehler !== undefined ? (
              <span className={cn('tnum font-mono text-[11.5px]', aktiv ? 'text-ink' : 'text-ink-3')}>{o.zaehler}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
