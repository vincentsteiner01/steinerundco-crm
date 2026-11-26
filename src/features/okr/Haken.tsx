// Runde Haken-Felder für kleine, von Hand gezählte Key Results (Soll bis 10): so viele Felder wie das Soll, gefüllt = erledigt.
// Ein leeres Feld bucht +1, ein gefülltes nimmt 1 zurück. Am Telefon ist jede Fläche 44 px groß.
import { Check } from 'lucide-react'
import { cn } from '@/components/ui/cn'

export type HakenProps = {
  /** so viele Felder */
  anzahl: number
  /** so viele davon gefüllt */
  erledigt: number
  /** wofür die Felder stehen („LinkedIn-Posts · Vincent“) */
  label: string
  onPlus: () => void
  onMinus: () => void
  gesperrt?: boolean
}

export function Haken({ anzahl, erledigt, label, onPlus, onMinus, gesperrt }: HakenProps) {
  return (
    // -ml: der Kreis des ersten Felds steht bündig mit dem Text darüber, die Klickfläche ragt nach links
    <div role="group" aria-label={label} className="-ml-1 flex min-w-0 flex-wrap items-center max-md:-ml-2">
      {Array.from({ length: anzahl }, (_, i) => {
        const voll = i < erledigt
        return (
          <button
            key={i}
            type="button"
            aria-pressed={voll}
            aria-label={`${i + 1} von ${anzahl}`}
            disabled={gesperrt}
            onClick={voll ? onMinus : onPlus}
            className="group/haken grid size-9 flex-none place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-45 max-md:size-11"
          >
            <span
              className={cn(
                'ease-brand grid size-7 place-items-center rounded-full border-[1.5px] transition-[background,border-color,color] duration-[var(--t-1)]',
                voll
                  ? 'border-done bg-done text-signal-ink group-hover/haken:border-done-hover group-hover/haken:bg-done-hover'
                  : 'border-deco bg-surface group-hover/haken:border-done group-hover/haken:text-done text-transparent',
              )}
            >
              <Check size={15} strokeWidth={2.5} aria-hidden />
            </span>
          </button>
        )
      })}
    </div>
  )
}
