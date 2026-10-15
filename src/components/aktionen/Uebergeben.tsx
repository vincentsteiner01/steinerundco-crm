// „Übergeben“ `⌘⇧U` (BAUPLAN § 3.1.10b, ux § 2.6 Schritt 3): Dialog mit Pflichtnotiz („Warum?“) und Checkbox
// „Sales-Verantwortlich ebenfalls“ → rpc.transferLead (+ Patch sales_owner_id); Undo über die `uebergabe`-Aktivität.
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { mutationFehler } from '@/data/errors'
import { useLead, useLeadUpdate } from '@/data/leads'
import { useAndere } from '@/data/members'
import { rpc } from '@/data/rpc'
import { useUndo } from '@/data/undo'
import {
  getrimmt,
  nachleseAktivitaet,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, ScopeFormular, TriggerHuelle } from './_Teile'

export function Uebergeben({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  className,
}: AktionProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [notiz, setNotiz] = useState('')
  const [salesAuch, setSalesAuch] = useState(false)
  const [versuch, setVersuch] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const { data: lead } = useLead(leadId)
  const andere = useAndere()
  const update = useLeadUpdate()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const name = andere?.short_name ?? andere?.display_name ?? 'die andere Person'
  const note = getrimmt(notiz)

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setNotiz('')
      setSalesAuch(false)
      setVersuch(false)
    }
  }

  const uebergeben = async () => {
    setVersuch(true)
    if (!note || !andere?.id || laeuft) return
    setLaeuft(true)
    let neu
    try {
      neu = await rpc.transferLead({ leadId, toMember: andere.id, note })
    } catch (e) {
      mutationFehler(e)
      setLaeuft(false)
      return
    }
    if (salesAuch) {
      try {
        await update.mutateAsync({
          id: leadId,
          erwartetUpdatedAt: neu.updated_at,
          patch: { sales_owner_id: andere.id },
        })
      } catch {
        // useLeadUpdate hat den Fehler gemeldet; die Übergabe selbst ist gespeichert
      }
    }
    setLaeuft(false)
    inval(leadId)
    const text = `Übergeben an ${name}.`
    const a = await nachleseAktivitaet(leadId, ['uebergabe'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  useAktionTaste('mod+shift+u', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    if (b === 'mod+enter') {
      void uebergeben()
      return true
    }
    return undefined
  })

  return (
    <>
      {trigger === undefined ? (
        <AktionButton kbd="⌘⇧U" className={className} disabled={!lead || !andere} onClick={() => setOffen(true)}>
          An {name} übergeben
        </AktionButton>
      ) : (
        <TriggerHuelle onClick={() => setOffen(true)}>{trigger}</TriggerHuelle>
      )}
      <Dialog
        offen={offen}
        onOpenChange={schliessen}
        titel={`An ${name} übergeben`}
        text="Zuständigkeit wechselt, laufende Sequenzen und Aufgaben gehen mit."
        primaer={{ label: 'Übergeben', onClick: () => void uebergeben(), busy: laeuft, disabled: !andere }}
        kinder={
          <>
            <ScopeFormular />
            <FormField
              label="Warum?"
              pflicht
              htmlFor={`uebergabe-notiz-${leadId}`}
              fehler={versuch && !note ? 'Notiz ist Pflicht.' : undefined}
            >
              <Textarea
                id={`uebergabe-notiz-${leadId}`}
                autoFocus
                value={notiz}
                placeholder="bitte anrufen, Nummer in Notiz"
                onChange={(e) => setNotiz(e.target.value)}
                onSubmit={() => void uebergeben()}
              />
            </FormField>
            <Checkbox
              label="Sales-Verantwortlich ebenfalls"
              checked={salesAuch}
              onChange={(e) => setSalesAuch(e.target.checked)}
            />
          </>
        }
      />
    </>
  )
}
