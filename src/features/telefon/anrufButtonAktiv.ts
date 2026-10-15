// M3 – Welche AnrufButton-Instanz reagiert auf ⌘⇧K (T-18)? Cursor-Zeile, Peek/Dialog – oder der einzige Button der Seite (Vollseite).
const AKTIV_SELEKTOR = '[data-cursor], [aria-selected="true"], [role="dialog"], [data-anruf-aktiv]'

export function istAktiverAnrufButton(el: HTMLElement | null): boolean {
  if (!el) return false
  if (el.closest(AKTIV_SELEKTOR)) return true
  return document.querySelectorAll('[data-anrufbutton]').length === 1
}
