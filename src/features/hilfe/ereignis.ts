// Hilfe – Start einer Tour von überall (Handbuch „Zeig’s mir“, „Tour erneut starten“, Palette). Die Tour selbst hängt als
// OnboardingTour in der AppShell (public.ts) und hört auf dieses Fenster-Ereignis – so braucht kein Aufrufer die Tour-UI zu laden.

/** Fenster-Ereignis, auf das `OnboardingTour` hört. `detail.tour` = Tour-Schlüssel (Standard: Einführung). */
export const TOUR_EVENT = 'crm:tour'

export const TOUR_KEYS = [
  'onboarding',
  'heute',
  'leads',
  'linkedin',
  'telefon',
  'email',
  'leitfaeden',
  'kpis',
  'import',
  'feedback',
  'recherche',
] as const

export type TourKey = (typeof TOUR_KEYS)[number]

export function istTourKey(v: unknown): v is TourKey {
  return typeof v === 'string' && (TOUR_KEYS as readonly string[]).includes(v)
}

/** Startet eine Tour (Einführung oder eine Mini-Tour zu einem Hilfe-Thema). */
export function tourStarten(tour: TourKey = 'onboarding'): void {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { tour } }))
}
