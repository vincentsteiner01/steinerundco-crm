// Karte eines Monatsziels in voller Breite: Kopf mit Titel, Fortschritt in Prozent und EINER Ampel fürs Ziel, darunter je
// Key Result ein Block. Am Telefon stehen Prozent und Ampel unter dem Titel – lange Titel brechen sonst mitten im Wort.
import { Plus } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import type { TeamPerson } from '@/features/team/personen'
import { fmtAnteil } from '@/lib/format'
import type { OkrAktionen, ZielAnsicht } from './ansicht'
import { ErgebnisBlock } from './ErgebnisBlock'
import type { OkrZiel } from './rechnen'
import { Menue, StatusMarke } from './_Teile'

/** Menü „⋯“ eines Ziels – dasselbe an den großen Zielen und an den Monatszielen. */
export function ZielMenue({ ziel, aktionen, className }: { ziel: OkrZiel; aktionen: OkrAktionen; className?: string }) {
  return (
    <Menue
      label={`Menü für „${ziel.titel}“`}
      className={className}
      eintraege={[
        { label: 'Key Result hinzufügen', onSelect: () => aktionen.ergebnisNeu(ziel) },
        { label: 'Ziel bearbeiten', onSelect: () => aktionen.zielBearbeiten(ziel) },
        { label: 'Ziel löschen', danger: true, onSelect: () => aktionen.zielLoeschen(ziel) },
      ]}
    />
  )
}

/** Ein Ziel ohne Key Result: ein leiser Knopf an der Stelle, an der sie stehen werden. */
export function ErstesErgebnis({ ziel, aktionen }: { ziel: OkrZiel; aktionen: OkrAktionen }) {
  return (
    <Button variante="quiet" icon={Plus} className="-ml-3.5 max-md:h-11!" onClick={() => aktionen.ergebnisNeu(ziel)}>
      Key Result hinzufügen
    </Button>
  )
}

export function ZielKarte({
  ansicht,
  personen,
  meId,
  aktionen,
}: {
  ansicht: ZielAnsicht
  personen: readonly TeamPerson[]
  meId: string | null
  aktionen: OkrAktionen
}) {
  const { ziel, ergebnisse, anteil, status } = ansicht
  const titelId = useId()
  return (
    <article aria-labelledby={titelId} className="border-line bg-surface shadow-card min-w-0 rounded-md border">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-6 py-4 max-md:px-4 max-md:py-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <h2 id={titelId} className="text-h2 text-ink-bright col-start-1 row-start-1 [overflow-wrap:anywhere]">
          {ziel.titel}
        </h2>
        {ergebnisse.length ? (
          <div className="col-start-1 row-start-2 flex items-center gap-2.5 md:col-start-2 md:row-start-1">
            <span data-anteil className="text-h2 text-ink-bright tnum">
              {fmtAnteil(anteil)}
            </span>
            <StatusMarke status={status} />
          </div>
        ) : null}
        <ZielMenue
          ziel={ziel}
          aktionen={aktionen}
          className="col-start-2 row-start-1 -mr-2 max-md:-mr-2.5 md:col-start-3"
        />
      </header>
      {ergebnisse.length ? (
        ergebnisse.map((e) => (
          <ErgebnisBlock
            key={e.ergebnis.id}
            ziel={ziel}
            ansicht={e}
            personen={personen}
            meId={meId}
            aktionen={aktionen}
          />
        ))
      ) : (
        <div className="border-line border-t px-6 py-3 max-md:px-4">
          <ErstesErgebnis ziel={ziel} aktionen={aktionen} />
        </div>
      )}
    </article>
  )
}
