// Fortschritts-Ring der großen Ziele: Prozent in der Mitte, Farbe nach der Ampel des Ziels.
import { cn } from '@/components/ui/cn'
import { fmtAnteil } from '@/lib/format'
import { STATUS_STIL } from './farben'
import type { Status } from './rechnen'

const GROESSE = 64
const STRICH = 6
const RADIUS = (GROESSE - STRICH) / 2
const UMFANG = 2 * Math.PI * RADIUS

export function Ring({ anteil, status, className }: { anteil: number; status: Status; className?: string }) {
  const a = Math.min(1, Math.max(0, anteil))
  const text = fmtAnteil(a)
  return (
    <div
      role="img"
      aria-label={`Fortschritt ${text}`}
      data-status={status}
      className={cn('relative size-16 flex-none', className)}
    >
      <svg width={GROESSE} height={GROESSE} viewBox={`0 0 ${GROESSE} ${GROESSE}`} className="-rotate-90" aria-hidden>
        <circle
          cx={GROESSE / 2}
          cy={GROESSE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STRICH}
          className="stroke-surface-pressed"
        />
        {/* bei 0 gar kein Bogen: ein runder Abschluss zeichnete sonst einen Punkt */}
        {a > 0 ? (
          <circle
            cx={GROESSE / 2}
            cy={GROESSE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STRICH}
            strokeLinecap="round"
            strokeDasharray={UMFANG}
            strokeDashoffset={UMFANG * (1 - a)}
            className={cn('ease-brand transition-[stroke-dashoffset] duration-700', STATUS_STIL[status].ring)}
          />
        ) : null}
      </svg>
      <span
        aria-hidden
        className="text-ink-bright tnum absolute inset-0 grid place-items-center text-[14px] font-semibold"
      >
        {text}
      </span>
    </div>
  )
}
