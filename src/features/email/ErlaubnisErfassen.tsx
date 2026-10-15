// BAUPLAN § 3.5 `ErlaubnisErfassen.tsx` / § 8.1 Nr. 1: Dialog Grundlage · Datum · Zitat (Pflicht) · Adresse (Pflicht, Hinweis bei
// Sammeladresse) · Verknüpfung (Anruf / Nachricht / Gespräch) → useLeadUpdate(email_consent_*); der Trigger loggt `einwilligung`
// (append-only Historie, ux § 3.3.3). Kein Undo (E4: `einwilligung` ist nie reversibel).
import { useId, useState, type ReactNode } from 'react'
import { toast } from '@/components/toast'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useActivities, useCalls, useLead, useLeadUpdate, useMeetings } from '@/data'
import { fmtDatumKurz, fmtDatumZeit, heuteBerlin } from '@/lib/format'
import { berlinTag, tagZuDate } from '@/lib/zeit'
import { ERGEBNIS_LABEL, ERLAUBNIS_LABEL } from '@/texte/de'
import { EMAIL_RE, ERLAUBNIS_GRUNDLAGEN, istSammeladresse } from './erlaubnis'
import type { Json } from '@/types/database'
import type { EmailConsentBasis } from '@/types/domain'
import { ScopeFormular } from '@/components/ui/ScopeFormular'

export type ErlaubnisRef =
  { call_id: string } | { activity_id: number } | { meeting_id: string } | { url: string } | null

export type ErlaubnisErfassenProps = {
  leadId: string
  trigger: ReactNode
  offen?: boolean
  onOpenChange?: (offen: boolean) => void
  onFertig?: () => void
}

type Verknuepfung = { key: string; label: string; ref: ErlaubnisRef }

export function ErlaubnisErfassen({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
}: ErlaubnisErfassenProps) {
  const [intern, setIntern] = useState(false)
  const offen = offenProp ?? intern
  const setOffen = (o: boolean) => {
    if (offenProp === undefined) setIntern(o)
    onOpenChange?.(o)
  }
  const id = useId()
  const { data: lead } = useLead(offen ? leadId : null)
  const update = useLeadUpdate()

  const [grundlage, setGrundlage] = useState<EmailConsentBasis>('requested_linkedin')
  const [datum, setDatum] = useState<string | null>(heuteBerlin())
  const [zitat, setZitat] = useState('')
  const [adresse, setAdresse] = useState<string | null>(null)
  const [verknuepfung, setVerknuepfung] = useState('')
  const [versuch, setVersuch] = useState(false)

  const adresseWert = adresse ?? lead?.email ?? ''
  const zitatWert = zitat.trim()
  const fehlerZitat = versuch && !zitatWert ? 'Zitat ist Pflicht – der Wortlaut der Bitte.' : undefined
  const fehlerAdresse =
    versuch && !adresseWert.trim()
      ? 'Adresse ist Pflicht.'
      : versuch && !EMAIL_RE.test(adresseWert.trim())
        ? 'Das ist keine E-Mail-Adresse.'
        : undefined
  const hinweisAdresse = istSammeladresse(adresseWert)
    ? 'Sammeladresse – die Bitte muss von der Person selbst kommen.'
    : lead?.email && adresseWert.trim().toLowerCase() === lead.email.toLowerCase()
      ? 'Adresse vom Lead.'
      : 'Die Adresse, die die Person genannt hat.'

  const verknuepfungen = useVerknuepfungen(offen ? leadId : null)

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setZitat('')
      setAdresse(null)
      setVerknuepfung('')
      setVersuch(false)
      setDatum(heuteBerlin())
      setGrundlage('requested_linkedin')
    }
  }

  const speichern = async () => {
    setVersuch(true)
    if (!lead || !zitatWert || !EMAIL_RE.test(adresseWert.trim()) || update.isPending) return
    const ref = verknuepfungen.find((v) => v.key === verknuepfung)?.ref ?? null
    const tag = datum ? berlinTag(datum) : heuteBerlin()
    try {
      await update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: {
          email: adresseWert.trim().toLowerCase(),
          email_consent_basis: grundlage,
          email_consent_at: tagZuDate(tag, '09:00').toISOString(),
          email_consent_note: zitatWert,
          email_consent_ref: ref as Json,
        },
      })
    } catch {
      return
    }
    toast(`Erlaubnis erfasst · ${ERLAUBNIS_LABEL[grundlage]} · ${fmtDatumKurz(tag)}.`)
    schliessen(false)
    onFertig?.()
  }

  return (
    <>
      <span className="contents" onClick={() => setOffen(true)}>
        {trigger}
      </span>
      <Dialog
        offen={offen}
        onOpenChange={schliessen}
        titel={`Erlaubnis erfassen${lead?.full_name ? ` – ${lead.full_name}` : ''}`}
        text="Wann und wie hat die Person um die Mail gebeten? Das Zitat steht später neben jeder Mail."
        primaer={{ label: 'Erlaubnis erfassen', onClick: () => void speichern(), busy: update.isPending }}
        kinder={
          <>
            {offen ? <ScopeFormular /> : null}
            <FormField label="Grundlage" htmlFor={`${id}-grundlage`}>
              <Select
                id={`${id}-grundlage`}
                value={grundlage}
                onChange={(e) => setGrundlage(e.target.value as EmailConsentBasis)}
                optionen={ERLAUBNIS_GRUNDLAGEN.map((g) => ({ value: g, label: ERLAUBNIS_LABEL[g] }))}
              />
            </FormField>
            <FormField label="Datum der Bitte" htmlFor={`${id}-datum`}>
              <DatePicker id={`${id}-datum`} wert={datum} onChange={setDatum} presets={['heute']} />
            </FormField>
            <FormField label="Zitat" pflicht htmlFor={`${id}-zitat`} fehler={fehlerZitat}>
              <Textarea
                id={`${id}-zitat`}
                autoFocus
                value={zitat}
                placeholder="Wortlaut, z. B. ‚Schick mir gern kurze Infos zu Solvio‘"
                onChange={(e) => setZitat(e.target.value)}
                onSubmit={() => void speichern()}
              />
            </FormField>
            <FormField
              label="Adresse"
              pflicht
              htmlFor={`${id}-adresse`}
              fehler={fehlerAdresse}
              hinweis={hinweisAdresse}
            >
              <Input
                id={`${id}-adresse`}
                type="email"
                mono
                value={adresseWert}
                placeholder="vorname.nachname@firma.de"
                onChange={(e) => setAdresse(e.target.value)}
              />
            </FormField>
            <FormField
              label="Verknüpfung"
              htmlFor={`${id}-ref`}
              hinweis="Anruf, Nachricht oder Gespräch, in dem die Bitte fiel."
            >
              <Select
                id={`${id}-ref`}
                value={verknuepfung}
                onChange={(e) => setVerknuepfung(e.target.value)}
                optionen={[
                  { value: '', label: 'Keine Verknüpfung' },
                  ...verknuepfungen.map((v) => ({ value: v.key, label: v.label })),
                ]}
              />
            </FormField>
          </>
        }
      />
    </>
  )
}

/** Auswählbare Belege: letzte Anrufe, eingegangene Nachrichten/E-Mails, geführte Gespräche. */
function useVerknuepfungen(leadId: string | null): Verknuepfung[] {
  const { data: calls } = useCalls(leadId, 10)
  const { data: meetings } = useMeetings(leadId)
  const { data: nachrichten } = useActivities(leadId, { types: ['nachricht_erhalten', 'email_erhalten'] })
  const out: Verknuepfung[] = []
  for (const c of calls ?? [])
    out.push({
      key: `call:${c.id}`,
      label: `Anruf · ${fmtDatumZeit(c.started_at)}${c.outcome ? ` · ${ERGEBNIS_LABEL[c.outcome] ?? c.outcome}` : ''}`,
      ref: { call_id: c.id },
    })
  for (const a of nachrichten?.pages.flat() ?? [])
    out.push({
      key: `activity:${a.id}`,
      label: `${a.type === 'email_erhalten' ? 'E-Mail' : 'Nachricht'} · ${fmtDatumZeit(a.occurred_at)}${a.note ? ` · ‚${a.note.slice(0, 40)}‘` : ''}`,
      ref: { activity_id: a.id },
    })
  for (const m of meetings ?? [])
    if (m.status === 'stattgefunden')
      out.push({
        key: `meeting:${m.id}`,
        label: `${m.type === 'strategiegespraech' ? 'Strategiegespräch' : 'Erstgespräch'} · ${fmtDatumZeit(m.scheduled_at)}`,
        ref: { meeting_id: m.id },
      })
  return out
}
