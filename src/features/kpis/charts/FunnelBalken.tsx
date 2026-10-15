// DESIGN-SYSTEM § 5.15 Funnel: Haarlinien-Balken – 1 px line-strong, Füllung 3 px ink 90 %, flach, kein Gradient. Reines SVG.
import { cn } from '@/components/ui/cn'

export type FunnelBalkenProps = {
  /** Anteil 0…1 (null → leerer Balken) */
  anteil: number | null
  className?: string
}

export function FunnelBalken({ anteil, className }: FunnelBalkenProps) {
  const breite = anteil === null ? 0 : Math.max(0, Math.min(1, anteil)) * 100
  return (
    <svg
      width="100%"
      height={3}
      className={cn('block max-w-[200px] overflow-visible', className)}
      aria-hidden
      data-funnel-balken
      data-anteil={anteil === null ? undefined : breite.toFixed(0)}
    >
      <line x1="0" x2="100%" y1={1.5} y2={1.5} className="stroke-line-strong" strokeWidth={1} />
      {breite > 0 ? (
        <rect x={0} y={0} width={`${breite.toFixed(2)}%`} height={3} className="fill-ink opacity-90" />
      ) : null}
    </svg>
  )
}
