// Einführungstour – Merker je Person in `member_profiles.preferences.onboarding_v1` (`done` | `skipped`; fehlt = noch nie gesehen).
// Dasselbe Muster für die Recherche-Tour (`tour_recherche_v1`, 29.10.2026): startet einmal beim ersten Besuch von Auftrag.
// Reine Funktionen, damit Lesen/Mergen ohne DOM und ohne Netz testbar sind. Geschrieben wird über `useProfilSpeichern` (src/data).
import type { Json } from '@/types/database'

export const ONBOARDING_KEY = 'onboarding_v1'
export const RECHERCHE_TOUR_KEY = 'tour_recherche_v1'

export type OnboardingStatus = 'done' | 'skipped'

const istObjekt = (v: unknown): v is Record<string, Json | undefined> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Gelesener Status; alles Unbekannte (fehlt, null, andere Werte) = `null` → Tour startet beim nächsten Besuch von Heute. */
export function onboardingStatus(preferences: Json | null | undefined, key = ONBOARDING_KEY): OnboardingStatus | null {
  if (!istObjekt(preferences)) return null
  const v = preferences[key]
  return v === 'done' || v === 'skipped' ? v : null
}

/** Bisherige `preferences` mit neuem Status; alle anderen Schlüssel (Kanäle, Realtime-Toasts …) bleiben unverändert. */
export function mitOnboarding(
  preferences: Json | null | undefined,
  status: OnboardingStatus | null,
  key = ONBOARDING_KEY,
): Json {
  const alt = istObjekt(preferences) ? preferences : {}
  const neu: Record<string, Json | undefined> = { ...alt }
  if (status === null) delete neu[key]
  else neu[key] = status
  return neu as Json
}

/**
 * Was am Ende einer Einführungstour gespeichert wird – `null` = nichts schreiben.
 * Fertig → `done` (falls nicht schon). Überspringen → `skipped`, aber nie ein `done` überschreiben (erneuter Start aus der Hilfe).
 */
export function statusNachEnde(
  bisher: OnboardingStatus | null,
  ende: 'fertig' | 'uebersprungen',
): OnboardingStatus | null {
  if (ende === 'fertig') return bisher === 'done' ? null : 'done'
  return bisher === null ? 'skipped' : null
}
