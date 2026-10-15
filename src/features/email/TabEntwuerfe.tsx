// BAUPLAN § 3.5 `TabEntwuerfe.tsx`: emails status draft|opened_in_client der angemeldeten Person – Zeile mit „Gesendet?“
// (→ sent_confirmed, Sequenzschritt erledigt) / „Verworfen“ (→ failed, bounce_reason 'verworfen'); Enter = weiter bearbeiten.
// „Gesendet?“ prüft dasselbe Gate wie der Composer (berechneGate): ein per „Entwurf speichern“ gesicherter Entwurf ist nie durchs
// Gate gegangen, und der Server wiederholt nur die Regeln 1, 4 und 7 (Review: Regel 3 und die 12-Monats-Warnung fehlten).
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEmails, useEmailsStatus, useLead, useMeId, useSettings, useSperrliste, useTemplates } from '@/data'
import { useHotkeys } from '@/lib/keyboard'
import type { Email, Template } from '@/types/domain'
import { TOAST } from '@/texte/de'
import { useEntwurfVerwerfen, useGesendetBestaetigen } from './daten/emailAktionen'
import { EmailZeile } from './EmailZeile'
import { berechneGate } from './gate'
import { aktuellerPfad, verfassenUrl } from './links'
import { useListenCursor } from './listenCursor'

export function TabEntwuerfe({ aktiv = true }: { aktiv?: boolean }) {
  const me = useMeId()
  const { data, isPending } = useEmailsStatus(me, ['draft', 'opened_in_client'])
  const navigate = useNavigate()
  const bestaetigen = useGesendetBestaetigen()
  const verwerfen = useEntwurfVerwerfen()
  const { data: templates } = useTemplates({ channel: 'email' })
  const entwuerfe = data ?? []
  const ids = entwuerfe.map((e) => e.id)

  const weiter = useCallback(
    (e: Email) =>
      navigate(
        verfassenUrl({
          leadId: e.lead_id,
          vorlageId: e.template_id,
          enrollmentId: e.enrollment_id,
          schrittId: e.step_id,
          zurueck: aktuellerPfad(),
        }),
      ),
    [navigate],
  )
  const { cursor, setCursor } = useListenCursor(
    ids,
    (id) => {
      const e = entwuerfe.find((x) => x.id === id)
      if (e) weiter(e)
    },
    aktiv,
  )
  const unterCursor = entwuerfe.find((e) => e.id === cursor) ?? null
  useHotkeys('liste', aktiv && unterCursor ? { 'alt+m': () => weiter(unterCursor) } : {}, [aktiv, unterCursor?.id])

  const gesendet = async (e: Email) => {
    try {
      await bestaetigen.mutateAsync(e)
      toast(TOAST.emailBestaetigt)
    } catch {
      /* Fehler-Toast aus der Daten-Schicht (Trigger-Text bei fehlender Grundlage, M-14) */
    }
  }
  const verworfen = async (e: Email) => {
    try {
      await verwerfen.mutateAsync(e)
      toast(TOAST.entwurfVerworfen)
    } catch {
      /* Toast aus der Daten-Schicht */
    }
  }

  if (isPending && !data) return <Skeleton zeilen={4} />
  if (entwuerfe.length === 0)
    return (
      <EmptyState
        titel="Keine Entwürfe."
        satz="Entwürfe entstehen beim Öffnen in Gmail, Kopieren oder „Entwurf speichern“."
      />
    )

  return (
    <ul role="listbox" aria-label="Entwürfe" className="border-line border-t">
      {entwuerfe.map((e) => (
        <EmailZeile
          key={e.id}
          email={e}
          cursor={e.id === cursor}
          onClick={() => setCursor(e.id)}
          aktionen={
            <>
              <Button groesse="S" variante="quiet" kbd="↵" onClick={() => weiter(e)}>
                Weiter
              </Button>
              <GesendetKnopf
                email={e}
                template={templates?.find((t) => t.id === e.template_id) ?? null}
                busy={bestaetigen.isPending}
                onBestaetigen={() => void gesendet(e)}
              />
              <Button groesse="S" variante="quiet" onClick={() => void verworfen(e)} disabled={verwerfen.isPending}>
                Verworfen
              </Button>
            </>
          }
        />
      ))}
    </ul>
  )
}

/** „Gesendet?“ mit E-Mail-Gate des Leads: gesperrt → deaktiviert mit Grund; Erlaubnis älter als 12 Monate → erst „Trotzdem“. */
function GesendetKnopf({
  email,
  template,
  busy,
  onBestaetigen,
}: {
  email: Email
  template: Pick<Template, 'phase'> | null
  busy: boolean
  onBestaetigen: () => void
}) {
  const { data: lead } = useLead(email.lead_id)
  const { data: emails } = useEmails(email.lead_id)
  const { data: sperrliste } = useSperrliste()
  const { data: settings } = useSettings()
  const [trotzdem, setTrotzdem] = useState(false)
  const gate = berechneGate({
    lead: lead ? { ...lead, email: email.to_address || lead.email } : lead,
    emails,
    sperrliste,
    template,
    settings,
  })
  const laedt = !lead
  const grund = laedt ? 'Prüfe Erlaubnis …' : gate.erlaubt ? undefined : (gate.text ?? 'Gesperrt')
  if (gate.erlaubt && gate.warnung && !trotzdem)
    return (
      <Button groesse="S" title={gate.warnungText ?? undefined} onClick={() => setTrotzdem(true)}>
        Gesendet? Erlaubnis älter als 12 Monate
      </Button>
    )
  return (
    <Button groesse="S" disabled={laedt || !gate.erlaubt} disabledGrund={grund} busy={busy} onClick={onBestaetigen}>
      {trotzdem ? 'Trotzdem gesendet' : 'Gesendet?'}
    </Button>
  )
}
