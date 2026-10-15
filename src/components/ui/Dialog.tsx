import * as RD from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

export type DialogProps = {
  offen: boolean
  onOpenChange: (offen: boolean) => void
  titel: string
  text?: ReactNode
  kinder?: ReactNode
  primaer: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; busy?: boolean }
  abbrechen?: string
  className?: string
}

/** Nur für Unumkehrbares (ux § 4.8). DESIGN-SYSTEM § 5.20: 440 px, surface-raised, Radius lg, shadow-float, Titel h2, Text body ink-2, Buttons rechts; Esc schließt. */
export function Dialog({
  offen,
  onOpenChange,
  titel,
  text,
  kinder,
  primaer,
  abbrechen = 'Abbrechen',
  className,
}: DialogProps) {
  return (
    <RD.Root open={offen} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="bg-canvas/50 fixed inset-0 z-[60] data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]" />
        <RD.Content
          className={cn(
            'bg-surface-raised shadow-float fixed top-1/2 left-1/2 z-[61] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 outline-none',
            'data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]',
            className,
          )}
        >
          <RD.Title className="text-h2 text-ink-bright">{titel}</RD.Title>
          {text ? (
            <RD.Description className="text-body text-ink-2 mt-2.5">{text}</RD.Description>
          ) : (
            <RD.Description className="sr-only">{titel}</RD.Description>
          )}
          {kinder ? <div className="mt-4 grid gap-3.5">{kinder}</div> : null}
          <div className="mt-6 flex justify-end gap-1.5">
            <RD.Close asChild>
              <Button variante="quiet">{abbrechen}</Button>
            </RD.Close>
            <Button
              variante={primaer.danger ? 'primary' : 'primary'}
              onClick={primaer.onClick}
              disabled={primaer.disabled}
              busy={primaer.busy}
              className={
                primaer.danger ? 'bg-danger text-ink-bright hover:bg-danger disabled:hover:bg-danger' : undefined
              }
            >
              {primaer.label}
            </Button>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
