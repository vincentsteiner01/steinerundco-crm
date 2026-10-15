import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router'
import { Button } from '@/components/ui/Button'
import { istAuthfehler } from '@/data/queryClient'
import { PFADE } from '../pfade'

/** errorElement (architektur § 4.8): Auth-Fehler → „Sitzung abgelaufen“ mit Rücksprung; sonst Ursache + nächster Schritt. */
export function RouteFehler() {
  const fehler = useRouteError()
  const navigate = useNavigate()
  const location = useLocation()
  const auth = istAuthfehler(fehler)
  const von = encodeURIComponent(location.pathname + location.search)
  const nichtGefunden = isRouteErrorResponse(fehler) && fehler.status === 404

  if (import.meta.env.DEV) console.error('RouteFehler', fehler)

  return (
    <div className="p-gutter relative z-[1] grid min-h-dvh place-items-center">
      <div className="max-w-[420px]">
        <h1 className="headline mb-2.5 text-[32px]">
          {auth ? 'Sitzung abgelaufen.' : nichtGefunden ? 'Seite nicht gefunden.' : 'Da ist etwas schiefgelaufen.'}
        </h1>
        <p className="text-body text-ink-2 mb-5">
          {auth
            ? 'Bitte Passcode eingeben – du landest danach wieder hier.'
            : nichtGefunden
              ? 'Die Adresse kennt das CRM nicht.'
              : 'Die Seite konnte nicht geladen werden – erneut versuchen hilft meistens.'}
        </p>
        <div className="flex gap-1.5">
          {auth ? (
            <Button variante="primary" onClick={() => navigate(`${PFADE.anmelden}?von=${von}`, { replace: true })}>
              Zur Anmeldung
            </Button>
          ) : (
            <Button variante="primary" kbd="R" onClick={() => window.location.reload()}>
              Erneut versuchen
            </Button>
          )}
          <Button variante="quiet" onClick={() => navigate(PFADE.heute)}>
            Zu Heute
          </Button>
        </div>
      </div>
    </div>
  )
}
