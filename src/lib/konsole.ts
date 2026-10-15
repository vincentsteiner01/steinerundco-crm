// Konsolen-Puffer für das Feedback: die letzten 30 console.error/console.warn/window „error“/„unhandledrejection“ mit
// Zeitstempel. main.tsx lädt das Modul als erstes (Seiteneffekt unten), damit auch Fehler beim Start im Puffer landen.
// Bewusst winzig (initiales Bundle, E22): hier wird nur roh gesammelt. Lesbar gemacht und von Tokens/Schlüsseln befreit wird
// erst beim Melden – features/feedback/konsoleText.ts (`konsolenEintraege()`); nichts verlässt den Browser ungefiltert.

export type KonsolenArt = 'error' | 'warn' | 'fehler' | 'promise'
export type KonsolenRoh = { zeit: string; art: KonsolenArt; args: unknown[] }

export const KONSOLE_MAX = 30
const puffer: KonsolenRoh[] = []
let installiert = false

/** Legt einen Roh-Eintrag ab (max. 30 – der älteste fällt raus). Wirft nie. */
export function merke(art: KonsolenArt, args: readonly unknown[]): void {
  try {
    puffer.push({ zeit: new Date().toISOString(), art, args: [...args] })
    if (puffer.length > KONSOLE_MAX) puffer.shift()
  } catch {
    /* Puffer darf die App nie stören */
  }
}

/** Kopie des Puffers (älteste zuerst), noch roh – nur über features/feedback/konsoleText.ts lesen. */
export function konsolenRoh(): KonsolenRoh[] {
  return puffer.map((e) => ({ ...e, args: [...e.args] }))
}

/** Hängt sich an console.error/warn und die globalen Fehler-Events; idempotent. */
export function installiereKonsole(w: (Window & typeof globalThis) | undefined = globalThis.window): void {
  if (installiert || !w) return
  installiert = true
  for (const art of ['error', 'warn'] as const) {
    const original = w.console[art].bind(w.console)
    w.console[art] = (...args: unknown[]) => {
      merke(art, args)
      original(...args)
    }
  }
  w.addEventListener('error', (e: ErrorEvent) =>
    merke('fehler', [e.error ?? `${e.message} (${e.filename}:${e.lineno})`]),
  )
  w.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => merke('promise', [e.reason]))
}

/** Nur für Tests. */
export function _konsoleLeeren(): void {
  puffer.length = 0
}

installiereKonsole()
