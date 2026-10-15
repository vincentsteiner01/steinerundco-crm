// Wird per chrome.scripting.executeScript({ files: ['lesen.js'] }) in den geöffneten LinkedIn-Tab gegeben – nur wenn die
// Seitenleiste offen ist oder die Person klickt. Definiert eine Funktion in der isolierten Welt der Erweiterung; der zweite Aufruf
// (executeScript mit func) liest damit die Seite. Kein Klicken, kein Tippen, kein Navigieren, keine Netzwerkanfrage.
import type { Extrakt, LeseOptionen } from '../shared/typen'
import { leseSeite } from './lesen'

declare global {
  // eslint-disable-next-line no-var
  var __sucoCrmLesen: ((opts?: LeseOptionen) => Extrakt) | undefined
}

globalThis.__sucoCrmLesen = (opts: LeseOptionen = {}) =>
  leseSeite(document, location.href, { ...opts, auswahl: String(globalThis.getSelection?.() ?? '') })
