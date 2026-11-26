// Der heutige Berliner Kalendertag als Hook (KPI-Reiter, 26.11.2026). `heuteBerlin()` beim Rendern reicht nicht: bleibt eine Seite
// über Nacht offen (Browser-Tab oder installierte App), rendert nichts sie neu – „Heute“ bliebe der Vortag, ein Eintrag landete
// am falschen Tag. Der Hook liest den Tag neu, wenn das Fenster wieder sichtbar wird oder den Fokus bekommt, und einmal je Minute.
import { useSyncExternalStore } from 'react'
import { heuteBerlin } from './format'
import type { Tag } from './zeit'

const TAKT_MS = 60_000
const hoerer = new Set<() => void>()

/** Alle Nutzer von `useHeute` lesen den Tag jetzt neu – für Stellen, die gerade bemerkt haben, dass er gewechselt hat. */
export function heutePruefen(): void {
  for (const h of hoerer) h()
}

function abonnieren(melden: () => void): () => void {
  hoerer.add(melden)
  window.addEventListener('focus', melden)
  document.addEventListener('visibilitychange', melden)
  const takt = window.setInterval(melden, TAKT_MS)
  return () => {
    hoerer.delete(melden)
    window.removeEventListener('focus', melden)
    document.removeEventListener('visibilitychange', melden)
    window.clearInterval(takt)
  }
}

const lesen = (): Tag => heuteBerlin()

/** Heutiger Berliner Kalendertag `YYYY-MM-DD`; wechselt er, rendert die Komponente neu. */
export function useHeute(): Tag {
  return useSyncExternalStore(abonnieren, lesen, lesen)
}
