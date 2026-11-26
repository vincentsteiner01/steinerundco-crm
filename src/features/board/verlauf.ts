// Lead-Blatt und die Zurück-Taste (25.11.2026): Eine Karte öffnen legt einen Verlaufseintrag an, damit „Zurück“ (Browser,
// Android-Geste) das Blatt schließt und auf dem Board bleibt. Der Eintrag trägt diese Marke – daran erkennt die Hülle
// (LeadOutlet), dass „Schließen“ einen Schritt zurückgehen darf. Ohne Marke (Direktaufruf, Lead-Knöpfe im E-Mail-Bereich)
// gibt es keinen eigenen Eintrag: dort wird nur der Parameter entfernt. Bewusst ohne Importe – die Hülle lädt diese Datei mit.
const MARKE = 'leadBlatt'

/** `state` für die Navigation, die das Blatt öffnet (`navigate(…, { state })` ohne `replace`). */
export const BLATT_IM_VERLAUF: Readonly<Record<string, true>> = { [MARKE]: true }

/** Hat der aktuelle Verlaufseintrag das Blatt geöffnet? Dann führt ein Schritt zurück auf die Seite ohne Blatt. */
export function blattImVerlauf(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[MARKE] === true
}
