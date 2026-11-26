import { fehlerSchliessen, hatFehlerToast, retryAusfuehren, undoAusfuehren } from '@/components/toast'
import { useHotkeys } from '@/lib/keyboard'

/**
 * Globale Tasten – seit dem Neustart (25.11.2026) nur noch die drei, auf die die Toasts verweisen: Z (Rückgängig), R (erneut
 * versuchen) und Esc. Palette, Tastenliste und Gehe-zu-Akkorde gibt es nicht mehr.
 */
export function GlobaleTasten() {
  useHotkeys('global', {
    z: () => void undoAusfuehren(),
    r: (e) => {
      if (hatFehlerToast()) {
        e.preventDefault()
        retryAusfuehren()
      }
    },
    // Esc schließt den Fehler-Toast; aus einem Feld heraus verlässt es das Feld (lib/keyboard blurt, dafür muss die Bindung
    // bestehen). Das Lead-Blatt (?lead=) fasst die Hülle nicht an – sein Sheet schließt sich selbst, mit Rückfrage.
    escape: () => void fehlerSchliessen(),
  })
  return null
}
