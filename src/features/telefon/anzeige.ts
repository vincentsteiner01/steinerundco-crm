// Kleine Anzeige-Helfer der Telefon-Liste (Sichtprüfung Runde 2).

/** „verpasst · 00:35“ (ux § 3.5.1): Stunden:Minuten seit der vereinbarten Uhrzeit – ohne Sekunden (Liste rechnet alle 30 s neu). */
export function verpasstDauer(sec: number): string {
  const min = Math.max(0, Math.floor(sec / 60))
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Neuer `scrollLeft`, damit der Tab (offsetLeft/Breite) ganz sichtbar ist; sonst unverändert. */
export function tabSichtbar(scrollLeft: number, breite: number, tabLinks: number, tabBreite: number): number {
  if (tabLinks < scrollLeft) return Math.max(0, tabLinks - 12)
  if (tabLinks + tabBreite > scrollLeft + breite) return tabLinks + tabBreite - breite + 12
  return scrollLeft
}
