// M3 – „Rückruf planen für …“ (Palette-Befehl, ux § 3.3.3 Telefon-Karte): Rückruf-Task mit Datum/Uhrzeit (nicht gerollt, E13).
import { useState, type ReactNode } from 'react'
import { useMeId } from '@/data/members'
import { useTaskErstellen } from '@/data/tasks'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { FormField } from '@/components/ui/FormField'
import { Popover } from '@/components/ui/Popover'
import { Textarea } from '@/components/ui/Textarea'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { useTastenWaehrendOffen } from '@/components/aktionen/_gemeinsam'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { lokalNachIso } from './ergebnisse'

export type RueckrufPlanenProps = {
  leadId: string
  trigger?: ReactNode
  offen?: boolean
  onOpenChange?: (o: boolean) => void
  onFertig?: () => void
}

export function RueckrufPlanen({ leadId, trigger, offen: offenProp, onOpenChange, onFertig }: RueckrufPlanenProps) {
  const [intern, setIntern] = useState(false)
  const offen = offenProp ?? intern
  const setOffen = (o: boolean) => {
    if (offenProp === undefined) setIntern(o)
    onOpenChange?.(o)
  }
  const [wann, setWann] = useState<string | null>(null)
  const [notiz, setNotiz] = useState('')
  const [versuch, setVersuch] = useState(false)
  const me = useMeId()
  const erstellen = useTaskErstellen()
  const fehlt = !wann || wann.length < 16

  const speichern = async () => {
    setVersuch(true)
    const iso = lokalNachIso(wann)
    if (fehlt || !iso || erstellen.isPending) return
    try {
      await erstellen.mutateAsync({
        lead_id: leadId,
        kind: 'rueckruf',
        title: 'Rückruf',
        due_at: iso,
        member_id: me,
        note: notiz.trim() || null,
      })
    } catch {
      return
    }
    toast(`Rückruf geplant: ${fmtDatumKurz(iso)} ${fmtZeit(iso)}.`)
    setOffen(false)
    setWann(null)
    setNotiz('')
    setVersuch(false)
    onFertig?.()
  }

  // ⌘↵ speichert auch aus dem Select/DatePicker heraus (der Button zeigt die Taste)
  useTastenWaehrendOffen(offen, (b) => {
    if (b !== 'mod+enter') return undefined
    void speichern()
    return true
  })

  return (
    <Popover
      offen={offen}
      onOpenChange={setOffen}
      titel="Rückruf planen"
      trigger={
        trigger ?? (
          <Button variante="quiet" groesse="S">
            Rückruf planen
          </Button>
        )
      }
    >
      {offen ? <ScopeFormular /> : null}
      <div className="grid w-[300px] max-w-full gap-3 p-1.5">
        <FormField
          label="Datum und Uhrzeit"
          pflicht
          htmlFor={`rueckruf-wann-${leadId}`}
          fehler={versuch && fehlt ? 'Datum und Uhrzeit sind Pflicht.' : undefined}
        >
          <DatePicker
            id={`rueckruf-wann-${leadId}`}
            wert={wann}
            onChange={setWann}
            mitUhrzeit
            min={heuteBerlin()}
            presets={['heute', 'morgen', '+3', '+7']}
            placeholder="Datum, Uhrzeit"
          />
        </FormField>
        <FormField label="Notiz" htmlFor={`rueckruf-notiz-${leadId}`}>
          <Textarea
            id={`rueckruf-notiz-${leadId}`}
            value={notiz}
            placeholder="Mit wem vereinbart?"
            onChange={(e) => setNotiz(e.target.value)}
            onSubmit={() => void speichern()}
          />
        </FormField>
        <div className="flex justify-end gap-1.5">
          <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => setOffen(false)}>
            Abbrechen
          </Button>
          <Button variante="primary" groesse="S" kbd="⌘↵" busy={erstellen.isPending} onClick={() => void speichern()}>
            Rückruf planen
          </Button>
        </div>
      </div>
    </Popover>
  )
}
