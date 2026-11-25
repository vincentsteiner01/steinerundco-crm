import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { GlobaleTasten } from './GlobaleTasten'
import { IconRail } from './IconRail'
import { LeadOutlet } from './LeadOutlet'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'
import { TabLeiste } from './TabLeiste'
import { useSeitenwechselScroll } from './useSeitenwechselScroll'

// Phone-Topbar (Radix-Dropdown ≈ 10 kB gzip) nur unter 768 px laden – auf dem Desktop bleibt sie aus dem initialen Bundle.
const PhoneTopbar = lazy(() => import('./PhoneTopbar').then((m) => ({ default: m.PhoneTopbar })))

/**
 * Rahmen der App (Neustart 25.11.2026): Grid 232px 1fr (≥ 1024), 64px 1fr (768–1023), 1fr (< 768). Enthält nur noch Navigation,
 * Outlet, OfflineBanner, das Lead-Blatt (LeadOutlet, `?lead=`) und die drei globalen Tasten. Toaster: providers.tsx.
 */
export function AppShell() {
  const location = useLocation()
  const telefon = useIstTelefon()
  useSeitenwechselScroll()

  return (
    <div className="relative z-[1] grid min-h-dvh grid-cols-[var(--spacing-sidebar)_1fr] max-lg:grid-cols-[var(--spacing-rail)_1fr] max-md:grid-cols-1">
      {/* Skip-Link (BAUPLAN § 10.3 A-03): erstes fokussierbares Element, springt an der Navigation vorbei */}
      <a
        href="#main"
        className="bg-surface-raised text-ink border-line-strong text-ui fixed top-2 left-2 z-[60] -translate-y-24 rounded-sm border px-3 py-2 focus:translate-y-0"
      >
        Zum Inhalt
      </a>
      <div className="max-lg:hidden">
        <Sidebar />
      </div>
      <div className="hidden max-lg:block max-md:hidden">
        <IconRail />
      </div>
      <div className="min-w-0">
        {telefon ? (
          <Suspense fallback={<header className="border-line bg-canvas sticky top-0 z-30 h-14 border-b" />}>
            <PhoneTopbar />
          </Suspense>
        ) : null}
        <OfflineBanner />
        <main
          id="main"
          tabIndex={-1}
          // Unten Luft für die Tab-Leiste – das Seitenende liegt nie darunter
          className="px-gutter min-w-0 pb-12 outline-none max-md:pb-[calc(var(--spacing-tabbar)+24px+env(safe-area-inset-bottom))]"
        >
          <div key={location.pathname} className="max-w-content animate-screen-in">
            <Outlet />
          </div>
        </main>
      </div>
      <LeadOutlet />
      <div className="md:hidden">
        <TabLeiste />
      </div>
      <GlobaleTasten />
    </div>
  )
}
