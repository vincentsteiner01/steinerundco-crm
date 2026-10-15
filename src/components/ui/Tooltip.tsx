import * as RT from '@radix-ui/react-tooltip'
import { useState, type ReactNode } from 'react'
import { cn } from './cn'

type TooltipProps = {
  text: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  /** Tooltip aus (z. B. wenn kein Grund vorliegt) */
  aus?: boolean
  /** Gleicher Elementbaum an/aus (Button mit wechselndem disabledGrund: Fokus und Referenzen bleiben) */
  stabil?: boolean
}

/** DESIGN-SYSTEM § 5.20: surface-pressed, small ink, 4 8, Radius xs, nach 400 ms (TooltipProvider in providers.tsx). Nie als einzige Erklärung einer Taste. */
export function Tooltip({ text, children, side = 'top', className, aus, stabil }: TooltipProps) {
  const [offen, setOffen] = useState(false)
  const leer = aus || text === null || text === undefined || text === ''
  if (leer && !stabil) return <>{children}</>
  return (
    <RT.Root open={leer ? false : offen} onOpenChange={setOffen}>
      <RT.Trigger asChild>{children}</RT.Trigger>
      {leer ? null : (
        <RT.Portal>
          <RT.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'bg-surface-pressed text-small text-ink shadow-toast z-[80] max-w-[280px] rounded-xs px-2 py-1',
              className,
            )}
          >
            {text}
          </RT.Content>
        </RT.Portal>
      )}
    </RT.Root>
  )
}

export const TooltipProvider = RT.Provider
