import { useLocation, useSearchParams } from 'react-router'
import { peekLeadId } from '@/app/peekParam'
import { fehlerSchliessen, hatFehlerToast, retryAusfuehren, undoAusfuehren } from '@/components/toast'
import { istEingabe, useHotkeys } from '@/lib/keyboard'

/**
 * Globale Tasten – seit dem Neustart (25.11.2026) nur noch die drei, auf die die Toasts verweisen: Z (Rückgängig), R (erneut
 * versuchen) und Esc. Palette, Tastenliste und Gehe-zu-Akkorde gibt es nicht mehr.
 */
export function GlobaleTasten() {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()

  useHotkeys(
    'global',
    {
      z: () => void undoAusfuehren(),
      r: (e) => {
        if (hatFehlerToast()) {
          e.preventDefault()
          retryAusfuehren()
        }
      },
      escape: (e) => {
        // eine Ebene je Druck: Fehler-Toast → Feld verlassen → Lead-Blatt
        if (fehlerSchliessen()) return
        // Aus einem Feld heraus verlässt Esc nur das Feld (lib/keyboard blurt) – sonst schlösse ein Esc im Notizfeld das
        // Lead-Blatt samt ungespeicherter Eingabe (ux § 5.1, Review)
        if (istEingabe(e.target instanceof Element ? e.target : null)) return
        if (peekLeadId(pathname, params)) {
          const p = new URLSearchParams(params)
          p.delete('lead')
          setParams(p, { replace: true })
        }
      },
    },
    [pathname, params.toString()],
  )
  return null
}
