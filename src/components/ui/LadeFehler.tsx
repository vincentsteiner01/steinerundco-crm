import { useHotkeys } from '@/lib/keyboard'
import { Button } from './Button'
import { cn } from './cn'

export type LadeFehlerProps = {
  /** Ursache, z. B. „Heute konnte nicht geladen werden“ – der nächste Schritt („erneut versuchen“) hängt die Komponente an */
  text: string
  onNochmal: () => void
  className?: string
}

/**
 * Fehlerzeile statt eines falschen Leerzustands (ux § 4.3: Ursache + nächster Schritt): „… – erneut versuchen.“ mit Button
 * „Erneut versuchen R“. `R` gilt nur, solange die Zeile steht (Review-Korrektur Heute/Telefon/E-Mail/Leads).
 */
export function LadeFehler({ text, onNochmal, className }: LadeFehlerProps) {
  useHotkeys('global', { r: () => onNochmal() }, [onNochmal])
  return (
    <div
      role="alert"
      className={cn(
        'border-line-strong text-ui mb-4 flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5',
        className,
      )}
    >
      <span className="text-ink-2 flex-1">{text} – erneut versuchen.</span>
      <Button groesse="S" kbd="R" onClick={onNochmal}>
        Erneut versuchen
      </Button>
    </div>
  )
}
