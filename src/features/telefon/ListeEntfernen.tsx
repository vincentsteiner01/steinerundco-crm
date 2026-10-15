// M3 – `R` in der Anrufliste (ux § 5.3): „aus der Liste entfernen (Grund-Popover, kein Versuch)“. Nur heute, nur dieser Browser;
// kein Versuch, kein Server-Eintrag. Ziffern 1–4 wählen den Grund, solange das Popover offen ist.
import { useTastenWaehrendOffen } from '@/components/aktionen/_gemeinsam'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { ENTFERNEN_GRUENDE, entfernen } from './useAnrufliste'

export type ListeEntfernenProps = {
  leadId: string
  offen: boolean
  onOpenChange: (o: boolean) => void
}

export function ListeEntfernen({ leadId, offen, onOpenChange }: ListeEntfernenProps) {
  const waehle = (label: string) => {
    entfernen(leadId, undefined, label)
    toast(`Heute aus der Liste entfernt – ${label}.`)
    onOpenChange(false)
  }

  useTastenWaehrendOffen(offen, (b) => {
    const g = ENTFERNEN_GRUENDE.find((x) => x.kbd === b)
    if (!g) return undefined
    waehle(g.label)
    return true
  })

  return (
    <Popover
      offen={offen}
      onOpenChange={onOpenChange}
      titel="Heute aus der Liste entfernen"
      align="end"
      trigger={
        <Button variante="quiet" groesse="S" kbd="R">
          Entfernen
        </Button>
      }
    >
      {offen ? <ScopeFormular /> : null}
      <div role="menu" aria-label="Grund">
        {ENTFERNEN_GRUENDE.map((g) => (
          <PopoverEintrag key={g.kbd} kbd={g.kbd} role="menuitem" onClick={() => waehle(g.label)}>
            {g.label}
          </PopoverEintrag>
        ))}
      </div>
    </Popover>
  )
}
