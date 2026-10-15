import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type SektionsKopfProps = {
  label: string
  zaehler?: number
  ueberfaellig?: number
  eingeklappt: boolean
  onToggle: () => void
  rechts?: ReactNode
  className?: string
  id?: string
}

/** DESIGN-SYSTEM § 5.6: 32 px, label + Zähler Mono (Überfällig Amber), Chevron rechts, Haarlinie unten, 10 px Abstand zu den Karten. */
export function SektionsKopf({
  label,
  zaehler,
  ueberfaellig,
  eingeklappt,
  onToggle,
  rechts,
  className,
  id,
}: SektionsKopfProps) {
  return (
    <div className={cn('border-line mt-2 mb-2.5 flex h-8 items-center gap-2.5 border-b', className)}>
      <button
        type="button"
        id={id}
        aria-expanded={!eingeklappt}
        onClick={onToggle}
        className="flex h-full flex-1 items-center gap-2.5 text-left"
      >
        <span className="label">{label}</span>
        {zaehler !== undefined ? (
          <span className="text-ink-2 tnum font-mono text-[12px]">
            {zaehler}
            {ueberfaellig ? <span className="text-overdue"> · {ueberfaellig} überfällig</span> : null}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            'text-ink-3 ease-brand ml-auto transition-transform duration-[var(--t-1)]',
            eingeklappt && '-rotate-90',
          )}
        />
      </button>
      {rechts ? <div className="flex items-center gap-1.5">{rechts}</div> : null}
    </div>
  )
}
