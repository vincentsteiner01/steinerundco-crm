import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from './cn'

export type TabsProps<K extends string = string> = {
  tabs: { key: K; label: string; zaehler?: number }[]
  wert: K
  onChange: (k: K) => void
  ariaLabel?: string
  /** In mehrere Zeilen umbrechen statt quer scrollen – alle Tabs bleiben sichtbar (Runde 2: Skript im Anruf-Screen, 9 Tabs in 318 px) */
  umbrechen?: boolean
  className?: string
}

/** Native Tabs (BAUPLAN § 1.5 Nr. 21): role=tablist, Buttons 32 px, aktiv Lime-Unterstrich 2 px; ←/→ wechseln. Router-Tabs: Aufrufer bindet `wert` an `?tab=`. */
export function Tabs<K extends string>({ tabs, wert, onChange, ariaLabel, umbrechen, className }: TabsProps<K>) {
  const id = useId()
  const leiste = useRef<HTMLDivElement | null>(null)
  // Rechter Fade, solange rechts noch Tabs verborgen sind – „Pitc…“ war sonst hart abgeschnitten (Runde 2, Anruf-Screen)
  const [mehrRechts, setMehrRechts] = useState(false)
  const pruefe = useCallback(() => {
    const el = leiste.current
    if (el) setMehrRechts(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])
  useEffect(() => {
    pruefe()
    const el = leiste.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(pruefe)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pruefe, tabs.length])
  // Runde 3 (Wunsch verbindungen.md Nr. 3): der aktive Tab steht beim Öffnen und bei jedem Wechsel in Sicht – bei 390 px lag der
  // 7. Einstellungen-Tab „Verbindungen“ sonst außerhalb der quer scrollenden Leiste. Nur die Leiste scrollt, nie die Seite.
  useEffect(() => {
    const el = leiste.current
    if (!el || umbrechen) return
    const tab = el.querySelector<HTMLElement>('[role=tab][aria-selected=true]')
    if (!tab) return
    const t = tab.getBoundingClientRect()
    const l = el.getBoundingClientRect()
    if (t.left < l.left) el.scrollLeft -= l.left - t.left
    else if (t.right > l.right) el.scrollLeft += t.right - l.right
    pruefe()
  }, [wert, umbrechen, pruefe])
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
      ref={leiste}
      onKeyDown={tasten}
      onScroll={pruefe}
      data-mehr-rechts={mehrRechts || undefined}
      className={cn(
        'border-line flex border-b',
        umbrechen ? 'flex-wrap' : '[scrollbar-width:none] overflow-auto',
        !umbrechen && mehrRechts && '[mask-image:linear-gradient(to_right,black_85%,transparent)]',
        className,
      )}
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
