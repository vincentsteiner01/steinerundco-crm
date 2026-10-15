import * as RP from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type PopoverProps = {
  trigger: ReactNode
  children: ReactNode
  offen?: boolean
  onOpenChange?: (offen: boolean) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  /** Titel als `label` oben im Popover */
  titel?: string
}

/** DESIGN-SYSTEM § 5.20: surface-raised, Rahmen via shadow-float, Radius md, padding 6; öffnet 220 ms scale .98 → 1. */
export function Popover({
  trigger,
  children,
  offen,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  className,
  titel,
}: PopoverProps) {
  return (
    <RP.Root open={offen} onOpenChange={onOpenChange}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'bg-surface-raised shadow-float z-[65] max-w-[320px] min-w-[200px] rounded-md p-1.5 outline-none',
            'data-[state=open]:animate-[pop-in_var(--t-3)_var(--ease-brand)]',
            className,
          )}
        >
          {titel ? <span className="label block px-2.5 pt-1.5 pb-1">{titel}</span> : null}
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  )
}

export const PopoverClose = RP.Close

/** Eintrag 36 px mit kbd rechts (Popover-Menüs, z. B. Später/Beenden). */
export function PopoverEintrag({
  kbd,
  mono,
  children,
  className,
  aktiv,
  ...rest
}: { kbd?: string; mono?: string; aktiv?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-selected={aktiv}
      className={cn(
        'text-ui hover:bg-surface-hover flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left font-normal disabled:opacity-45',
        aktiv && 'cursor-bar',
        className,
      )}
      {...rest}
    >
      {kbd ? <kbd className="kbd">{kbd}</kbd> : null}
      <span className="flex-1">{children}</span>
      {mono ? <span className="text-ink-3 tnum font-mono text-[12px]">{mono}</span> : null}
    </button>
  )
}
