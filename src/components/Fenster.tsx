// Großes Fenster (23.10.2026, Mikes Sales Hub) – Leitfaden lesen/bearbeiten, Schnellnotiz am Telefon: Kopf mit kleiner Kategorie, Titel und
// „Schließen“ rechts oben; Inhalt scrollt; Fuß mit Aktionen. Esc schließt (Bearbeiten fragt vorher, s. onOpenChange).
import * as RD from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

export function Fenster({
  offen,
  onOpenChange,
  oberzeile,
  titel,
  unterTitel,
  fuss,
  children,
  breit = 760,
}: {
  offen: boolean
  onOpenChange: (o: boolean) => void
  oberzeile?: ReactNode
  titel: string
  unterTitel?: ReactNode
  fuss?: ReactNode
  children: ReactNode
  breit?: number
}) {
  return (
    <RD.Root open={offen} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="bg-scrim fixed inset-0 z-[60] data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]" />
        <RD.Content
          style={{ width: `min(${breit}px, calc(100vw - 24px))` }}
          className={cn(
            'bg-surface-raised shadow-float fixed top-1/2 left-1/2 z-[61] flex max-h-[min(88dvh,900px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg outline-none',
            'data-[state=open]:animate-[screen-in_var(--t-3)_var(--ease-brand)]',
          )}
          aria-describedby={undefined}
        >
          <header className="flex items-start gap-4 px-6 pt-5 pb-3 max-md:px-4">
            <div className="min-w-0 flex-1">
              {oberzeile ? <span className="text-ink-3 mb-1 block text-[12px]">{oberzeile}</span> : null}
              <RD.Title className="text-ink-bright text-[20px] leading-tight font-semibold">{titel}</RD.Title>
              {unterTitel ? <div className="mt-2">{unterTitel}</div> : null}
            </div>
            <RD.Close asChild>
              <Button variante="secondary" groesse="S">
                Schließen
              </Button>
            </RD.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 max-md:px-4">{children}</div>
          {fuss ? (
            <footer className="border-line flex flex-wrap items-center gap-2 border-t px-6 py-3.5 max-md:px-4">
              {fuss}
            </footer>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
