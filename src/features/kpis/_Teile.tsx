// Kleine Bausteine des KPI-Reiters: Blockkopf, große Ziffer, Marke „aus Sheet“, Stift-Fußnote, Zielpunkt.
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function BlockKopf({ titel, hinweis, rechts }: { titel: string; hinweis?: ReactNode; rechts?: ReactNode }) {
  return (
    <div className="mb-3.5 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-h3 text-ink">{titel}</h2>
        {hinweis ? <span className="text-small text-ink-3">{hinweis}</span> : null}
      </div>
      {rechts ? <div className="flex max-w-full min-w-0 items-center gap-2">{rechts}</div> : null}
    </div>
  )
}

/** Große Ziffer: `xl` (Funnel Zeile 1–2), `md` (Kacheln, übrige Funnel-Zeilen); Ton: ink-bright, ink-2 (Sub-Zeile), ink-3 (Nullwert). */
export function Ziffer({
  groesse = 'md',
  ton = 'bright',
  className,
  children,
  ...rest
}: {
  groesse?: 'xl' | 'md'
  ton?: 'bright' | 'ink-2' | 'ink-3'
  className?: string
  children: ReactNode
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  return (
    <span
      className={cn(
        'tnum font-mono',
        groesse === 'xl' ? 'text-display-xl max-md:text-[48px]' : 'text-display max-md:text-[30px]',
        ton === 'bright' ? 'text-ink-bright' : ton === 'ink-2' ? 'text-ink-2' : 'text-ink-3',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

/** Marke „aus Sheet“: die Zahl stammt nur aus den alten Monatszählern – klein, ohne Farbe. */
export function SheetBadge() {
  return (
    <span
      className="border-line-strong text-ink-3 shrink-0 rounded-xs border px-1.5 py-px text-[13px] font-medium tracking-[0.02em] whitespace-nowrap normal-case"
      title="Zahl aus dem alten KPI-Sheet"
      data-badge="sheet"
    >
      aus Sheet
    </span>
  )
}

/** Stift-Fußnote „Zähler, teilweise manuell“ (Fußnote `zaehler`). */
export function ZaehlerHinweis() {
  return (
    <span
      className="text-small text-ink-3 font-mono"
      title="Zähler, teilweise manuell"
      aria-label="Zähler, teilweise manuell"
      data-fussnote="zaehler"
    >
      ✎
    </span>
  )
}

/** Punkt in der Signalfarbe bei erreichtem Ziel. */
export function ZielPunkt({ text }: { text: string }) {
  return (
    <i
      className="bg-signal inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      title={text}
      aria-label={text}
      role="img"
      data-ziel="erreicht"
    />
  )
}
