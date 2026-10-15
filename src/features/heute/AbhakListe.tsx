// Abhaklisten (BAUPLAN § 3.2 AbhakListe.tsx, ux § 3.1.3, DESIGN-SYSTEM § 5.9): Annahme prüfen · Neue Anfragen · Zurückziehen mit
// AbhakZeile (M0). E/Space abhaken · X abgelehnt/passt nicht · D Datum · ⇧E mit Notiz · O Profil · ⇧↓ Bereich.
// Die Popovers (Datum, Notiz-Variante, Passt nicht) steuert die Seite über `dialog`, damit die Tasten sie öffnen können.
import { ExternalLink } from 'lucide-react'
import { Fragment, useState } from 'react'
import { NotizFeld } from '@/components/aktionen'
import { AbhakZeile } from '@/components/ui/AbhakZeile'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { DatePicker } from '@/components/ui/DatePicker'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import { fmtDatumKurz } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import type { QueueItem, UiSektion } from '@/types/domain'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { itemKey } from './sektionen'
import { NOTE_VARIANTEN, PASST_NICHT, useQueueAktionen } from './useQueueAktionen'
import { useTastenOffen } from './useTastenOffen'

export type AbhakDialog = { key: string; art: 'datum' | 'variante' | 'passt_nicht' | 'notiz' } | null

export type AbhakListeProps = {
  sektion: Extract<UiSektion, 'annahme_pruefen' | 'neue_anfragen' | 'zurueckziehen'>
  items: QueueItem[]
  cursor: string | null
  onCursor: (key: string) => void
  auswahl: ReadonlySet<string>
  dialog: AbhakDialog
  onDialog: (d: AbhakDialog) => void
  heute: string
}

export function AbhakListe({ sektion, items, cursor, onCursor, auswahl, dialog, onDialog, heute }: AbhakListeProps) {
  const a = useQueueAktionen()
  const [angehakt, setAngehakt] = useState<Set<string>>(() => new Set())

  const abhaken = (item: QueueItem) => {
    const key = itemKey(item)
    setAngehakt((s) => new Set([...s, key]))
    void a.gesendet(item)
  }

  return (
    <>
      {items.map((item) => {
        const key = itemKey(item)
        const ist = cursor === key
        const d = dialog?.key === key ? dialog : null
        // AbhakZeile ist selbst das <li> – kein Wrapper-<li> (li in li wäre ungültig)
        return (
          <Fragment key={key}>
            <AbhakZeile
              cursor={ist}
              ausgewaehlt={auswahl.has(key)}
              name={item.lead_name ?? '–'}
              unternehmen={item.company_name ?? undefined}
              meta={meta(sektion, item, heute)}
              onClick={() => onCursor(key)}
              onAbhaken={() => abhaken(item)}
              angehakt={angehakt.has(key)}
              rechts={
                <Aktionen sektion={sektion} item={item} dialog={d} onDialog={onDialog} aktionen={a} heute={heute} />
              }
            />
            {d?.art === 'notiz' && item.lead_id ? (
              <li role="presentation" className="border-line list-none border-b px-3 py-2.5">
                <NotizFeld
                  leadId={item.lead_id}
                  offen
                  trigger={<span />}
                  onOpenChange={(o) => !o && onDialog(null)}
                  onFertig={() => onDialog(null)}
                />
              </li>
            ) : null}
          </Fragment>
        )
      })}
    </>
  )
}

function meta(sektion: AbhakListeProps['sektion'], item: QueueItem, heute: string): string {
  if (sektion === 'annahme_pruefen') return item.due_at ? `angefragt ${fmtDatumKurz(item.due_at)}` : ''
  if (sektion === 'zurueckziehen') {
    const tage = item.days_overdue ?? (item.due_at ? tageDifferenz(berlinTag(item.due_at), heute) : 0)
    return `offen seit ${tage} T`
  }
  return item.subtitle ?? ''
}

function Aktionen({
  sektion,
  item,
  dialog,
  onDialog,
  aktionen: a,
  heute,
}: {
  sektion: AbhakListeProps['sektion']
  item: QueueItem
  dialog: AbhakDialog
  onDialog: (d: AbhakDialog) => void
  aktionen: ReturnType<typeof useQueueAktionen>
  heute: string
}) {
  const key = itemKey(item)
  const offen = (art: NonNullable<AbhakDialog>['art']) => dialog?.art === art
  const schliessen = () => onDialog(null)

  useTastenOffen(offen('passt_nicht'), (b) => {
    const g = PASST_NICHT.find((x) => x.kbd === b)
    if (g) {
      void a.passtNicht(item, g)
      schliessen()
      return true
    }
    if (b === 'escape') {
      schliessen()
      return true
    }
    return undefined
  })
  useTastenOffen(offen('variante'), (b) => {
    const v = NOTE_VARIANTEN.find((x) => x.kbd === b)
    if (v) {
      void a.gesendet(item, { noteVariant: v.variant })
      schliessen()
      return true
    }
    if (b === 'escape') {
      schliessen()
      return true
    }
    return undefined
  })

  if (sektion === 'annahme_pruefen') {
    return (
      <>
        {item.subtitle ? <Chip ton="muted">{item.subtitle}</Chip> : null}
        <Popover
          offen={offen('datum')}
          onOpenChange={(o) => onDialog(o ? { key, art: 'datum' } : null)}
          titel="Angenommen am"
          trigger={
            <Button variante="quiet" groesse="S" kbd="D" aria-label="Datum der Annahme">
              Datum
            </Button>
          }
        >
          <ScopeFormular />
          <div className="p-1.5">
            <DatePicker
              wert={null}
              presets={['heute', 'morgen']}
              onChange={(iso) => {
                if (!iso) return
                void a.angenommen(item, iso)
                schliessen()
              }}
            />
          </div>
        </Popover>
        <Button variante="quiet" groesse="S" kbd="X" onClick={() => void a.abgelehnt(item)}>
          Abgelehnt
        </Button>
      </>
    )
  }
  if (sektion === 'neue_anfragen') {
    return (
      <>
        <Button variante="quiet" groesse="S" kbd="O" icon={ExternalLink} onClick={() => a.profilOeffnen(item)}>
          Profil öffnen
        </Button>
        <Popover
          offen={offen('variante')}
          onOpenChange={(o) => onDialog(o ? { key, art: 'variante' } : null)}
          titel="Anfrage mit Notiz gesendet"
          trigger={
            <Button groesse="S" kbd="⇧E" aria-label="Mit Notiz gesendet">
              mit Notiz
            </Button>
          }
        >
          <ScopeFormular />
          <div role="menu" aria-label="Notiz-Variante">
            {NOTE_VARIANTEN.map((v) => (
              <PopoverEintrag
                key={v.variant}
                kbd={v.kbd}
                role="menuitem"
                onClick={() => {
                  void a.gesendet(item, { noteVariant: v.variant })
                  schliessen()
                }}
              >
                {v.label}
              </PopoverEintrag>
            ))}
          </div>
        </Popover>
        <Button groesse="S" kbd="E" onClick={() => void a.gesendet(item)}>
          Gesendet
        </Button>
        <Popover
          offen={offen('passt_nicht')}
          onOpenChange={(o) => onDialog(o ? { key, art: 'passt_nicht' } : null)}
          titel="Passt nicht – Grund"
          trigger={
            <Button variante="quiet" groesse="S" kbd="X">
              Passt nicht
            </Button>
          }
        >
          <ScopeFormular />
          <div role="menu" aria-label="Passt nicht – Grund">
            {PASST_NICHT.map((g) => (
              <PopoverEintrag
                key={g.key}
                kbd={g.kbd}
                role="menuitem"
                onClick={() => {
                  void a.passtNicht(item, g)
                  schliessen()
                }}
              >
                {g.label}
              </PopoverEintrag>
            ))}
          </div>
        </Popover>
      </>
    )
  }
  void heute
  return (
    <Button groesse="S" kbd="E" onClick={() => void a.gesendet(item)}>
      Zurückgezogen
    </Button>
  )
}
