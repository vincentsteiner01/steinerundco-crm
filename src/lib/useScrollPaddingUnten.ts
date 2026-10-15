// Klebt unten eine Leiste (Ergebnisleiste im Anruf-Screen), bekommt die Seite `scroll-padding-bottom` in ihrer Höhe:
// Fokus- und scrollIntoView-Ziele landen dann über der Leiste statt darunter (Runde 3, Sichtprüfung 1024 × 768).
import { useEffect, useState } from 'react'

/**
 * Gibt einen Callback-Ref für die Leiste zurück. Gemessen wird nur, solange sie wirklich `position: sticky` hat;
 * `merkmal` wechselt, wenn sich die Klebe-Regel ändert (z. B. Anruf läuft) – dann wird neu gemessen.
 */
export function useScrollPaddingUnten(aktiv: boolean, merkmal?: unknown): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!el || !aktiv || typeof document === 'undefined') return
    const root = document.documentElement
    const setzen = () => {
      const klebt = getComputedStyle(el).position === 'sticky'
      root.style.scrollPaddingBottom = klebt ? `${Math.round(el.getBoundingClientRect().height) + 16}px` : ''
    }
    setzen()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(setzen)
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.scrollPaddingBottom = ''
    }
  }, [el, aktiv, merkmal])
  return setEl
}
