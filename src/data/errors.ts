// Fehler → eine deutsche Meldung + Retry-Entscheidung (architektur § 4.8, E25, BAUPLAN § 3.1.6 `errors.ts`).
// Keine Technik-Namen im UI; DB-eigene `raise exception`-Texte (P0001) sind bereits deutsch und werden durchgereicht.
import { toastFehler } from '@/components/toast'
import { TOAST } from '@/texte/de'
import { istNetzwerkfehler } from '@/data/queryClient'

export type FehlerInfo = { meldung: string; retry: boolean; code: string | null }

type Roh = {
  code?: string
  status?: number
  message?: string
  details?: string | null
  hint?: string | null
  name?: string
}
const roh = (e: unknown): Roh => (e && typeof e === 'object' ? (e as Roh) : typeof e === 'string' ? { message: e } : {})

export const MELDUNG = {
  gibtEsSchon: 'Gibt es schon – LinkedIn-URL ist bereits vergeben.',
  keinZugriff: 'Kein Zugriff – bitte neu anmelden.',
  sitzungAbgelaufen: 'Sitzung abgelaufen – bitte erneut versuchen.',
  nichtVorhanden: 'Nicht (mehr) vorhanden.',
  ungueltig: (details: string) => (details ? `Ungültiger Wert: ${details}` : 'Ungültiger Wert.'),
  pflichtfeld: 'Pflichtfeld fehlt.',
  verweisFehlt: 'Verweis fehlt – der Datensatz wurde inzwischen gelöscht.',
  konflikt: (wer: string) => `${wer} hat den Lead gerade geändert – neu geladen.`,
  offline: TOAST.offline,
  allgemein: TOAST.nichtGespeichert,
} as const

/** Übersetzt einen PostgREST-/Auth-/Netzwerkfehler in genau eine Nutzermeldung. */
export function fehlerMeldung(e: unknown): FehlerInfo {
  const x = roh(e)
  const code = x.code ?? null
  if (istNetzwerkfehler(e)) return { meldung: MELDUNG.offline, retry: true, code }
  switch (code) {
    case '23505':
      return { meldung: MELDUNG.gibtEsSchon, retry: false, code }
    case '42501':
      return { meldung: MELDUNG.keinZugriff, retry: false, code }
    case 'PGRST301':
      return { meldung: MELDUNG.sitzungAbgelaufen, retry: true, code }
    case 'PGRST116':
      return { meldung: MELDUNG.nichtVorhanden, retry: false, code }
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return { meldung: MELDUNG.ungueltig(x.details ?? ''), retry: false, code }
    case '23502':
      return { meldung: MELDUNG.pflichtfeld, retry: false, code }
    case '23503':
      return { meldung: MELDUNG.verweisFehlt, retry: false, code }
    case 'P0001':
      // plpgsql `raise exception '…'` – Texte aus den Migrationen sind deutsch (z. B. „Lead hat widersprochen – kein Anruf erlaubt“)
      return { meldung: x.message?.trim() || MELDUNG.allgemein, retry: false, code }
    default:
      break
  }
  if (x.status === 401) return { meldung: MELDUNG.keinZugriff, retry: false, code }
  if (x.status === 404) return { meldung: MELDUNG.nichtVorhanden, retry: false, code }
  if (x.status !== undefined && x.status >= 500) return { meldung: MELDUNG.allgemein, retry: true, code }
  return { meldung: MELDUNG.allgemein, retry: true, code }
}

/** Zeigt den Fehler-Toast (bleibt bis R/Esc); `retry` nur, wenn die Ursache es sinnvoll macht. */
export function zeigeFehler(e: unknown, retry?: () => void): FehlerInfo {
  const info = fehlerMeldung(e)
  if (import.meta.env.DEV) console.error(`[crm ${import.meta.env.VITE_APP_VERSION ?? 'dev'}]`, e)
  toastFehler(info.meldung, info.retry ? retry : undefined)
  return info
}

/** Standard-`onError` für useMutation: Toast, kein Throw. */
export const mutationFehler = (e: unknown): void => {
  zeigeFehler(e)
}
