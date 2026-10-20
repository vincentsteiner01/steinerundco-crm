import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

export type SheetProps = {
  offen: boolean
  onOpenChange: (offen: boolean) => void
  titel: string
  breite?: 440 | 640 | 720
  children: ReactNode
  /** Slot im Kopf rechts (vor „Schließen“) */
  kopfRechts?: ReactNode
  className?: string
}

/** Radix Dialog rechts (DESIGN-SYSTEM § 5.14): 640 px (440/720), surface-raised, shadow-float; mobil Vollbild von unten. */
export function Sheet({ offen, onOpenChange, titel, breite = 640, children, kopfRechts, className }: SheetProps) {
  return (
    <RD.Root open={offen} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="bg-scrim fixed inset-0 z-[60]" />
        <RD.Content
          style={{ ['--sheet-b' as string]: `${breite}px` }}
          className={cn(
            'bg-surface-raised shadow-float fixed z-[61] flex flex-col outline-none',
            'inset-y-0 right-0 w-[min(var(--sheet-b),100vw)] max-md:inset-x-0 max-md:top-[8vh] max-md:w-auto max-md:rounded-t-lg',
            'data-[state=open]:animate-[peek-in_var(--t-3)_var(--ease-brand)]',
            className,
          )}
        >
          <div className="border-line flex items-center gap-2 border-b px-6 pt-5 pb-4 max-md:pt-6">
            <RD.Title className="text-h2 text-ink-bright">{titel}</RD.Title>
            <RD.Description className="sr-only">{titel}</RD.Description>
            <span className="flex-1" />
            {kopfRechts}
            <RD.Close asChild>
              <Button variante="quiet" groesse="S" kbd="Esc" icon={X}>
                Schließen
              </Button>
            </RD.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
