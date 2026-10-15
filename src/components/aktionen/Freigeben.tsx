// „Freigeben“ `⌘⇧F` (BAUPLAN § 3.1.10b, ux § 2.6 Schritt 1): Dialog mit Grund (Kontakt entfernt · blockiert · will keine Nachrichten
// von mir · Sonstiges + Notiz) und Hinweistext → rpc.releaseLead; Undo über die `freigabe`-Aktivität (Sequenzen wieder aktiv, § 1.5 Nr. 29).
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { mutationFehler } from '@/data/errors'
import { useLead } from '@/data/leads'
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
import { AktionButton, RadioListe, ScopeFormular, TriggerHuelle } from './_Teile'
import { FREIGABE_GRUND, type FreigabeGrundKey } from './gruende'

const OPTIONEN: { key: FreigabeGrundKey; label: string; kbd: string }[] = [
  { key: 'kontakt_entfernt', label: FREIGABE_GRUND.kontakt_entfernt, kbd: '1' },
  { key: 'blockiert', label: FREIGABE_GRUND.blockiert, kbd: '2' },
  { key: 'keine_nachrichten', label: FREIGABE_GRUND.keine_nachrichten, kbd: '3' },
  { key: 'sonstiges', label: `${FREIGABE_GRUND.sonstiges} (mit Notiz)`, kbd: '4' },
]

export function Freigeben({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  className,
}: AktionProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [grund, setGrund] = useState<FreigabeGrundKey | null>(null)
  const [notiz, setNotiz] = useState('')
  const [versuch, setVersuch] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const { data: lead } = useLead(leadId)
  const andere = useAndere()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const name = andere?.short_name ?? andere?.display_name ?? 'die andere Person'
  const note = getrimmt(notiz)
  const notizFehlt = grund === 'sonstiges' && !note

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setGrund(null)
      setNotiz('')
      setVersuch(false)
    }
  }

  const freigeben = async () => {
    setVersuch(true)
    if (!grund || notizFehlt || laeuft) return
    const reason = grund === 'sonstiges' ? `${FREIGABE_GRUND.sonstiges} – ${note}` : FREIGABE_GRUND[grund]
    setLaeuft(true)
    try {
      await rpc.releaseLead({ leadId, reason })
    } catch (e) {
      mutationFehler(e)
      setLaeuft(false)
      return
    }
    setLaeuft(false)
    inval(leadId)
    const text = `Freigegeben · ${FREIGABE_GRUND[grund]}.`
    const a = await nachleseAktivitaet(leadId, ['freigabe'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  useAktionTaste('mod+shift+f', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    const o = OPTIONEN.find((x) => x.kbd === b)
    if (o) {
      setGrund(o.key)
      return true
    }
    if (b === 'mod+enter') {
      void freigeben()
      return true
    }
    return undefined
  })

  return (
    <>
      {trigger === undefined ? (
        <AktionButton kbd="⌘⇧F" className={className} disabled={!lead || lead.released} onClick={() => setOffen(true)}>
          Freigeben …
        </AktionButton>
      ) : (
        <TriggerHuelle onClick={() => setOffen(true)}>{trigger}</TriggerHuelle>
      )}
      <Dialog
        offen={offen}
        onOpenChange={schliessen}
        titel="Lead freigeben"
        text={`Freigeben heißt nicht, dass ${name} sofort schreiben soll. Wenn die Person keinen Kontakt mehr von Steiner & Co. will → stattdessen ‚Beenden · Widerspruch‘.`}
        primaer={{ label: 'Freigeben', onClick: () => void freigeben(), busy: laeuft, disabled: !grund }}
        kinder={
          <>
            <ScopeFormular />
            <FormField label="Grund" pflicht fehler={versuch && !grund ? 'Grund ist Pflicht.' : undefined}>
              <RadioListe
                name={`freigabe-${leadId}`}
                ariaLabel="Grund"
                optionen={OPTIONEN}
                wert={grund}
                onChange={setGrund}
              />
            </FormField>
            {grund === 'sonstiges' ? (
              <FormField
                label="Notiz"
                pflicht
                htmlFor={`freigabe-notiz-${leadId}`}
                fehler={versuch && notizFehlt ? 'Notiz ist Pflicht.' : undefined}
              >
                <Textarea
                  id={`freigabe-notiz-${leadId}`}
                  autoFocus
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  onSubmit={() => void freigeben()}
                />
              </FormField>
            ) : null}
          </>
        }
      />
    </>
  )
}
