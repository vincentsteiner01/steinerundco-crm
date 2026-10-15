import { lazy, Suspense, useCallback, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { peekLeadId } from '@/app/peekParam'
import { useUiStore } from '@/app/uiStore'

// Container (PeekPanel) und Inhalt (M2: Kanal-Karten, Timeline, Aktionen, Sequenzen …) laden erst beim ersten `?lead=` und
// gemeinsam (kein Wasserfall) – hält das initiale JS unter E22 (≤ 220 kB gzip).
const LeadPeek = lazy(async () => {
  const [{ PeekPanel }, { LeadPanel, PeekKopfAktionen }] = await Promise.all([
    import('@/components/peek'),
    import('@/features/leads/public'),
  ])
  function LeadPeekGeladen({ leadId }: { leadId: string }) {
    return (
      <PeekPanel leadId={leadId} kopfRechts={<PeekKopfAktionen leadId={leadId} />}>
        <LeadPanel leadId={leadId} />
      </PeekPanel>
    )
  }
  return { default: LeadPeekGeladen }
})

/**
 * Liest `?lead=` auf jeder Liste (E19) und rendert `features/leads/public → LeadPanel` im Container `components/peek/PeekPanel`
 * (Overlay 440 px · dritte Spalte ≥ 1600 px · Sheet < 1024 px; Esc, ←/→ über uiStore.peekListe, Fokusfalle). Hört auf das
 * Event `crm:peek` (Palette-Treffer, Realtime-Toast) und setzt dann `?lead=` auf der aktuellen Route (ux S-07).
 */
export function PeekOutlet() {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const leadId = peekLeadId(pathname, params)

  const oeffne = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params)
      p.set('lead', id)
      setParams(p, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<{ leadId?: string }>).detail?.leadId
      if (id) oeffne(id)
    }
    window.addEventListener('crm:peek', h)
    return () => window.removeEventListener('crm:peek', h)
  }, [oeffne])

  // PeekPanel setzt uiStore.peekLeadId beim Öffnen; das Schließen (Unmount) räumt hier auf
  const setPeek = useUiStore((s) => s.setPeek)
  useEffect(() => {
    if (!leadId) setPeek(null)
  }, [leadId, setPeek])

  if (!leadId) return null
  return (
    <Suspense fallback={null}>
      <LeadPeek leadId={leadId} />
    </Suspense>
  )
}
