// „Beenden“ `B` (BAUPLAN § 3.1.10b; ux § 4.8: kein Dialog – Grund-Popover inline, Rückgängig per Toast):
// Gründe `1–9` → useLeadUpdate({ stage: 'beendet', ended_reason, ended_note }); Undo über die `stage_wechsel`-Aktivität.
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { Textarea } from '@/components/ui/Textarea'
import { useLead, useLeadUpdate } from '@/data/leads'
import { useSettings } from '@/data/settings'
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
import { AktionButton, ScopeFormular } from './_Teile'
import { beendenGruende, type BeendenGrund } from './gruende'

export function Beenden({ leadId, trigger, offen: offenProp, onOpenChange, onFertig, aktiv, className }: AktionProps) {
  const [offen, setOffen] = useOffen(offenProp, onOpenChange)
  const [sonstiges, setSonstiges] = useState(false)
  const [notiz, setNotiz] = useState('')
  const { data: lead } = useLead(leadId)
  const { data: settings } = useSettings()
  const update = useLeadUpdate()
  const { anbieten } = useUndo()
  const inval = useLeadInvalidierung()
  const gruende = beendenGruende(settings?.ended_reason_labels)

  const schliessen = (o: boolean) => {
    setOffen(o)
    if (!o) {
      setSonstiges(false)
      setNotiz('')
    }
  }

  const beenden = async (g: BeendenGrund) => {
    if (!lead || update.isPending) return
    const note = g.notizPflicht ? getrimmt(notiz) : (g.note ?? null)
    if (g.notizPflicht && !note) return // Grund Pflicht: Sonstiges braucht eine Notiz
    try {
      await update.mutateAsync({
        id: lead.id,
        erwartetUpdatedAt: lead.updated_at,
        patch: { stage: 'beendet', ended_reason: g.reason, ended_note: note },
      })
    } catch {
      return
    }
    inval(leadId)
    const text = `Beendet · ${g.label}.`
    const a = await nachleseAktivitaet(leadId, ['stage_wechsel'])
    if (a) anbieten(a.id, text, leadId)
    else toast(text)
    schliessen(false)
    onFertig?.()
  }

  const waehle = (g: BeendenGrund) => {
    if (g.notizPflicht) setSonstiges(true)
    else void beenden(g)
  }

  useAktionTaste('b', trigger === undefined && !!aktiv, () => setOffen(true))
  useTastenWaehrendOffen(offen, (b) => {
    const g = gruende.find((x) => x.kbd === b)
    if (g) {
      waehle(g)
      return true
    }
    if (b === 'mod+enter' && sonstiges) {
      const g = gruende.find((x) => x.notizPflicht)
      if (g) void beenden(g)
      return true
    }
    return undefined
  })

  const sonst = gruende.find((g) => g.notizPflicht)

  return (
    <Popover
      offen={offen}
      onOpenChange={schliessen}
      titel="Beenden – Grund"
      className={className}
      trigger={
        trigger ?? (
          <AktionButton kbd="B" disabled={!lead}>
            Beenden
          </AktionButton>
        )
      }
    >
      <ScopeFormular />
      {sonstiges && sonst ? (
        <div className="grid gap-2 p-1" role="group" aria-label="Sonstiges – Notiz">
          <Textarea
            autoFocus
            aria-label="Notiz"
            placeholder="Grund in einem Satz"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            onSubmit={() => void beenden(sonst)}
            mitHinweis
          />
          <div className="flex justify-end gap-1.5">
            <Button variante="quiet" groesse="S" onClick={() => setSonstiges(false)}>
              Zurück
            </Button>
            <Button
              variante="primary"
              groesse="S"
              kbd="⌘↵"
              disabled={!getrimmt(notiz)}
              busy={update.isPending}
              onClick={() => void beenden(sonst)}
            >
              Beenden
            </Button>
          </div>
        </div>
      ) : (
        <div role="menu" aria-label="Beenden – Grund">
          {gruende.map((g) => (
            <PopoverEintrag
              key={g.key}
              kbd={g.kbd}
              role="menuitem"
              onClick={() => waehle(g)}
              disabled={update.isPending}
            >
              {g.label}
            </PopoverEintrag>
          ))}
        </div>
      )}
    </Popover>
  )
}
