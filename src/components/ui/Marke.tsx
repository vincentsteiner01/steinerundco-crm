// Marke (20.10.2026, helles Design): Symbol aus dem Favicon + „Steiner & Co.“ in Systemschrift – wie der Kopf eines
// Notion-Arbeitsbereichs. Ersetzt die kursive Serifen-Wortmarke des dunklen Designs.
import { cn } from './cn'

export type MarkeProps = { groesse?: 's' | 'm' | 'l'; nurSymbol?: boolean; zusatz?: string; className?: string }

const SYMBOL = { s: 20, m: 22, l: 30 } as const

export function Marke({ groesse = 'm', nurSymbol, zusatz, className }: MarkeProps) {
  const px = SYMBOL[groesse]
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <img
        src="/favicon.svg"
        width={px}
        height={px}
        alt=""
        aria-hidden
        className={cn('flex-none', groesse === 'l' ? 'rounded-[8px]' : 'rounded-[6px]')}
      />
      {nurSymbol ? null : (
        <span
          className={cn(
            'text-ink-bright truncate font-semibold tracking-[-0.01em]',
            groesse === 'l' ? 'text-[20px]' : 'text-[15px]',
          )}
        >
          Steiner &amp; Co.
        </span>
      )}
      {zusatz && !nurSymbol ? <span className="label">{zusatz}</span> : null}
    </span>
  )
}
