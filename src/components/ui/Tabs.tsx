import { useId, type KeyboardEvent } from 'react'
import { cn } from './cn'

export type TabsProps<K extends string = string> = {
  tabs: { key: K; label: string; zaehler?: number }[]
  wert: K
  onChange: (k: K) => void
  ariaLabel?: string
  className?: string
}

/** Native Tabs (BAUPLAN § 1.5 Nr. 21): role=tablist, Buttons 32 px, aktiv Lime-Unterstrich 2 px; ←/→ wechseln. Router-Tabs: Aufrufer bindet `wert` an `?tab=`. */
export function Tabs<K extends string>({ tabs, wert, onChange, ariaLabel, className }: TabsProps<K>) {
  const id = useId()
  const tasten = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === wert)
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      const ziel = tabs[n]
      if (ziel) {
        onChange(ziel.key)
        ;(e.currentTarget.querySelectorAll('[role=tab]')[n] as HTMLElement | undefined)?.focus()
      }
    }
  }
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={tasten}
      className={cn('border-line flex [scrollbar-width:none] overflow-auto border-b', className)}
    >
      {tabs.map((t) => {
        const aktiv = t.key === wert
        return (
          <button
            key={t.key}
            id={`${id}-${t.key}`}
            role="tab"
            type="button"
            aria-selected={aktiv}
            tabIndex={aktiv ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={cn(
              'text-small ease-brand hover:text-ink relative flex h-8 flex-none items-center gap-1.5 px-3 font-medium whitespace-nowrap transition-[color] duration-[var(--t-1)]',
              aktiv
                ? 'text-ink after:bg-signal after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:content-[""]'
                : 'text-ink-3',
            )}
          >
            {t.label}
            {t.zaehler !== undefined ? (
              <span className="text-ink-3 tnum font-mono text-[11.5px]">{t.zaehler}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
