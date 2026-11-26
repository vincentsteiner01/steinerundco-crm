import { useCallback, useLayoutEffect, useRef } from 'react'

/** Der Seiteninhalt (`<main>` der Hülle: tabIndex -1, kein sichtbarer Ring) – Ersatzziel, wenn der Auslöser weg ist. */
export const seitenInhalt = (): HTMLElement | null => document.getElementById('main')

/**
 * Fokus-Rückgabe für Fenster ohne Radix-Auslöser (Sheet, Dialog, Leitfaden-Fenster – 25.11.2026). Ohne `RD.Trigger` weiß Radix
 * nicht, wohin der Fokus nach dem Schließen gehört: er fiel auf <body>, Tab begann wieder am Seitenanfang.
 * Der Hook merkt sich beim Öffnen das Element mit dem Fokus (die Karte, der Knopf) – im Layout-Effekt, also bevor Radix den
 * Inhalt ins Portal hängt und ein autoFocus-Feld den Fokus nimmt – und liefert den Handler für `onCloseAutoFocus`.
 * Gibt es das Element nicht mehr (Karte verschoben oder entfernt), fragt er `ersatz`; ohne Ziel bleibt alles wie bisher.
 */
export function useFokusZurueck(offen: boolean, ersatz?: () => HTMLElement | null): (e: Event) => void {
  const vorher = useRef<HTMLElement | null>(null)
  const ersatzRef = useRef(ersatz)
  useLayoutEffect(() => {
    ersatzRef.current = ersatz
  })
  useLayoutEffect(() => {
    if (!offen) return
    const aktiv = document.activeElement
    vorher.current = aktiv instanceof HTMLElement && aktiv !== document.body ? aktiv : null
  }, [offen])
  return useCallback((e: Event) => {
    const ziel = vorher.current?.isConnected ? vorher.current : (ersatzRef.current?.() ?? null)
    if (!ziel) return
    // sonst ruft Radix danach den (fehlenden) Auslöser und lässt den Fokus auf <body>
    e.preventDefault()
    // der Seiteninhalt ist höher als das Fenster: ihn zu fokussieren darf die Seite nicht an den Anfang rollen
    ziel.focus({ preventScroll: ziel === seitenInhalt() })
  }, [])
}
