// BAUPLAN § 3.5 `TabGesendet.tsx`: emails status sent_confirmed|replied|bounced der angemeldeten Person; Aktionen „Beantwortet“
// (log_reply Kanal email + status replied) · „Bounce“ (status bounced → Trigger Sperrliste; Dialog, weil unumkehrbar) ·
// „Widerspruch“ (aktionen/WiderspruchErfassen, Umfang E-Mail). Enter = Lead im Peek (`?lead=`).
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { WiderspruchErfassen } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEmailsStatus, useMeId } from '@/data'
import type { Email } from '@/types/domain'
import { TOAST } from '@/texte/de'
import { useBeantwortet, useBounce } from './daten/emailAktionen'
import { EmailZeile } from './EmailZeile'
import { useListenCursor } from './listenCursor'

export function TabGesendet({ aktiv = true }: { aktiv?: boolean }) {
  const me = useMeId()
  const { data, isPending } = useEmailsStatus(me, ['sent_confirmed', 'replied', 'bounced'])
  const [params, setParams] = useSearchParams()
  const beantwortet = useBeantwortet()
  const bounce = useBounce()
  const [bounceFuer, setBounceFuer] = useState<Email | null>(null)
  const mails = data ?? []
  const ids = mails.map((e) => e.id)

  const peek = useCallback(
    (leadId: string) => {
      const p = new URLSearchParams(params)
      p.set('lead', leadId)
      setParams(p, { replace: true })
    },
    [params, setParams],
  )
  const { cursor, setCursor } = useListenCursor(
    ids,
    (id) => {
      const e = mails.find((x) => x.id === id)
      if (e) peek(e.lead_id)
    },
    aktiv,
  )

  const alsBeantwortet = async (e: Email) => {
    try {
      await beantwortet.mutateAsync(e)
      toast('Antwort erhalten – am Lead geloggt.')
    } catch {
      /* Toast aus der Daten-Schicht */
    }
  }
  const bounceBestaetigen = async () => {
    if (!bounceFuer) return
    try {
      await bounce.mutateAsync(bounceFuer)
      toast(TOAST.bounceErfasst)
      setBounceFuer(null)
    } catch {
      /* Toast aus der Daten-Schicht */
    }
  }

  if (isPending && !data) return <Skeleton zeilen={4} />
  if (mails.length === 0)
    return (
      <EmptyState
        titel="Noch nichts gesendet."
        satz="Bestätigte Mails erscheinen hier mit Datum, Empfänger und Betreff."
      />
    )

  return (
    <>
      <ul role="listbox" aria-label="Gesendet" className="border-line border-t">
        {mails.map((e) => (
          <EmailZeile
            key={e.id}
            email={e}
            cursor={e.id === cursor}
            onClick={() => setCursor(e.id)}
            aktionen={
              <>
                <Button groesse="S" variante="quiet" kbd="↵" onClick={() => peek(e.lead_id)}>
                  Lead
                </Button>
                {e.status === 'sent_confirmed' ? (
                  <Button
                    groesse="S"
                    variante="quiet"
                    onClick={() => void alsBeantwortet(e)}
                    disabled={beantwortet.isPending}
                  >
                    Beantwortet
                  </Button>
                ) : null}
                {e.status !== 'bounced' ? (
                  <Button groesse="S" variante="quiet" onClick={() => setBounceFuer(e)}>
                    Bounce
                  </Button>
                ) : null}
                <WiderspruchErfassen
                  leadId={e.lead_id}
                  umfang="email"
                  trigger={
                    <Button groesse="S" variante="quiet">
                      Widerspruch
                    </Button>
                  }
                />
              </>
            }
          />
        ))}
      </ul>
      <Dialog
        offen={!!bounceFuer}
        onOpenChange={(o) => !o && setBounceFuer(null)}
        titel="Bounce erfassen?"
        text={`${bounceFuer?.to_address ?? 'Die Adresse'} kommt auf die Sperrliste (Grund: Bounce) – kein weiterer Versand an diese Adresse.`}
        primaer={{
          label: 'Bounce erfassen',
          onClick: () => void bounceBestaetigen(),
          danger: true,
          busy: bounce.isPending,
        }}
      />
    </>
  )
}
