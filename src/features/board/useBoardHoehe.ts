// Das Board reicht bis zum Fensterende, jede Liste scrollt für sich – so bleiben die Listenköpfe stehen und die Seite selbst
// scrollt nicht (wie Trello). Übernommen aus dem alten Kanban (Archiv: features/pipeline/useBoardHoehe.ts), dort mit 184 Karten
// in einer Spalte bewährt.
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Kleinste Board-Höhe – darunter scrollt die Seite wieder (sehr kleine Fenster, Tastatur auf dem Telefon). */
export const BOARD_MIN = 320

/** Abstand zum Dokumentanfang über offsetTop – Transformationen (animate-screen-in) zählen so nicht mit. */
function dokumentOben(el: HTMLElement): number {
  let y = 0
  let n: HTMLElement | null = el
  while (n) {
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  return y
}

/** Verfügbare Höhe = Fensterhöhe − Abstand oben − Innenabstand unten des <main> (auf dem Telefon die Tab-Leiste). */
export function boardHoehe(el: HTMLElement, fensterHoehe: number): number {
  const main = el.closest('main')
  const unten = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
  return Math.max(BOARD_MIN, Math.floor(fensterHoehe - dokumentOben(el) - unten))
}

/** `neuMessen`: ändert sich der Wert (z. B. Fehlerzeile erscheint über dem Board), wird neu gemessen. */
export function useBoardHoehe(ref: RefObject<HTMLElement | null>, neuMessen?: unknown): number | undefined {
  const [hoehe, setHoehe] = useState<number>()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const messe = () => setHoehe(boardHoehe(el, window.innerHeight))
    messe()
    window.addEventListener('resize', messe)
    // Kopf bricht um, Fehlerzeile erscheint: alles oberhalb des Boards beobachten
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messe)
    for (const k of Array.from(el.parentElement?.children ?? [])) if (k !== el) ro?.observe(k)
    return () => {
      window.removeEventListener('resize', messe)
      ro?.disconnect()
    }
  }, [ref, neuMessen])
  return hoehe
}
