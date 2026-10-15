// localStorage-Komfort (Sektion eingeklappt, Hinweis ausgeblendet, Kopier-Hinweis einmal pro Tag). Jeder Zugriff in try/catch –
// in privaten Fenstern oder ohne Storage läuft die Seite unverändert (BAUPLAN § 3.1.11 Testumgebung ohne Speicher).
export const SPEICHER = {
  sektion: (key: string) => `crm.heute.sektion.${key}`,
  hinweis: (key: string, tag: string) => `crm.heute.hinweis.${key}.${tag}`,
  kopiertHinweis: (tag: string) => `crm.heute.kopiert.${tag}`,
  /** Antworten-Karte „Später“ (+1 Tag): Tag, bis zu dem die Karte ausgeblendet bleibt */
  antwortSpaeter: (leadId: string) => `crm.heute.antwort.${leadId}`,
} as const

export function lies(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function schreibe(key: string, wert: string | null): void {
  try {
    if (wert === null) localStorage.removeItem(key)
    else localStorage.setItem(key, wert)
  } catch {
    // ohne Speicher: nur Sitzungszustand
  }
}
