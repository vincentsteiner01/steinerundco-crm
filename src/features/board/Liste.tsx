// Eine Liste des Boards (25.11.2026): hellgraue, abgerundete Fläche mit Titel und Kartenzahl, die Karten untereinander.
// Die Liste ist das Ablageziel beim Ziehen. Lange Listen zeigen zunächst 50 Karten, darunter leise „Weitere anzeigen“.
import { useDroppable } from '@dnd-kit/core'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import type { BoardKarte } from '@/data/board'
import type { Member } from '@/types/domain'
import { Karte } from './Karte'
import type { BoardListe } from './listen'
import { KARTEN_JE_SEITE } from './logik'

type ListeProps = {
  liste: BoardListe
  titel: string
  karten: readonly BoardKarte[]
  members: readonly Member[] | undefined
  laedt?: boolean
  /** Laden gescheitert und nichts da: die Liste bleibt leer, ohne „Leer“ zu behaupten (die Fehlerzeile steht über dem Board). */
  fehler?: boolean
  /** Suche oder Personen-Filter aktiv: eine leere Liste heißt dann „Keine Treffer“ statt „Leer“. */
  gefiltert?: boolean
  hervorgehoben?: string | null
  onOeffnen: (id: string) => void
  onVerschieben: (karte: BoardKarte, ziel: BoardListe) => void
}

export function Liste({
  liste,
  titel,
  karten,
  members,
  laedt,
  fehler,
  gefiltert,
  hervorgehoben,
  onOeffnen,
  onVerschieben,
}: ListeProps) {
  const { setNodeRef, isOver } = useDroppable({ id: liste })
  const titelId = useId()
  const [grenze, setGrenze] = useState(KARTEN_JE_SEITE)
  // Eine hervorgehobene Karte weiter unten wird mit angezeigt – sonst wäre „liegt schon in …“ nicht zu sehen
  const stelle = hervorgehoben ? karten.findIndex((k) => k.id === hervorgehoben) : -1
  const sichtbar = karten.slice(0, Math.max(grenze, stelle + 1))
  const rest = karten.length - sichtbar.length
  return (
    // Ablageziel ist die ganze Spalte bis zum unteren Rand des Boards, nicht nur die graue Fläche – eine kurze Liste
    // wäre beim Ziehen sonst schwer zu treffen. Die graue Fläche selbst ist nur so hoch wie ihr Inhalt.
    <div
      ref={setNodeRef}
      data-liste={liste}
      className="h-full min-h-0 w-[min(300px,86vw)] shrink-0 snap-start md:w-[272px] xl:w-auto xl:min-w-0"
    >
      <section
        aria-labelledby={titelId}
        className={cn(
          // relative: die unsichtbare Beschriftung (sr-only, absolut) bleibt so in der Liste – sonst ragt sie aus der quer
          // scrollenden Reihe heraus und macht auf dem Telefon die ganze Seite breiter
          'bg-sidebar relative flex max-h-full min-h-0 flex-col rounded-md p-2',
          'ease-brand transition-[box-shadow] duration-[var(--t-1)]',
          isOver && 'ring-signal/50 ring-2',
        )}
      >
        <header className="flex h-10 shrink-0 items-center gap-2 px-1.5">
          <h2 id={titelId} className="text-h3 text-ink-bright truncate">
            {titel}
          </h2>
          {laedt || fehler ? null : (
            <span className="text-small text-ink-3 tnum">
              {karten.length}
              <span className="sr-only"> Karten</span>
            </span>
          )}
        </header>
        {laedt ? (
          <Skeleton zeilen={3} className="px-1.5 py-3" />
        ) : fehler ? null : karten.length === 0 ? (
          <p className="border-line-strong text-small text-ink-3 rounded-md border border-dashed px-3 py-7 text-center">
            {gefiltert ? 'Keine Treffer' : 'Leer'}
          </p>
        ) : (
          // Die Liste ist so hoch wie ihr Inhalt; erst wenn sie die Board-Höhe erreicht (max-h-full), schrumpft dieser Bereich und scrollt.
          // Innenabstand 2 px: der feine Rand der Karten (shadow-card) würde am Scrollbereich sonst abgeschnitten
          <ul className="-mx-0.5 grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto overscroll-y-contain p-0.5">
            {sichtbar.map((k) => (
              <Karte
                key={k.id}
                karte={k}
                member={k.owner_id ? members?.find((m) => m.id === k.owner_id) : null}
                hervorgehoben={k.id === hervorgehoben}
                onOeffnen={onOeffnen}
                onVerschieben={onVerschieben}
              />
            ))}
            {rest > 0 ? (
              <li>
                <Button variante="quiet" className="w-full" onClick={() => setGrenze((g) => g + KARTEN_JE_SEITE)}>
                  Weitere anzeigen
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  )
}
