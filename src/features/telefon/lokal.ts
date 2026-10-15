// Kleine, fehlertolerante localStorage-Helfer (M3). Jeder Zugriff in try/catch – private Fenster, Safari-Quota, Tests ohne Storage.

export function lokalLesen<T>(key: string): T | null {
  try {
    const roh = localStorage.getItem(key)
    return roh ? (JSON.parse(roh) as T) : null
  } catch {
    return null
  }
}

export function lokalSchreiben(key: string, wert: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(wert))
  } catch {
    // kein Storage – der Zustand lebt dann nur im Speicher der Komponente
  }
}

export function lokalEntfernen(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // s. o.
  }
}

/** UUID für lokale Sitzungen (Call-Block); Fallback ohne `crypto.randomUUID`. */
export function neueId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // Fallback unten
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}
