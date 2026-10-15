// BAUPLAN § 3.1.4 `/email/verfassen` (`?lead=&vorlage=&schritt=&enrollment=&zurueck=`), § 3.5: Sheet 640 px über /email
// (oder `?zurueck`); Esc schließt, der Entwurf bleibt. Zusätzliche Parameter `?erlaubnis=1` / `?widerspruch=1` öffnen den
// jeweiligen Dialog sofort (Palette-Befehle aus befehle.ts).
import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Sheet } from '@/components/ui/Sheet'
import { useHotkeyScope } from '@/lib/keyboard'
import { Composer } from './Composer'
import { sicheresZurueck } from './links'
import { Component as EmailSeite } from './EmailSeite'

export function Component() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const leadId = params.get('lead')
  const zurueck = sicheresZurueck(params.get('zurueck'))
  const hinterEmail = zurueck === PFADE.email || zurueck.startsWith(`${PFADE.email}?`)
  useHotkeyScope('formular')

  const schliessen = useCallback(() => navigate(zurueck, { replace: true }), [navigate, zurueck])

  return (
    <>
      {hinterEmail ? (
        <EmailSeite />
      ) : (
        <>
          <SeitenKopf titel="E-Mail verfassen" />
          <EmptyState titel="Composer offen." satz="Esc schließt – der Entwurf bleibt." />
        </>
      )}
      <Sheet offen onOpenChange={(o) => !o && schliessen()} titel="E-Mail verfassen" breite={640}>
        {leadId ? (
          <Composer
            leadId={leadId}
            vorlageId={params.get('vorlage')}
            enrollmentId={params.get('enrollment')}
            schrittId={params.get('schritt')}
            erlaubnisOffen={params.get('erlaubnis') === '1'}
            widerspruchOffen={params.get('widerspruch') === '1'}
            onFertig={schliessen}
          />
        ) : (
          <EmptyState
            titel="Kein Lead gewählt."
            satz="Öffne den Composer aus einer Karte, dem Peek oder der Palette (⌥M)."
            primaer={{ label: 'Zu den Leads', onClick: () => navigate(PFADE.leads) }}
          />
        )}
      </Sheet>
    </>
  )
}
