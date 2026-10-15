// Breakpoints als Hook (DESIGN-SYSTEM § 4.2). Integration M1–M8: ersetzt sechs lokale Kopien (AppShell, Heute, Leitfäden,
// KPIs, Telefon, Import) – FOUNDATION-WUNSCH M6.
import { useCallback, useSyncExternalStore } from 'react'

export const MEDIEN = {
  /** < 768 px: Telefon (Tab-Leiste, Sheets, Ergebnis-Modus) */
  telefon: '(max-width: 767px)',
  /** ≥ 1024 px: Sidebar statt Icon-Rail */
  desktop: '(min-width: 1024px)',
} as const

/** Trifft die Media-Query zu? Ohne `matchMedia` (SSR, alte Tests) → `false`. */
export function useMediaQuery(abfrage: string): boolean {
  const abonnieren = useCallback(
    (cb: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(abfrage)
      mq.addEventListener?.('change', cb)
      return () => mq.removeEventListener?.('change', cb)
    },
    [abfrage],
  )
  const lesen = useCallback(
    () => (typeof window !== 'undefined' && window.matchMedia?.(abfrage)?.matches) ?? false,
    [abfrage],
  )
  return useSyncExternalStore(abonnieren, lesen, () => false)
}

/** < 768 px (DESIGN-SYSTEM § 4.2). */
export const useIstTelefon = (): boolean => useMediaQuery(MEDIEN.telefon)
