// Kennzahl-Kacheln (23.10.2026, Mikes Sales Hub). Seit dem Neustart 25.11.2026 hier statt in features/telefon – die Kampagnen-
// Seite (E-Mail) nutzt sie weiter, der Telefon-Bereich ist archiviert.
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Kacheln({ children }: { children: ReactNode }) {
  return <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
}

/** Kennzahl: Label, große Zahl, kurzer Hinweis. */
export function Kachel({
  label,
  wert,
  hinweis,
  ton,
}: {
  label: string
  wert: ReactNode
  hinweis?: string
  ton?: 'overdue' | 'done'
}) {
  return (
    <div className="bg-sidebar min-w-0 rounded-md px-4 py-3.5" data-kachel={label}>
      <span className="text-small text-ink-2 block truncate">{label}</span>
      <span
        className={cn(
          'tnum mt-1 block truncate text-[26px] leading-tight font-semibold',
          ton === 'overdue' ? 'text-overdue' : ton === 'done' ? 'text-done' : 'text-ink-bright',
        )}
      >
        {wert}
      </span>
      {hinweis ? <span className="text-ink-3 mt-0.5 block truncate text-[12px]">{hinweis}</span> : null}
    </div>
  )
}
