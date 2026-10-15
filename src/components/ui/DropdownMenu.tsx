import * as RM from '@radix-ui/react-dropdown-menu'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type MenuEintrag = {
  label: string
  kbd?: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export type DropdownMenuProps = {
  trigger: ReactNode
  eintraege: (MenuEintrag | 'trenner')[]
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  titel?: string
  className?: string
}

/** Radix Dropdown (DESIGN-SYSTEM § 5.20): Einträge 36 px ui mit kbd rechts, Cursor `.cursor-bar` (data-highlighted), surface-raised, shadow-float, Radius md. */
export function DropdownMenu({
  trigger,
  eintraege,
  align = 'end',
  side = 'bottom',
  titel,
  className,
}: DropdownMenuProps) {
  return (
    <RM.Root>
      <RM.Trigger asChild>{trigger}</RM.Trigger>
      <RM.Portal>
        <RM.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'bg-surface-raised shadow-float z-[65] max-w-[320px] min-w-[200px] rounded-md p-1.5 outline-none data-[state=open]:animate-[pop-in_var(--t-3)_var(--ease-brand)]',
            className,
          )}
        >
          {titel ? <RM.Label className="label block px-2.5 pt-1.5 pb-1">{titel}</RM.Label> : null}
          {eintraege.map((e, i) =>
            e === 'trenner' ? (
              <RM.Separator key={`t${i}`} className="bg-line my-1.5 h-px" />
            ) : (
              <RM.Item
                key={e.label}
                disabled={e.disabled}
                onSelect={() => e.onSelect()}
                className={cn(
                  'text-ui flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 font-normal outline-none',
                  'data-[highlighted]:cursor-bar data-[disabled]:opacity-45',
                  e.danger ? 'text-danger' : 'text-ink',
                )}
              >
                {e.icon ? <e.icon size={16} strokeWidth={1.75} aria-hidden className="text-ink-3" /> : null}
                <span className="flex-1">{e.label}</span>
                {e.kbd ? <kbd className="kbd">{e.kbd}</kbd> : null}
              </RM.Item>
            ),
          )}
        </RM.Content>
      </RM.Portal>
    </RM.Root>
  )
}
