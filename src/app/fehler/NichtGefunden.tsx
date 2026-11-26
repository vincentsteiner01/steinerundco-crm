import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { LEER } from '@/texte/de'
import { PFADE } from '../pfade'

/**
 * S-01: unbekannte Pfade zeigen „Seite nicht gefunden“ mit Knopf „Zu den Leads“. Eigener kleiner Block wie auf Leitfäden
 * (25.11.2026): eine Überschrift statt zwei, keine Datumszeile, Knopf 44 px – EmptyState bleibt für den E-Mail-Bereich, wie es ist.
 */
export function NichtGefunden() {
  const navigate = useNavigate()
  return (
    <div className="max-w-[420px]">
      <header className="pt-7 pb-6 max-md:pt-5 max-md:pb-5">
        <h1 className="headline flex min-h-11 items-center">{LEER.seiteNichtGefunden.titel}</h1>
      </header>
      <div className="grid justify-items-start gap-5 py-4">
        <p className="text-body text-ink-2">{LEER.seiteNichtGefunden.satz}</p>
        <Button variante="primary" groesse="L" onClick={() => navigate(PFADE.leads)}>
          {LEER.seiteNichtGefunden.aktion}
        </Button>
      </div>
    </div>
  )
}
