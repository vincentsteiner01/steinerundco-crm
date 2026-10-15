// Akkordeon-Zeile der Kanal-Karten (DESIGN-SYSTEM § 5.11): 40 px, Glyph + Name + Zustands-Chip + Chevron; Inhalt darunter.
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import type { Channel } from '@/types/domain'

export function Akkordeon({
  kanal,
  titel,
  chip,
  offen,
  onToggle,
  children,
  immerOffen,
}: {
  kanal: Channel
  titel: string
  chip: ReactNode
  offen: boolean
  onToggle: () => void
  children: ReactNode
  /** Vollseite: Karten nebeneinander, nie eingeklappt */
  immerOffen?: boolean
}) {
  const auf = immerOffen || offen
  return (
    <section className={cn('min-w-0', immerOffen && 'border-line rounded-md border px-4 pb-4')} data-kanal={kanal}>
      <button
        type="button"
        aria-expanded={auf}
        disabled={immerOffen}
        onClick={onToggle}
        className="border-line text-ui flex h-10 w-full items-center gap-2.5 border-b text-left font-medium disabled:cursor-default"
      >
        <Glyph kanal={kanal} aktiv />
        {titel}
        <span className="ml-auto">{chip}</span>
        {!immerOffen ? (
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn('text-ink-3 transition-transform duration-[var(--t-1)]', auf && 'rotate-180')}
          />
        ) : null}
      </button>
      {auf ? <div className="border-line border-b py-3 pb-4">{children}</div> : null}
    </section>
  )
}

/** Felder-Zeile innerhalb einer Karte (zwei Spalten). */
export function KarteFelder({ children }: { children: ReactNode }) {
  // Runde 2: so viele Spalten wie 200 px passen – fest drei bzw. zwei kürzten „in/götz-matthias-al…“ trotz Platz
  return <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-3">{children}</div>
}

export function KarteFeld({
  label,
  wert,
  mono,
  leer = '–',
  warnung,
}: {
  label: string
  wert: ReactNode
  mono?: boolean
  leer?: string
  warnung?: boolean
}) {
  const leerWert = wert === null || wert === undefined || wert === ''
  return (
    <div className="grid min-w-0 gap-[3px]">
      <span className="label">{label}</span>
      <span
        className={cn(
          'truncate py-0.5 text-[14px]',
          mono && 'tnum font-mono text-[13px]',
          warnung ? 'text-overdue' : leerWert ? 'text-ink-4' : mono ? 'text-ink-2' : 'text-ink',
        )}
        title={typeof wert === 'string' ? wert : undefined}
      >
        {leerWert ? leer : wert}
      </span>
    </div>
  )
}

export function KarteAktionen({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>
}
