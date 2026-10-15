import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/authStore'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { GlobaleTasten } from './GlobaleTasten'
import { IconRail } from './IconRail'
import { OfflineBanner } from './OfflineBanner'
import { PeekOutlet } from './PeekOutlet'
import { Sidebar } from './Sidebar'
import { TabLeiste } from './TabLeiste'

// Palette (cmdk) und Tastenliste erst beim ersten Öffnen laden – hält das initiale Bundle unter E22.
const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))
const ShortcutHilfe = lazy(() => import('./ShortcutHilfe').then((m) => ({ default: m.ShortcutHilfe })))
// Phone-Topbar (Radix-Dropdown ≈ 10 kB gzip) nur unter 768 px laden – auf dem Desktop bleibt sie aus dem initialen Bundle.
const PhoneTopbar = lazy(() => import('./PhoneTopbar').then((m) => ({ default: m.PhoneTopbar })))
// Feedback-Knopf (⌥F) und Onboarding-Tour: nachgeladen, nicht im Start-Bundle (E22)
const FeedbackKnopf = lazy(() => import('@/features/feedback/public').then((m) => ({ default: m.FeedbackKnopf })))
const OnboardingTour = lazy(() => import('@/features/hilfe/public').then((m) => ({ default: m.OnboardingTour })))

/**
 * BAUPLAN § 3.1.5: Grid 232px 1fr (≥ 1024), 64px 1fr (768–1023), 1fr (< 768); ≥ 1600 mit offenem Peek 232px 1fr 440px.
 * Enthält Outlet, PeekOutlet, OfflineBanner, ShortcutHilfe, CommandPalette und die globalen Tasten. Toaster: providers.tsx.
 */
export function AppShell() {
  const [params] = useSearchParams()
  const peekOffen = !!params.get('lead')
  const location = useLocation()
  const navigate = useNavigate()
  const abmelden = useAuth((s) => s.abmelden)
  const setPaletteOffen = useUiStore((s) => s.setPaletteOffen)
  const paletteOffen = useUiStore((s) => s.paletteOffen)
  const hilfeOffen = useUiStore((s) => s.hilfeOffen)
  const telefon = useIstTelefon()

  useEffect(() => {
    const h = () => void abmelden(false).then(() => navigate(PFADE.anmelden, { replace: true }))
    window.addEventListener('crm:abmelden', h)
    return () => window.removeEventListener('crm:abmelden', h)
  }, [abmelden, navigate])

  // Palette und Hilfe schließen beim Seitenwechsel
  useEffect(() => {
    setPaletteOffen(false)
  }, [location.pathname, setPaletteOffen])

  return (
    <div
      className={cn(
        'relative z-[1] grid min-h-dvh grid-cols-[var(--spacing-sidebar)_1fr] max-lg:grid-cols-[var(--spacing-rail)_1fr] max-md:grid-cols-1',
        peekOffen && 'split:grid-cols-[var(--spacing-sidebar)_1fr_var(--spacing-peek)]',
      )}
    >
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
          className="px-gutter min-w-0 pb-16 outline-none max-md:pb-[calc(var(--spacing-tabbar)+24px+env(safe-area-inset-bottom))]"
        >
          <div key={location.pathname} className="max-w-content animate-screen-in">
            <Outlet />
          </div>
        </main>
      </div>
      <PeekOutlet />
      <div className="md:hidden">
        <TabLeiste />
      </div>
      <Suspense fallback={null}>
        {paletteOffen ? <CommandPalette /> : null}
        {hilfeOffen ? <ShortcutHilfe /> : null}
        <FeedbackKnopf />
        <OnboardingTour />
      </Suspense>
      <GlobaleTasten />
    </div>
  )
}
