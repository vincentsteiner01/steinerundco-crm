// „Wiedervorlage“ `W` (BAUPLAN § 3.1.10b, § 1.5 Nr. 15): DatePicker (+3 Mo vorbelegt, gerollt) + Notiz → rpc.setWiedervorlage
// (atomar: Stufe langfristig + Aufgabe); Undo über die `stage_wechsel`-Aktivität.
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { FormField } from '@/components/ui/FormField'
import { Popover } from '@/components/ui/Popover'
import { Textarea } from '@/components/ui/Textarea'
import { useSettings } from '@/data/settings'
import { useSetWiedervorlage } from '@/data/tasks'
import { useUndo } from '@/data/undo'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import { rollToWeekday } from '@/lib/werktage'
import { monatePlus, tagPlus } from '@/lib/zeit'
import {
  getrimmt,
  nachleseAktivitaet,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, ScopeFormular } from './_Teile'

export function Wiedervorlage({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  className,
}: AktionProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [datum, setDatum] = useState<string | null>(null)
  const [notiz, setNotiz] = useState('')
  const { data: settings } = useSettings()
  const setzen = useSetWiedervorlage()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()

  const heute = heuteBerlin()
  const vorgabe = rollToWeekday(monatePlus(heute, 3), settings?.feiertage)
  const due = datum ?? vorgabe

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setDatum(null)
      setNotiz('')
    }
  }

  const speichern = async () => {
    if (setzen.isPending || !due) return
    try {
      await setzen.mutateAsync({ leadId, due, note: getrimmt(notiz) })
    } catch {
      return
    }
    inval(leadId)
    const text = `Wiedervorlage am ${fmtDatum(due)}.`
    const a = await nachleseAktivitaet(leadId, ['stage_wechsel'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  useAktionTaste('w', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    if (b === 'mod+enter') {
      void speichern()
      return true
    }
    return undefined
  })

  return (
    <Popover
      offen={offen}
      onOpenChange={schliessen}
      titel="Wiedervorlage"
      className={className}
      trigger={trigger ?? <AktionButton kbd="W">Wiedervorlage</AktionButton>}
    >
      <ScopeFormular />
      <div className="grid gap-3 p-1.5">
        <FormField label="Datum" htmlFor={`wv-datum-${leadId}`}>
          <DatePicker
            id={`wv-datum-${leadId}`}
            wert={due}
            min={tagPlus(heute, 1)}
            presets={['+1w', '+2m', '+3m']}
            onChange={(iso) => setDatum(iso)}
          />
        </FormField>
        <FormField label="Notiz" htmlFor={`wv-notiz-${leadId}`}>
          <Textarea
            id={`wv-notiz-${leadId}`}
            value={notiz}
            placeholder="Woran erinnern?"
            onChange={(e) => setNotiz(e.target.value)}
            onSubmit={() => void speichern()}
          />
        </FormField>
        <div className="flex justify-end gap-1.5">
          <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => schliessen(false)}>
            Abbrechen
          </Button>
          <Button
            variante="primary"
            groesse="S"
            kbd="⌘↵"
            busy={setzen.isPending}
            disabled={!due}
            onClick={() => void speichern()}
          >
            Wiedervorlage
          </Button>
        </div>
      </div>
    </Popover>
  )
}
