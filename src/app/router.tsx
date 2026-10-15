// oxlint-disable react/only-export-components -- Router-Datei: exportiert router + PFADE (BAUPLAN § 3.1.4), kein Fast-Refresh-Ziel
// BAUPLAN § 3.1.4 – Router und Routen (eingefroren). Jede Route lädt lazy eine Datei, die `Component` exportiert.
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NichtGefunden } from './fehler/NichtGefunden'
import { RouteFehler } from './fehler/RouteFehler'
import { AppShell } from './shell/AppShell'

export { PFADE } from './pfade'

/** Erstes Laden einer Lazy-Route: ruhige, leere Fläche (kein Flackern, keine React-Router-Warnung „No HydrateFallback“). */
function ErstesLaden() {
  return <div className="bg-canvas min-h-dvh" aria-busy="true" />
}

export const router = createBrowserRouter([
  {
    path: '/anmelden',
    lazy: () => import('@/features/auth/Anmelden'),
    errorElement: <RouteFehler />,
    HydrateFallback: ErstesLaden,
  },
  {
    Component: RequireAuth, // Layout-Route ohne Pfad
    errorElement: <RouteFehler />,
    HydrateFallback: ErstesLaden,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, element: <Navigate to="/heute" replace /> },
          { path: 'heute', lazy: () => import('@/features/heute/HeuteSeite') },
          { path: 'leads', lazy: () => import('@/features/leads/LeadsSeite') },
          { path: 'leads/neu', lazy: () => import('@/features/leads/LeadNeuSeite') },
          { path: 'leads/papierkorb', lazy: () => import('@/features/leads/PapierkorbSeite') },
          { path: 'leads/:id', lazy: () => import('@/features/leads/LeadSeite') },
          { path: 'pipeline', lazy: () => import('@/features/pipeline/PipelineSeite') },
          { path: 'telefon', lazy: () => import('@/features/telefon/TelefonSeite') },
          { path: 'telefon/anruf/:leadId', lazy: () => import('@/features/telefon/AnrufScreen') },
          { path: 'email', lazy: () => import('@/features/email/EmailSeite') },
          { path: 'email/verfassen', lazy: () => import('@/features/email/VerfassenSeite') },
          { path: 'kpis', lazy: () => import('@/features/kpis/KpisSeite') },
          { path: 'leitfaeden', lazy: () => import('@/features/leitfaeden/LeitfaedenSeite') },
          { path: 'leitfaeden/:id', lazy: () => import('@/features/leitfaeden/LeitfadenSeite') },
          { path: 'import', lazy: () => import('@/features/import/ImportSeite') },
          { path: 'import/schnell', lazy: () => import('@/features/import/SchnellimportSeite') },
          { path: 'import/:batchId', lazy: () => import('@/features/import/ImportErgebnisSeite') },
          { path: 'einstellungen', element: <Navigate to="/einstellungen/profil" replace /> },
          { path: 'einstellungen/:bereich', lazy: () => import('@/features/einstellungen/EinstellungenSeite') },
          { path: '*', Component: NichtGefunden },
        ],
      },
    ],
  },
])
