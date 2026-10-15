import { useNavigate } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { LEER } from '@/texte/de'
import { PFADE } from '../pfade'

/** S-01: unbekannte Pfade zeigen „Seite nicht gefunden“ mit Link zu Heute. */
export function NichtGefunden() {
  const navigate = useNavigate()
  return (
    <>
      <SeitenKopf titel="Nicht gefunden" />
      <EmptyState
        titel={LEER.seiteNichtGefunden.titel}
        satz={LEER.seiteNichtGefunden.satz}
        primaer={{ label: LEER.seiteNichtGefunden.aktion, onClick: () => navigate(PFADE.heute) }}
      />
    </>
  )
}
