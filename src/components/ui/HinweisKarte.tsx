import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

export type HinweisKarteProps = {
  text: string
  aktion?: { label: string; onClick: () => void }
  onAusblenden: () => void
  warnung?: boolean
  className?: string
}

/** DESIGN-SYSTEM § 5.6: Rahmen line-strong, Radius md, 10 14, Text ui, Aktion rechts quiet, „Ausblenden (heute)“ als ×. Amber-Text nur bei Budget-Warnung. */
export function HinweisKarte({ text, aktion, onAusblenden, warnung, className }: HinweisKarteProps) {
  return (
    <div
      role="note"
      className={cn(
        'border-line-strong text-ui mb-4 flex items-center gap-3 rounded-md border px-3.5 py-2.5',
        warnung ? 'text-overdue' : 'text-ink',
        className,
      )}
    >
      <span className="flex-1">{text}</span>
      {aktion ? (
        <Button variante="quiet" groesse="S" onClick={aktion.onClick}>
          {aktion.label}
        </Button>
      ) : null}
      <Button
        variante="icon"
        aria-label="Ausblenden (heute)"
        title="Ausblenden (heute)"
        onClick={onAusblenden}
        className="h-7 w-7"
      >
        <X size={14} strokeWidth={1.75} aria-hidden />
      </Button>
    </div>
  )
}
