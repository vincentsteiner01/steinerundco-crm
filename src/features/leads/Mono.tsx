// Mono-Zelle der Leads-Tabelle (DESIGN-SYSTEM § 5.10): Geist Mono tabular, Zeitfarbe heute Lime · überfällig Amber · später ink-3.
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function Mono({
  children,
  ton,
  title,
}: {
  children: ReactNode
  ton?: 'today' | 'overdue' | 'later' | null
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'tnum font-mono text-[13px]',
        ton === 'today' && 'text-signal',
        ton === 'overdue' && 'text-overdue',
        ton === 'later' && 'text-ink-3',
        !ton && 'text-ink-2',
      )}
    >
      {children}
    </span>
  )
}
