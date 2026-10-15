import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

export type EmptyStateProps = {
  titel: string
  satz?: ReactNode
  primaer?: { label: string; onClick: () => void; kbd?: string }
  sekundaer?: { label: string; onClick: () => void; kbd?: string }
  className?: string
}

/** DESIGN-SYSTEM § 5.22: padding 64 0, max. 420 px, Überschrift Headline 32 px (Newsreader), Satz body ink-2, max. eine Primär- + eine Sekundäraktion. Wortlaute: ux § 4.1 / texte/de.ts LEER. */
export function EmptyState({ titel, satz, primaer, sekundaer, className }: EmptyStateProps) {
  return (
    <div className={cn('max-w-[420px] py-16', className)}>
      <h2 className="headline mb-2.5 text-[32px]">{titel}</h2>
      {satz ? <p className="text-body text-ink-2 mb-5">{satz}</p> : null}
      {primaer || sekundaer ? (
        <div className="flex gap-1.5">
          {primaer ? (
            <Button variante="primary" onClick={primaer.onClick} kbd={primaer.kbd}>
              {primaer.label}
            </Button>
          ) : null}
          {sekundaer ? (
            <Button variante="quiet" onClick={sekundaer.onClick} kbd={sekundaer.kbd}>
              {sekundaer.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
