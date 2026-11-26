// Fortschrittsbalken: Länge = Ist ÷ Soll, Farbe nach Ampel, der Strich zeigt, wo man heute stehen müsste.
import { cn } from '@/components/ui/cn'
import { STATUS_STIL } from './farben'
import type { Status } from './rechnen'

export type BalkenProps = {
  /** 0…1 */
  anteil: number
  /** 0…1; 0 = kein Strich (der Zeitraum hat noch nicht begonnen) */
  tempo: number
  status: Status
  /** wofür der Balken steht („DMs senden · Vincent“) */
  label: string
  /** „37 / 100“ */
  wert: string
  schlank?: boolean
  className?: string
}

const prozent = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10

export function Balken({ anteil, tempo, status, label, wert, schlank, className }: BalkenProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(prozent(anteil))}
      aria-valuetext={wert}
      data-status={status}
      className={cn('bg-surface-pressed relative min-w-0 rounded-full', schlank ? 'h-1.5' : 'h-2', className)}
    >
      <div
        className={cn(
          'ease-brand h-full rounded-full transition-[width,background-color] duration-500',
          STATUS_STIL[status].balken,
        )}
        style={{ width: `${prozent(anteil)}%` }}
      />
      {tempo > 0 ? (
        <span
          aria-hidden
          data-tempo
          className="bg-ink-2 ease-brand absolute -top-[3px] -bottom-[3px] w-0.5 rounded-full shadow-[0_0_0_1.5px_var(--color-surface)] transition-[left] duration-500"
          // 1 px nach links: am Ende des Balkens steht der Strich noch auf ihm
          style={{ left: `calc(${prozent(tempo)}% - 1px)` }}
        />
      ) : null}
    </div>
  )
}
