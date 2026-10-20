// Sparkline (BAUPLAN § 3.6 charts/): kleine Wochenreihe je Leitfaden, reines SVG, Linie ink-2, letzter Punkt ink. Keine Achsen.
import { cn } from '@/components/ui/cn'

export type SparklineProps = {
  werte: readonly number[]
  breite?: number
  hoehe?: number
  label?: string
  className?: string
}

export function Sparkline({ werte, breite = 96, hoehe = 20, label, className }: SparklineProps) {
  const n = werte.length
  const max = Math.max(1, ...werte)
  const punkte = werte.map((w, i) => {
    const x = n === 1 ? breite / 2 : (i / (n - 1)) * (breite - 2) + 1
    const y = hoehe - 1 - (w / max) * (hoehe - 2)
    return [x, y] as const
  })
  const pfad = punkte.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const letzter = punkte[punkte.length - 1]
  return (
    <svg
      width={breite}
      height={hoehe}
      viewBox={`0 0 ${breite} ${hoehe}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block overflow-visible', className)}
      data-sparkline
    >
      {n > 1 ? (
        <polyline points={pfad} fill="none" className="stroke-signal" strokeWidth={1} strokeLinejoin="round" />
      ) : null}
      {letzter ? <circle cx={letzter[0]} cy={letzter[1]} r={1.5} className="fill-signal" /> : null}
    </svg>
  )
}
