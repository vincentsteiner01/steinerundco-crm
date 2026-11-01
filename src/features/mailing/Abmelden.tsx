// /abmelden#<token> (01.11.2026) – öffentliche Seite ohne Anmeldung: Empfänger einer Kampagne melden sich mit einem Klick ab.
// Der Link kommt aus der Kopfzeile List-Unsubscribe (GET leitet von der Edge Function hierher). Erst der Knopf meldet ab –
// Sicherheits-Scanner, die Links vorab öffnen, lösen so nichts aus.
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Marke } from '@/components/ui/Marke'
import { abmelden } from '@/data/mailing'

const TOKEN = /^[0-9a-f-]{36}$/i

export function Component() {
  const token = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
  const [stand, setStand] = useState<'frage' | 'laeuft' | 'fertig' | 'fehler'>(TOKEN.test(token) ? 'frage' : 'fehler')
  const los = () => {
    setStand('laeuft')
    abmelden(token)
      .then((ok) => setStand(ok ? 'fertig' : 'fehler'))
      .catch(() => setStand('fehler'))
  }
  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[440px] text-center">
        <div className="mb-8 flex justify-center">
          <Marke />
        </div>
        {stand === 'fertig' ? (
          <>
            <h1 className="text-h2 text-ink-bright">Sie sind abgemeldet.</h1>
            <p className="text-body text-ink-2 mt-3">
              Sie erhalten von uns keine weiteren E-Mails dieser Art. Entschuldigen Sie die Störung.
            </p>
          </>
        ) : stand === 'fehler' ? (
          <>
            <h1 className="text-h2 text-ink-bright">Dieser Link ist ungültig.</h1>
            <p className="text-body text-ink-2 mt-3">
              Antworten Sie einfach auf unsere E-Mail mit „Bitte keine E-Mails mehr“ – wir tragen Sie sofort aus.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-h2 text-ink-bright">Keine weiteren E-Mails?</h1>
            <p className="text-body text-ink-2 mt-3">
              Mit einem Klick tragen wir Ihre Adresse aus. Sie müssen nichts weiter tun.
            </p>
            <Button variante="primary" groesse="L" className="mt-6" busy={stand === 'laeuft'} onClick={los}>
              Abmelden
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
