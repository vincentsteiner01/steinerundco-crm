// „Termin eintragen“ `T` (BAUPLAN § 3.1.10b, ux § 2.4 Schritt 3): Dialog mit Typ (Erstgespräch/Strategiegespräch), Datum/Uhrzeit Pflicht,
// Dauer 15, Ort, Sales-Verantwortlich (ich) → useMeetingErstellen; Toast „Erstgespräch vereinbart für Do 16.10. 10:00“.
// Der Trigger meetings_after_write setzt Stufe, Sales-Verantwortlichen und stoppt Sequenzen; Meetings sind nicht rückgängig machbar (E4).
import { useState } from 'react'
import { toast } from '@/components/toast'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useMeetingErstellen } from '@/data/meetings'
import { useMeId, useMembers } from '@/data/members'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { tagZuDate } from '@/lib/zeit'
import { TOAST } from '@/texte/de'
import type { MeetingType } from '@/types/domain'
import {
  getrimmt,
  useAktionTaste,
  useLeadInvalidierung,
  useOffen,
  useTastenWaehrendOffen,
  type AktionProps,
} from './_gemeinsam'
import { AktionButton, ScopeFormular, TriggerHuelle } from './_Teile'

const TYP_LABEL: Record<Extract<MeetingType, 'erstgespraech' | 'strategiegespraech'>, string> = {
  erstgespraech: 'Erstgespräch',
  strategiegespraech: 'Strategiegespräch',
}

export type TerminEintragenProps = AktionProps & { typ?: 'erstgespraech' | 'strategiegespraech' }

export function TerminEintragen({
  leadId,
  trigger,
  offen: offenProp,
  onOpenChange,
  onFertig,
  aktiv,
  typ: typVorgabe = 'erstgespraech',
  className,
}: TerminEintragenProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [typ, setTyp] = useState<'erstgespraech' | 'strategiegespraech'>(typVorgabe)
  const [wann, setWann] = useState<string | null>(null) // YYYY-MM-DDTHH:MM (Europe/Berlin)
  const [dauer, setDauer] = useState('15')
  const [ort, setOrt] = useState('')
  const [versuch, setVersuch] = useState(false)
  const me = useMeId()
  const { data: members } = useMembers()
  const [verantwortlich, setVerantwortlich] = useState<string | null>(null)
  const erstellen = useMeetingErstellen()
  const inval = useLeadInvalidierung()

  const wer = verantwortlich ?? me ?? ''
  const datumFehlt = !wann || wann.length < 16

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setWann(null)
      setDauer('15')
      setOrt('')
      setVersuch(false)
      setTyp(typVorgabe)
    }
  }

  const speichern = async () => {
    setVersuch(true)
    if (datumFehlt || erstellen.isPending || !wann) return
    const scheduled = tagZuDate(wann.slice(0, 10), wann.slice(11, 16))
    const dauerMin = Math.max(5, Number.parseInt(dauer, 10) || 15)
    try {
      await erstellen.mutateAsync({
        lead_id: leadId,
        type: typ,
        scheduled_at: scheduled.toISOString(),
        duration_min: dauerMin,
        location: getrimmt(ort),
        member_id: wer || null,
        status: 'geplant',
      })
    } catch {
      return
    }
    inval(leadId)
    toast(TOAST.terminVereinbart(TYP_LABEL[typ], `${fmtDatumKurz(scheduled)} ${fmtZeit(scheduled)}`))
    schliessen(false)
    onFertig?.()
  }

  useAktionTaste('t', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    if (b === 'mod+enter') {
      void speichern()
      return true
    }
    return undefined
  })

  return (
    <>
      {trigger === undefined ? (
        <AktionButton kbd="T" className={className} onClick={() => setOffen(true)}>
          Termin
        </AktionButton>
      ) : (
        <TriggerHuelle onClick={() => setOffen(true)}>{trigger}</TriggerHuelle>
      )}
      <Dialog
        offen={offen}
        onOpenChange={schliessen}
        titel="Termin eintragen"
        primaer={{ label: 'Termin eintragen', onClick: () => void speichern(), busy: erstellen.isPending }}
        kinder={
          <>
            <ScopeFormular />
            <FormField label="Typ" htmlFor={`termin-typ-${leadId}`}>
              <Select
                id={`termin-typ-${leadId}`}
                value={typ}
                onChange={(e) => setTyp(e.target.value as 'erstgespraech' | 'strategiegespraech')}
                optionen={[
                  { value: 'erstgespraech', label: TYP_LABEL.erstgespraech },
                  { value: 'strategiegespraech', label: TYP_LABEL.strategiegespraech },
                ]}
              />
            </FormField>
            <FormField
              label="Datum und Uhrzeit"
              pflicht
              htmlFor={`termin-wann-${leadId}`}
              fehler={versuch && datumFehlt ? 'Datum und Uhrzeit sind Pflicht.' : undefined}
            >
              <DatePicker
                id={`termin-wann-${leadId}`}
                wert={wann}
                onChange={setWann}
                mitUhrzeit
                min={heuteBerlin()}
                presets={['heute', 'morgen', '+3', '+7']}
                placeholder="Datum, Uhrzeit"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Dauer (Min.)" htmlFor={`termin-dauer-${leadId}`}>
                <Input
                  id={`termin-dauer-${leadId}`}
                  mono
                  inputMode="numeric"
                  value={dauer}
                  onChange={(e) => setDauer(e.target.value.replace(/\D/g, ''))}
                />
              </FormField>
              <FormField label="Ort" htmlFor={`termin-ort-${leadId}`}>
                <Input
                  id={`termin-ort-${leadId}`}
                  value={ort}
                  placeholder="Video, Telefon, vor Ort"
                  onChange={(e) => setOrt(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Sales-Verantwortlich" htmlFor={`termin-wer-${leadId}`}>
              <Select
                id={`termin-wer-${leadId}`}
                value={wer}
                onChange={(e) => setVerantwortlich(e.target.value)}
                optionen={(members ?? [])
                  .filter((m) => !!m.id)
                  .map((m) => ({
                    value: m.id as string,
                    label:
                      m.id === me ? `${m.short_name ?? m.display_name} (ich)` : (m.short_name ?? m.display_name ?? ''),
                  }))}
              />
            </FormField>
          </>
        }
      />
    </>
  )
}
