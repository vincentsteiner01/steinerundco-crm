// M3 – „Anrufgrund setzen“ (BAUPLAN § 3.4 Gate, § 8.2 Nr. 1): Popover mit Select, Vorbelegung aus dem LinkedIn-Zustand mit Hinweis
// „‚nur vernetzt‘ ist die schwächere Grundlage“; `sonstiger_konkreter_anlass` verlangt Notiz + URL. Logik in anrufgrund.ts.
import { useState, type ReactNode } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Popover } from '@/components/ui/Popover'
import { Select } from '@/components/ui/Select'
import { useTastenWaehrendOffen } from '@/components/aktionen/_gemeinsam'
import { ANRUFGRUND_LABEL } from '@/texte/de'
import type { CallBasis, Lead } from '@/types/domain'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { anrufgrundVorbelegung, HINWEIS_NUR_VERNETZT, useAnrufgrundSetzen } from './anrufgrund'

const GRUENDE = Object.keys(ANRUFGRUND_LABEL) as CallBasis[]

export type AnrufgrundSetzenProps = {
  lead: Lead
  trigger?: ReactNode
  offen?: boolean
  onOpenChange?: (o: boolean) => void
  onFertig?: () => void
}

export function AnrufgrundSetzen({ lead, trigger, offen: offenProp, onOpenChange, onFertig }: AnrufgrundSetzenProps) {
  const [intern, setIntern] = useState(false)
  const offen = offenProp ?? intern
  const setOffen = (o: boolean) => {
    if (offenProp === undefined) setIntern(o)
    onOpenChange?.(o)
  }
  const vorbelegt = lead.call_basis ?? anrufgrundVorbelegung(lead)
  const [basis, setBasis] = useState<CallBasis | ''>(vorbelegt ?? '')
  const [note, setNote] = useState(lead.call_basis_note ?? '')
  const [url, setUrl] = useState(lead.call_basis_url ?? '')
  const [versuch, setVersuch] = useState(false)
  const { setzen, isPending } = useAnrufgrundSetzen()

  const sonstiger = basis === 'sonstiger_konkreter_anlass'
  const noteFehlt = sonstiger && !note.trim()
  const urlFehlt = sonstiger && !url.trim()

  const speichern = async () => {
    setVersuch(true)
    if (!basis || noteFehlt || urlFehlt || isPending) return
    try {
      await setzen(lead, basis, note.trim() || null, url.trim() || null)
    } catch {
      return
    }
    toast(`Anrufgrund gesetzt: ${ANRUFGRUND_LABEL[basis]}.`)
    setOffen(false)
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
      titel="Anrufgrund"
      trigger={
        trigger ?? (
          <Button variante="quiet" groesse="S">
            Anrufgrund setzen
          </Button>
        )
      }
    >
      {offen ? <ScopeFormular /> : null}
      <div className="grid w-[300px] max-w-full gap-3 p-1.5">
        <FormField
          label="Anrufgrund"
          pflicht
          htmlFor={`anrufgrund-${lead.id}`}
          hinweis={basis === 'linkedin_vernetzt' ? HINWEIS_NUR_VERNETZT : undefined}
          fehler={versuch && !basis ? 'Anrufgrund ist Pflicht.' : undefined}
        >
          <Select
            id={`anrufgrund-${lead.id}`}
            value={basis}
            platzhalter="Grund wählen"
            onChange={(e) => setBasis(e.target.value as CallBasis | '')}
            optionen={GRUENDE.map((g) => ({ value: g, label: ANRUFGRUND_LABEL[g] }))}
          />
        </FormField>
        {sonstiger ? (
          <>
            <FormField
              label="Notiz"
              pflicht
              htmlFor={`anrufgrund-note-${lead.id}`}
              fehler={versuch && noteFehlt ? 'Notiz ist Pflicht.' : undefined}
            >
              <Input
                id={`anrufgrund-note-${lead.id}`}
                value={note}
                placeholder="Worin besteht der Anlass?"
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
            <FormField
              label="URL"
              pflicht
              htmlFor={`anrufgrund-url-${lead.id}`}
              fehler={versuch && urlFehlt ? 'URL ist Pflicht.' : undefined}
            >
              <Input
                id={`anrufgrund-url-${lead.id}`}
                value={url}
                placeholder="https://…"
                inputMode="url"
                onChange={(e) => setUrl(e.target.value)}
              />
            </FormField>
          </>
        ) : null}
        <div className="flex justify-end gap-1.5">
          <Button variante="quiet" groesse="S" kbd="Esc" onClick={() => setOffen(false)}>
            Abbrechen
          </Button>
          <Button variante="primary" groesse="S" kbd="⌘↵" busy={isPending} onClick={() => void speichern()}>
            Setzen
          </Button>
        </div>
      </div>
    </Popover>
  )
}
