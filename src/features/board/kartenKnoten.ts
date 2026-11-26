// Die Karte eines Leads im Dokument finden (25.11.2026, Fokus nach Zug und nach dem Schließen des Lead-Blatts). Über das
// Attribut verglichen statt per Selektor: die ID kann aus der Adresse stammen (`?lead=`) und beliebige Zeichen enthalten.

/** Das `li[data-karte]` des Leads – innerhalb von `wurzel` (eine Liste) oder im ganzen Dokument. */
export function kartenKnoten(id: string | null, wurzel: ParentNode | null = document): HTMLElement | null {
  if (!id || !wurzel) return null
  return Array.from(wurzel.querySelectorAll<HTMLElement>('[data-karte]')).find((k) => k.dataset.karte === id) ?? null
}

/** Der Name auf der Karte – ihr eigentlicher Knopf (öffnet das Lead-Blatt) und das Ziel für den Fokus. */
export function nameAufKarte(knoten: HTMLElement | null): HTMLElement | null {
  return knoten?.querySelector<HTMLElement>('h3 button') ?? null
}
