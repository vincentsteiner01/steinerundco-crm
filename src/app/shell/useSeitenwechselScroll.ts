// Runde 2 (echte Daten): beim Seitenwechsel blieb die Scrollposition stehen – /leads auf 1500 px, Klick auf „Pipeline“ → die
// Pipeline öffnete ebenfalls bei 1500 px mitten in „Eröffnet“. Nur ein Wechsel des Pfads setzt zurück; `?lead=` (Peek), Filter und
// Ansichten ändern nur die Suche und behalten die Position.
import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'

export function useSeitenwechselScroll(): void {
  const { pathname } = useLocation()
  const erster = useRef(true)
  useLayoutEffect(() => {
    if (erster.current) {
      erster.current = false
      return
    }
    window.scrollTo(0, 0)
  }, [pathname])
}
