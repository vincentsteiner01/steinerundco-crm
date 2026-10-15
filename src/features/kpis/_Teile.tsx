// Kleine Bausteine des KPI-Dashboards (DESIGN-SYSTEM § 5.15): Blockkopf, Mono-Ziffer, Badge „aus Sheet“, Zielpunkt, Mobil-Abfrage.
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function BlockKopf({ titel, hinweis, rechts }: { titel: string; hinweis?: ReactNode; rechts?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-h3 text-ink">{titel}</h2>
        {hinweis ? <span className="text-small text-ink-3">{hinweis}</span> : null}
      </div>
      {rechts ? <div className="flex items-center gap-2">{rechts}</div> : null}
    </div>
  )
}

export type ZifferTon = 'bright' | 'ink-2' | 'ink-3'

/** Mono-Ziffer: `xl` 72 px (Funnel Zeile 1–2), `md` 40 px; Ton: ink-bright, ink-2 (Sub-Zeile), ink-3 (Nullwert). */
export function Ziffer({
  groesse = 'md',
  ton = 'bright',
  className,
  children,
  ...rest
}: {
  groesse?: 'xl' | 'md'
  ton?: ZifferTon
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

/** Badge „aus Sheet“ (K-09) – klein, ohne Farbe. */
export function SheetBadge() {
  return (
    <span
      className="border-line-strong text-ink-3 rounded-xs border px-1.5 py-px text-[10.5px] font-medium tracking-[0.04em] normal-case"
      title="Wert stammt aus dem KPI-Sheet (Monatszähler), nicht aus Ereignissen"
      data-badge="sheet"
    >
      aus Sheet
    </span>
  )
}

/** Stift-Fußnote „Zähler, teilweise manuell“ (K-09). */
export function ZaehlerHinweis() {
  return (
    <span
      className="text-ink-3 font-mono text-[12px]"
      title="Zähler, teilweise manuell"
      aria-label="Zähler, teilweise manuell"
      data-fussnote="zaehler"
    >
      ✎
    </span>
  )
}

/** Lime-Punkt bei erreichtem Ziel (K-08). */
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
