// Runde 2 (echte Daten): 184 Karten in „Eröffnet“ machten die Seite 19.700 px hoch – die Spaltenköpfe scrollten weg und die
// horizontale Scrollleiste lag ganz unten. Das Board bekommt deshalb die Höhe bis zum Fensterende; jede Spalte scrollt für sich.
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Kleinste Board-Höhe – darunter scrollt die Seite wieder (sehr kleine Fenster, Tastatur auf dem Telefon). */
export const BOARD_MIN = 320

/** Abstand des Elements zum Dokumentanfang – über offsetTop (Transformationen wie animate-screen-in zählen nicht mit). */
function dokumentOben(el: HTMLElement): number {
  let y = 0
  let n: HTMLElement | null = el
  while (n) {
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  return y
}

/** Verfügbare Höhe = Fensterhöhe − Abstand oben − Innenabstand unten des <main> − Fußzeile (`[data-fuss]`). */
export function boardHoehe(el: HTMLElement, fensterHoehe: number): number {
  const main = el.closest('main')
  const unten = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
  const fuss = el.parentElement?.querySelector<HTMLElement>('[data-fuss]')
  const fussHoehe = fuss && getComputedStyle(fuss).display !== 'none' ? fuss.offsetHeight + 4 : 0
  return Math.max(BOARD_MIN, Math.floor(fensterHoehe - dokumentOben(el) - unten - fussHoehe))
}

export function useBoardHoehe(ref: RefObject<HTMLElement | null>, bereit: boolean): number | undefined {
  const [hoehe, setHoehe] = useState<number>()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !bereit) return
    const messe = () => setHoehe(boardHoehe(el, window.innerHeight))
    messe()
    window.addEventListener('resize', messe)
    // Toolbar bricht um, Seitenkopf rastet ein: alles oberhalb des Boards beobachten
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messe)
    for (const k of Array.from(el.parentElement?.children ?? [])) if (k !== el) ro?.observe(k)
    return () => {
      window.removeEventListener('resize', messe)
      ro?.disconnect()
    }
  }, [ref, bereit])
  return hoehe
}
