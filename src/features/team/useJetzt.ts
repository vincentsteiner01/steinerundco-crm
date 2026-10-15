// Minütlich neu rechnen: „zuletzt aktiv vor 4 Min.“ und „Stand 11:52“ bleiben nicht stehen.
import { useEffect, useState } from 'react'

export function useJetzt(intervallMs = 60_000): Date {
  const [jetzt, setJetzt] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), intervallMs)
    return () => window.clearInterval(t)
  }, [intervallMs])
  return jetzt
}
