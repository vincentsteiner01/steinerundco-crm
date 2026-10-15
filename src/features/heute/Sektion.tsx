// Sektion der Heute-Queue (BAUPLAN § 3.2 Sektion.tsx, DESIGN-SYSTEM § 5.6): SektionsKopf (M0) + Karten/Abhakzeilen + Einklappen.
// Leere Sektionen rendert die Seite gar nicht (H-02). Der Zustand kommt aus useEingeklappt (localStorage).
import type { ReactNode } from 'react'
import { SektionsKopf } from '@/components/ui/SektionsKopf'
import { QUEUE_SEKTION_LABEL } from '@/texte/de'
import type { UiSektion } from '@/types/domain'

export type SektionProps = {
  sektion: UiSektion
  zaehler: number
  ueberfaellig?: number
  eingeklappt: boolean
  onToggle: () => void
  rechts?: ReactNode
  /** Zusatz hinter dem Zähler („· offene Anfragen der letzten 7 Tage · alle 212 anzeigen“) */
  zusatz?: ReactNode
  /** Zeile unter dem Kopf (Neue Anfragen: „Heute noch möglich: 18 von 30 · Woche 132 / 150“) */
  unterzeile?: ReactNode
  children: ReactNode
  /** Karten (grid, 10 px) oder Abhakzeilen (ul ohne Abstand) */
  art?: 'karten' | 'zeilen'
}

export function Sektion({
  sektion,
  zaehler,
  ueberfaellig,
  eingeklappt,
  onToggle,
  rechts,
  zusatz,
  unterzeile,
  children,
  art = 'karten',
}: SektionProps) {
  const id = `sektion-${sektion}`
  return (
    <section aria-labelledby={id} data-sektion={sektion} className="mb-6">
      <SektionsKopf
        id={id}
        label={QUEUE_SEKTION_LABEL[sektion]}
        zaehler={zaehler}
        ueberfaellig={ueberfaellig}
        eingeklappt={eingeklappt}
        onToggle={onToggle}
        rechts={
          rechts || zusatz ? (
            <>
              {zusatz ? <span className="text-small text-ink-3 max-md:hidden">{zusatz}</span> : null}
              {rechts}
            </>
          ) : undefined
        }
      />
      {!eingeklappt ? (
        <>
          {unterzeile ? <div className="text-small text-ink-2 tnum mb-2.5">{unterzeile}</div> : null}
          {art === 'karten' ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" role="list">
              {children}
            </div>
          ) : (
            <ul className="m-0 list-none p-0" role="list" aria-label={QUEUE_SEKTION_LABEL[sektion]}>
              {children}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}
