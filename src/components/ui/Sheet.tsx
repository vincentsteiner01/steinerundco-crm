import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'
import { useFokusZurueck } from './useFokusZurueck'

export type SheetProps = {
  offen: boolean
  onOpenChange: (offen: boolean) => void
  titel: string
  breite?: 440 | 640 | 720
  children: ReactNode
  /** Slot im Kopf rechts (vor „Schließen“) */
  kopfRechts?: ReactNode
  /**
   * Ruhiger Kopf (Neustart 25.11.2026, Lead-Blatt): kein Tastenhinweis, Schließen als × mit 44-px-Fläche.
   * Ohne Angabe bleibt der Kopf wie bisher („Schließen Esc“) – so benutzt ihn der E-Mail-Composer.
   */
  ruhig?: boolean
  /**
   * Wohin der Fokus nach dem Schließen geht, wenn es das Element nicht mehr gibt, von dem aus geöffnet wurde (Lead-Blatt:
   * die Karte liegt inzwischen in einer anderen Liste). Ohne Angabe bleibt es dann wie bisher.
   */
  fokusErsatz?: () => HTMLElement | null
  className?: string
}

/** Radix Dialog rechts (DESIGN-SYSTEM § 5.14): 640 px (440/720), surface-raised, shadow-float; mobil Vollbild von unten. */
export function Sheet({
  offen,
  onOpenChange,
  titel,
  breite = 640,
  children,
  kopfRechts,
  ruhig,
  fokusErsatz,
  className,
}: SheetProps) {
  // Nach dem Schließen zurück zu dem Element, von dem aus geöffnet wurde (25.11.2026) – vorher fiel der Fokus auf <body>
  const fokusZurueck = useFokusZurueck(offen, fokusErsatz)
  return (
    <RD.Root open={offen} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="bg-scrim fixed inset-0 z-[60]" />
        <RD.Content
          onCloseAutoFocus={fokusZurueck}
          style={{ ['--sheet-b' as string]: `${breite}px` }}
          className={cn(
            'bg-surface-raised shadow-float fixed z-[61] flex flex-col outline-none',
            'inset-y-0 right-0 w-[min(var(--sheet-b),100vw)] max-md:inset-x-0 max-md:top-[8vh] max-md:w-auto max-md:rounded-t-lg',
            'data-[state=open]:animate-[peek-in_var(--t-3)_var(--ease-brand)]',
            className,
          )}
        >
          <div
            className={cn(
              'border-line flex items-center gap-2 border-b',
              // ruhig: rechts 12 px – das × (20 px in 44 px Fläche) steht so bündig über dem Inhalt (24 px)
              ruhig ? 'py-3 pr-3 pl-6' : 'px-6 pt-5 pb-4 max-md:pt-6',
            )}
          >
            <RD.Title className={cn('text-h2 text-ink-bright', ruhig && 'min-w-0 [overflow-wrap:anywhere]')}>
              {titel}
            </RD.Title>
            <RD.Description className="sr-only">{titel}</RD.Description>
            <span className="flex-1" />
            {kopfRechts}
            <RD.Close asChild>
              {ruhig ? (
                <button
                  type="button"
                  aria-label="Schließen"
                  className="text-ink-2 hover:text-ink hover:bg-surface-hover ease-brand inline-flex size-11 flex-none items-center justify-center rounded-sm transition-[background,color] duration-[var(--t-1)]"
                >
                  <X size={20} strokeWidth={1.75} aria-hidden />
                </button>
              ) : (
                <Button variante="quiet" groesse="S" kbd="Esc" icon={X}>
                  Schließen
                </Button>
              )}
            </RD.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
