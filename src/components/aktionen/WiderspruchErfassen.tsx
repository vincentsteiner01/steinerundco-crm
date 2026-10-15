// „Widerspruch erfassen“ `D` (nur Scope anruf) / Button (BAUPLAN § 3.1.10b, ux § 4.8): Dialog mit Umfang (nur Telefon ·
// nur E-Mail · alle Kanäle) und Zitat-Pflicht → useLeadUpdate({ do_not_contact: true, do_not_contact_channels, objection_note }).
// Der Patch beendet den Lead (stage beendet · widerspruch); der Trigger leads_after_update stoppt alle Sequenzen und füllt die
// Sperrliste; nicht rückgängig machbar (E4).
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { useLead, useLeadUpdate } from '@/data/leads'
import { DIALOG } from '@/texte/de'
import type { Channel } from '@/types/domain'
import {
  getrimmt,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, RadioListe, ScopeFormular, TriggerHuelle } from './_Teile'

type Umfang = 'telefon' | 'email' | 'alle'
const UMFANG: { key: Umfang; label: string; kbd: string; kanaele: Channel[] }[] = [
  { key: 'telefon', label: 'nur Telefon', kbd: '1', kanaele: ['telefon'] },
  { key: 'email', label: 'nur E-Mail', kbd: '2', kanaele: ['email'] },
  { key: 'alle', label: 'alle Kanäle', kbd: '3', kanaele: ['linkedin', 'telefon', 'email'] },
]

export type WiderspruchErfassenProps = AktionProps & { umfang?: Umfang }

export function WiderspruchErfassen({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  umfang: umfangVorgabe = 'alle',
  className,
}: WiderspruchErfassenProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [umfang, setUmfang] = useState<Umfang>(umfangVorgabe)
  const [zitat, setZitat] = useState('')
  const [versuch, setVersuch] = useState(false)
  const { data: lead } = useLead(leadId)
  const update = useLeadUpdate()
  const inval = useLeadInvalidierung()

  const name = lead?.full_name ?? 'diese Person'
  const note = getrimmt(zitat)
  const dialog = DIALOG.widerspruch(name)

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setZitat('')
      setVersuch(false)
      setUmfang(umfangVorgabe)
    }
  }

  const erfassen = async () => {
    setVersuch(true)
    if (!lead || !note || update.isPending) return
    const u = UMFANG.find((x) => x.key === umfang) ?? UMFANG[2]
    try {
      await update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: {
          do_not_contact: true,
          do_not_contact_channels: u?.kanaele ?? null,
          objection_note: note,
          // § 8.1 Nr. 6 / § 8.2 Nr. 7: Lead „beendet · widerspruch“ – kein Trigger setzt die Stufe auf diesem Weg (Review; log_reply und
          // log_call tun es selbst). Kunden bleiben Kunden: ein Werbewiderspruch beendet die Kundenbeziehung nicht.
          ...(lead.stage === 'kunde'
            ? {}
            : { stage: 'beendet' as const, ended_reason: 'widerspruch' as const, ended_note: note }),
        },
      })
    } catch {
      return
    }
    inval(leadId)
    toast(`Widerspruch erfasst · ${u?.label ?? 'alle Kanäle'}.`)
    schliessen(false)
    onFertig?.()
  }

  // `D` nur im Anruf-Screen (Scope anruf); überall sonst ist der Button der Weg
  useAktionTaste('d', trigger === undefined && !!aktiv, () => setOffen(true), 'anruf')
  useTastenWaehrendOffen(offen, (b) => {
    const u = UMFANG.find((x) => x.kbd === b)
    if (u) {
      setUmfang(u.key)
      return true
    }
    if (b === 'mod+enter') {
      void erfassen()
      return true
    }
    return undefined
  })

  return (
    <>
      {trigger === undefined ? (
        <AktionButton className={className} disabled={!lead || lead.do_not_contact} onClick={() => setOffen(true)}>
          Widerspruch erfassen
        </AktionButton>
      ) : (
        <TriggerHuelle onClick={() => setOffen(true)}>{trigger}</TriggerHuelle>
      )}
      <Dialog
        offen={offen}
        onOpenChange={schliessen}
        titel={`Werbewiderspruch für ${name} erfassen?`}
        text={dialog.text}
        primaer={{ label: dialog.primaer, onClick: () => void erfassen(), danger: true, busy: update.isPending }}
        kinder={
          <>
            <ScopeFormular />
            <FormField label="Umfang">
              <RadioListe
                name={`widerspruch-${leadId}`}
                ariaLabel="Umfang"
                optionen={UMFANG}
                wert={umfang}
                onChange={setUmfang}
              />
            </FormField>
            <FormField
              label="Zitat"
              pflicht
              htmlFor={`widerspruch-zitat-${leadId}`}
              fehler={versuch && !note ? 'Zitat ist Pflicht.' : undefined}
            >
              <Textarea
                id={`widerspruch-zitat-${leadId}`}
                autoFocus
                value={zitat}
                placeholder="Wortlaut des Widerspruchs"
                onChange={(e) => setZitat(e.target.value)}
                onSubmit={() => void erfassen()}
              />
            </FormField>
          </>
        }
      />
    </>
  )
}
