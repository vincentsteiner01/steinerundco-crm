// oxlint-disable react/only-export-components -- Router-Datei: exportiert router + PFADE (BAUPLAN § 3.1.4), kein Fast-Refresh-Ziel
// BAUPLAN § 3.1.4 – Router und Routen. Jede Route lädt lazy eine Datei, die `Component` exportiert.
// Neustart 25.11.2026: nur noch Leads (Board), Leitfäden, E-Mail, Team, Einstellungen, Hilfe. Alte Adressen (Lesezeichen,
// installierte App, Chrome-Erweiterung) leiten auf das Board um, statt auf „Seite nicht gefunden“ zu landen.
import { createBrowserRouter, Navigate, useParams, type RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RouteFehler } from './fehler/RouteFehler'
import { PFADE } from './pfade'
import { AppShell } from './shell/AppShell'

export { PFADE } from './pfade'

/** Erstes Laden einer Lazy-Route: ruhige, leere Fläche (kein Flackern, keine React-Router-Warnung „No HydrateFallback“). */
function ErstesLaden() {
  return <div className="bg-canvas min-h-dvh" aria-busy="true" />
}

/** Alte Detailadresse `/leads/:id` → Board mit offenem Lead-Blatt (`/leads?lead=<id>`). */
function LeadUmleitung() {
  const { id } = useParams()
  return <Navigate to={id ? PFADE.lead(id) : PFADE.leads} replace />
}

const zumBoard = <Navigate to={PFADE.leads} replace />

/** Seiten des alten CRM (Stand `archiv-crm-v1`) – alle führen aufs Board. */
const ALTE_PFADE = [
  'heute',
  'auftrag/*',
  'pipeline',
  'leads/neu',
  'leads/papierkorb',
  'leads/pipeline',
  'telefon/*',
  'kpis',
  'umsatz',
  'import/*',
  'feedback',
]

/** Routentabelle – getrennt vom Router exportiert, damit der Test die Weiterleitungen ohne Browser prüfen kann. */
export const ROUTEN: RouteObject[] = [
  {
    path: '/anmelden',
    lazy: () => import('@/features/auth/Anmelden'),
    errorElement: <RouteFehler />,
    HydrateFallback: ErstesLaden,
  },
  // Öffentlich: Abmelden aus E-Mail-Kampagnen (Link aus der Kopfzeile List-Unsubscribe, 01.11.2026)
  { path: '/abmelden', lazy: () => import('@/features/mailing/Abmelden'), HydrateFallback: ErstesLaden },
  {
    Component: RequireAuth, // Layout-Route ohne Pfad
    errorElement: <RouteFehler />,
    HydrateFallback: ErstesLaden,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, element: zumBoard },
          { path: 'leads', lazy: () => import('@/features/board/BoardSeite') },
          { path: 'leads/:id', Component: LeadUmleitung },
          { path: 'leitfaeden', lazy: () => import('@/features/leitfaeden/Leitfaeden') },
          { path: 'leitfaeden/:id', element: <Navigate to={PFADE.leitfaeden} replace /> },
          { path: 'email', lazy: () => import('@/features/email/EmailSeite') },
          { path: 'email/verfassen', lazy: () => import('@/features/email/VerfassenSeite') },
          { path: 'email/kampagnen', lazy: () => import('@/features/mailing/KampagnenSeite') },
          { path: 'email/kampagnen/:id', lazy: () => import('@/features/mailing/KampagneSeite') },
          { path: 'email/antworten', lazy: () => import('@/features/mailing/AntwortenSeite') },
          { path: 'email/postfaecher', lazy: () => import('@/features/mailing/PostfaecherSeite') },
          { path: 'team', lazy: () => import('@/features/team/TeamSeite') },
          { path: 'hilfe', lazy: () => import('@/features/hilfe/HilfeSeite') },
          { path: 'hilfe/:thema', lazy: () => import('@/features/hilfe/HilfeSeite') },
          { path: 'einstellungen', element: <Navigate to="/einstellungen/profil" replace /> },
          { path: 'einstellungen/:bereich', lazy: () => import('@/features/einstellungen/EinstellungenSeite') },
          ...ALTE_PFADE.map((path) => ({ path, element: zumBoard })),
          // 404 nachgeladen: hält Seitenkopf/EmptyState aus dem Start-Bundle (E22)
          { path: '*', lazy: () => import('./fehler/NichtGefunden').then((m) => ({ Component: m.NichtGefunden })) },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(ROUTEN)
