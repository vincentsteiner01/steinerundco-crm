import { lazy, Suspense, useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { peekLeadId } from '@/app/peekParam'
import { ScopeFormular } from '@/components/ui/ScopeFormular'

// Lead-Blatt (Formular, E-Mail-Bereich) erst beim ersten `?lead=` laden – nicht im Start-Bundle (E22, 220 kB).
const LeadBlatt = lazy(() => import('@/features/board/LeadBlatt').then((m) => ({ default: m.LeadBlatt })))

/**
 * Liest `?lead=<id>` auf jeder Route und zeigt darüber das Lead-Blatt (Neustart 25.11.2026, ersetzt den Peek). So öffnen die
 * Lead-Knöpfe in E-Mail › Gesendet/Fällig und `PFADE.lead(id)` dasselbe Blatt wie eine Karte auf dem Board. Ausnahme wie
 * bisher `/email/verfassen` (dort meint `lead` den Empfänger, siehe peekParam.ts). Schließen entfernt nur den Parameter.
 */
export function LeadOutlet() {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const leadId = peekLeadId(pathname, params)

  const schliessen = useCallback(() => {
    setParams(
      (alt) => {
        const p = new URLSearchParams(alt)
        p.delete('lead')
        return p
      },
      { replace: true },
    )
  }, [setParams])

  if (!leadId) return null
  return (
    <Suspense fallback={null}>
      {/* Solange das Blatt offen ist, ruhen die Listen- und Karten-Tasten der Seite dahinter (J/K, Enter …) */}
      <ScopeFormular />
      <LeadBlatt key={leadId} leadId={leadId} onClose={schliessen} />
    </Suspense>
  )
}
