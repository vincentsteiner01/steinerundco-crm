// Gemeinsame Bausteine der Telefon-Ansichten und der Umsatzseite (23.10.2026, Mikes Sales Hub): Kennzahl-Kacheln oben,
// Balkenzeile (Trichter, Conversions).
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function Kacheln({ children }: { children: ReactNode }) {
  return <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
}

/** Kennzahl wie in Mikes Sales Hub: Label, große Zahl, kurzer Hinweis. */
export function Kachel({
  label,
  wert,
  hinweis,
  ton,
}: {
  label: string
  wert: ReactNode
  hinweis?: string
  ton?: 'overdue' | 'done'
}) {
  return (
    <div className="bg-sidebar min-w-0 rounded-md px-4 py-3.5" data-kachel={label}>
      <span className="text-small text-ink-2 block truncate">{label}</span>
      <span
        className={cn(
          'tnum mt-1 block truncate text-[26px] leading-tight font-semibold',
          ton === 'overdue' ? 'text-overdue' : ton === 'done' ? 'text-done' : 'text-ink-bright',
        )}
      >
        {wert}
      </span>
      {hinweis ? <span className="text-ink-3 mt-0.5 block truncate text-[12px]">{hinweis}</span> : null}
    </div>
  )
}

/** Balken mit Label links und Wert rechts (Trichter, Conversions). */
export function Balkenzeile({
  label,
  anteil,
  wert,
  leise,
}: {
  label: string
  anteil: number
  wert: ReactNode
  leise?: boolean
}) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 max-md:grid-cols-[minmax(0,1fr)_auto]">
      <span className="text-ink-2 min-w-0 truncate text-[13px]" title={label}>
        {label}
      </span>
      <span
        className="bg-surface-hover block h-2 w-full overflow-hidden rounded-full max-md:order-3 max-md:col-span-2"
        aria-hidden
      >
        <span
          className={cn('block h-full rounded-full', leise ? 'bg-signal/45' : 'bg-signal')}
          style={{ width: `${Math.round(Math.min(1, Math.max(0, anteil)) * 100)}%` }}
        />
      </span>
      <span className="tnum text-ink text-right font-mono text-[12.5px]">{wert}</span>
    </li>
  )
}
