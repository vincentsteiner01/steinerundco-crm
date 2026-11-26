// Logik der Formular-Bausteine (ohne Komponenten – oxlint react/only-export-components).
import { useState } from 'react'

/**
 * Entwurf eines Formulars: folgt der Quelle, solange nichts geändert wurde; `geaendert` vergleicht per JSON.
 * `zuruecksetzen` (nach dem Speichern): der Entwurf gilt als gespeichert und folgt der Quelle ab ihrer nächsten Änderung.
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
  // Der Entwurf bleibt stehen – er IST der eben gespeicherte Stand. Früher (bis 25.11.2026) schrieb diese Funktion die Quelle
  // aus dem Render des Klicks zurück: Im Formular stand dann wieder der alte Stand, und das nächste Speichern überschrieb das
  // eben Gespeicherte. Die Quelle selbst kommt erst mit dem Neuladen nach (Profil) oder ist schon weiter (optimistisch).
  const zuruecksetzen = () => setSchmutzig(false)
  const geaendert = schmutzig && JSON.stringify(entwurf ?? null) !== quelleJson
  return { entwurf, setEntwurf, geaendert, zuruecksetzen }
}
