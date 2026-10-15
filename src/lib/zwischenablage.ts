// BAUPLAN § 3.1.9 `zwischenablage.ts` / ux § 4.3 – Clipboard API, sonst Fallback (Text markiert anzeigen,
// Hinweis „Text markiert – ⌘C/Teilen“). `'fallback'` heißt: der Aufrufer zeigt den Text selbst markiert an.

/** Kopiert `text`; `'ok'` bei Erfolg, `'fallback'` wenn die Clipboard-API fehlt oder abgelehnt wurde. */
export async function kopieren(text: string): Promise<'ok' | 'fallback'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return 'ok'
    }
  } catch {
    // z. B. iOS Safari ohne Nutzerinteraktion, verweigerte Berechtigung → Fallback
  }
  return execCommandKopieren(text) ? 'ok' : 'fallback'
}

/** Alter Weg über ein unsichtbares Textfeld; funktioniert nur synchron innerhalb einer Nutzeraktion. */
function execCommandKopieren(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const feld = document.createElement('textarea')
  feld.value = text
  feld.setAttribute('readonly', '')
  feld.style.position = 'fixed'
  feld.style.top = '0'
  feld.style.left = '0'
  feld.style.opacity = '0'
  document.body.appendChild(feld)
  try {
    feld.select()
    feld.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    feld.remove()
  }
}

/** Markiert den Inhalt eines Elements (Fallback-Anzeige: „Text markiert – ⌘C/Teilen“). */
export function textMarkieren(el: HTMLElement): void {
  const auswahl = window.getSelection?.()
  if (!auswahl) return
  const bereich = document.createRange()
  bereich.selectNodeContents(el)
  auswahl.removeAllRanges()
  auswahl.addRange(bereich)
}
