// BAUPLAN § 3.1.9 `ids.ts`
/** Erste 8 Hex-Zeichen einer UUID (für Dateinamen wie `lead-<kurzId>-<YYYY-MM-DD>.json`, Toasts, Logs). */
export function kurzId(uuid: string | null | undefined): string {
  return (uuid ?? '').replace(/-/g, '').slice(0, 8)
}
