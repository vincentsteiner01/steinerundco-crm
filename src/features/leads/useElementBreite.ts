// Breite eines Elements (ResizeObserver) – für Container-Regeln, wo die Fensterbreite lügt: ab 1600 px steht der Peek als dritte
// Spalte neben der Leads-Tabelle, die Sidebar nimmt 232 px (Runde 3). `null`, solange nicht gemessen (jsdom, erster Render).
import { useLayoutEffect, useState, type RefObject } from 'react'

export function useElementBreite(ref: RefObject<HTMLElement | null>): number | null {
  const [breite, setBreite] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const messe = () => {
      const w = el.clientWidth
      setBreite(w > 0 ? w : null)
    }
    messe()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(messe)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return breite
}
