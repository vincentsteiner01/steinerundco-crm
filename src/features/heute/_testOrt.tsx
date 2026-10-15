// Test-Hilfe: zeigt den aktuellen Router-Ort (Navigations-Tests). Eigene Datei – oxlint react/only-export-components.
import { useLocation } from 'react-router'

export function Ort() {
  const l = useLocation()
  return <output data-testid="ort">{`${l.pathname}${l.search}`}</output>
}
