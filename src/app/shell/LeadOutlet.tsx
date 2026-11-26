import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { peekLeadId } from '@/app/peekParam'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { blattImVerlauf } from '@/features/board/verlauf'

// Lead-Blatt (Formular, E-Mail-Bereich) erst beim ersten `?lead=` laden – nicht im Start-Bundle (E22, 220 kB).
const LeadBlatt = lazy(() => import('@/features/board/LeadBlatt').then((m) => ({ default: m.LeadBlatt })))

/**
 * Liest `?lead=<id>` auf jeder Route und zeigt darüber das Lead-Blatt (Neustart 25.11.2026, ersetzt den Peek). So öffnen die
 * Lead-Knöpfe in E-Mail › Gesendet/Fällig und `PFADE.lead(id)` dasselbe Blatt wie eine Karte auf dem Board. Ausnahme wie
 * bisher `/email/verfassen` (dort meint `lead` den Empfänger, siehe peekParam.ts).
 *
 * Schließen: Hat ein eigener Verlaufseintrag das Blatt geöffnet (Karte auf dem Board, siehe board/verlauf.ts), geht es einen
 * Schritt zurück – „Zurück“ des Browsers und „Schließen“ tun dann dasselbe, und es bleibt kein toter Eintrag liegen. Sonst
 * (Direktaufruf, Lead-Knöpfe im E-Mail-Bereich) wird nur der Parameter entfernt.
 */
export function LeadOutlet() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, state, key } = useLocation()
  const leadId = peekLeadId(pathname, params)
  // Ein zweites „Schließen“, bevor der Schritt zurück angekommen ist (Doppelklick), ginge sonst zwei Schritte zurück und
  // verließe das Board. Mit jedem neuen Verlaufseintrag gilt wieder das erste.
  const unterwegs = useRef(false)
  useEffect(() => {
    unterwegs.current = false
  }, [key])

  const schliessen = useCallback(() => {
    if (unterwegs.current) return
    unterwegs.current = true
    if (blattImVerlauf(state)) {
      void navigate(-1)
      return
    }
    setParams(
      (alt) => {
        const p = new URLSearchParams(alt)
        p.delete('lead')
        return p
      },
      { replace: true },
    )
  }, [state, navigate, setParams])

  if (!leadId) return null
  return (
    <Suspense fallback={null}>
      {/* Solange das Blatt offen ist, ruhen die Listen- und Karten-Tasten der Seite dahinter (J/K, Enter …) */}
      <ScopeFormular />
      <LeadBlatt key={leadId} leadId={leadId} onClose={schliessen} />
    </Suspense>
  )
}
