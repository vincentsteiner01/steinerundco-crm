// Vertrag (AppShell): `OnboardingTour` – Einführungstour beim ersten Login je Person, Mini-Touren über `tourStarten()`.
// AppShell lädt dieses Modul nachgeladen (nicht im Start-Bundle, E22); die Tour-Oberfläche selbst lädt erst beim Start.
export { OnboardingTour } from './OnboardingTour'
export { tourStarten, TOUR_EVENT, type TourKey } from './ereignis'
