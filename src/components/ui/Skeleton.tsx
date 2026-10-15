import { useEffect, useState } from 'react'
import { cn } from './cn'

export type SkeletonProps = { zeilen?: number; className?: string; sofort?: boolean }

/** Ruhige Platzhalterlinien (surface-hover, Radius xs, 12 px hoch, 40/60/80 %), erst ab 300 ms, nie Shimmer (DESIGN-SYSTEM § 5.22). */
export function Skeleton({ zeilen = 3, className, sofort }: SkeletonProps) {
  const [sichtbar, setSichtbar] = useState(!!sofort)
  useEffect(() => {
    if (sofort) return
    const t = window.setTimeout(() => setSichtbar(true), 300)
    return () => window.clearTimeout(t)
  }, [sofort])
  const breiten = ['60%', '80%', '40%', '70%', '50%']
  return (
    <div className={cn('grid gap-3', className)} aria-busy aria-live="polite" role="status" aria-label="Lade …">
      {sichtbar
        ? Array.from({ length: zeilen }, (_, i) => (
            <div key={i} className="bg-surface-hover h-3 rounded-xs" style={{ width: breiten[i % breiten.length] }} />
          ))
        : null}
    </div>
  )
}
