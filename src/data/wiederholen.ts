// Robuste Einzelaufrufe für Stapel-Aktionen (16.10.2026, Auftragsseite): Der ChatGPT-Agent trug 37 Annahmen ein, nach
// 18 brach die Verbindung ab – die Schleife hing ohne Zeitlimit, und am Ende stand kein Ergebnis da. Jetzt: Zeitlimit je
// Aufruf, Warten auf Netz, zwei Wiederholungen bei Netzwerkfehlern. Nur für idempotente RPCs (z. B. mark_accepted).
import { istNetzwerkfehler } from './queryClient'

export class Zeitueberschreitung extends Error {
  override name = 'TimeoutError'
  constructor() {
    super('Zeitüberschreitung – keine Antwort vom Server.')
  }
}

export function mitZeitlimit<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  const ablauf = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Zeitueberschreitung()), ms)
  })
  return Promise.race([p, ablauf]).finally(() => clearTimeout(t))
}

/** Ist der Browser offline, bis zu `maxMs` auf das `online`-Ereignis warten. */
export function wartenAufNetz(maxMs = 30_000): Promise<void> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined' || navigator.onLine !== false)
    return Promise.resolve()
  return new Promise((resolve) => {
    const fertig = () => {
      clearTimeout(t)
      window.removeEventListener('online', fertig)
      resolve()
    }
    const t = setTimeout(fertig, maxMs)
    window.addEventListener('online', fertig)
  })
}

const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function mitWiederholung<T>(
  fn: () => Promise<T>,
  o: { pausenMs?: readonly number[]; zeitlimitMs?: number; warte?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const pausen = o.pausenMs ?? [2000, 5000]
  const warte = o.warte ?? schlafen
  for (let versuch = 0; ; versuch++) {
    await wartenAufNetz()
    try {
      return await mitZeitlimit(fn(), o.zeitlimitMs ?? 20_000)
    } catch (e) {
      const pause = pausen[versuch]
      if (!istNetzwerkfehler(e) || pause === undefined) throw e
      await warte(pause)
    }
  }
}
