// Logik der Formular-Bausteine (ohne Komponenten – oxlint react/only-export-components).
import { useState } from 'react'

/**
 * Entwurf eines Formulars: folgt der Quelle, solange nichts geändert wurde; `geaendert` vergleicht per JSON.
 * `zuruecksetzen` übernimmt die Quelle wieder (nach dem Speichern).
 */
export function useEntwurf<T>(quelle: T | undefined): {
  entwurf: T | undefined
  setEntwurf: (fn: (e: T) => T) => void
  geaendert: boolean
  zuruecksetzen: () => void
} {
  const [entwurf, setEntwurfRoh] = useState<T | undefined>(quelle)
  const [schmutzig, setSchmutzig] = useState(false)
  const quelleJson = JSON.stringify(quelle ?? null)
  // „Zustand aus Props ableiten“ (React-Muster, kein Effekt): Quelle geändert und nichts Eigenes getippt → Entwurf folgt
  const [gesehen, setGesehen] = useState(quelleJson)
  if (quelleJson !== gesehen) {
    setGesehen(quelleJson)
    if (!schmutzig) setEntwurfRoh(quelle)
  }
  const setEntwurf = (fn: (e: T) => T) => {
    setEntwurfRoh((alt) => (alt === undefined ? alt : fn(alt)))
    setSchmutzig(true)
  }
  const zuruecksetzen = () => {
    setEntwurfRoh(quelle)
    setSchmutzig(false)
  }
  const geaendert = schmutzig && JSON.stringify(entwurf ?? null) !== quelleJson
  return { entwurf, setEntwurf, geaendert, zuruecksetzen }
}

/** Ganzzahl im Bereich [min, max] – sonst Fehlertext (ux § 4.9: Pflicht wird beim Speichern markiert). */
export function pruefeZahl(wert: string | number, min: number, max: number, einheit = ''): string | undefined {
  const n = typeof wert === 'number' ? wert : Number(String(wert).replace(',', '.'))
  if (String(wert).trim() === '' || Number.isNaN(n)) return 'Zahl eingeben'
  // E26: Prozent mit schmalem geschütztem Leerzeichen (U+202F), andere Einheiten mit normalem Leerzeichen
  if (n < min || n > max)
    return `Zwischen ${min} und ${max}${einheit ? `${einheit === '%' ? '\u202F' : ' '}${einheit}` : ''}`
  return undefined
}

export const zahl = (s: string | number): number => (typeof s === 'number' ? s : Number(String(s).replace(',', '.')))
