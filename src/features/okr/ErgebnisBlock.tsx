// Ein Key Result in der Karte eines Monatsziels: Titel, die leise Zeile darunter, je Person (oder fürs Team) eine Zeile mit
// Balken bzw. Haken-Feldern, „Ist / Soll“ und Ampel – darunter die To-dos.
// Raster der Zeilen: ab 768 px Person · Balken · Ist/Soll · Ampel in einer Zeile (alle Zeilen eines Key Results teilen sich die
// Spalten, die Zahlen stehen untereinander); am Telefon Person, Ist/Soll und Ampel oben, der Balken in voller Breite darunter.
import { useId } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import type { TeamPerson } from '@/features/team/personen'
import { hatSoll, type ErgebnisAnsicht, type OkrAktionen } from './ansicht'
import { Balken } from './Balken'
import { Haken } from './Haken'
import { aufgerundet, ergebnisZeile, istSollText, type Fortschritt, type OkrErgebnis, type OkrZiel } from './rechnen'
import { Todos } from './Todos'
import { Menue, PlusMinus, StatusMarke } from './_Teile'

/** Bis zu diesem Soll je Zeile stehen Haken-Felder statt des Balkens. */
const HAKEN_BIS = 10

function Zeile({
  e,
  f,
  person,
  gesperrt,
  onZaehlen,
}: {
  e: OkrErgebnis
  f: Fortschritt
  /** `undefined` = die Zeile des Teams */
  person: TeamPerson | undefined
  gesperrt: boolean
  onZaehlen: (delta: 1 | -1) => void
}) {
  const wer = person?.name ?? 'Team'
  const wert = istSollText(f, e.einheit)
  const manuell = e.quelle === 'manuell'
  const felder = aufgerundet(f.soll)
  const klein = [
    hatSoll(f.woche) ? `Woche ${istSollText(f.woche, e.einheit)}` : null,
    hatSoll(f.heute) ? `Heute ${istSollText(f.heute, e.einheit)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const label = `${e.titel} · ${wer}`

  return (
    <li data-zeile={f.memberId ?? 'team'} className="col-span-full grid grid-cols-subgrid items-center gap-y-1 py-2">
      <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
        {/* der Name steht daneben – das Bild muss nicht noch einmal vorgelesen werden */}
        {person ? (
          <span aria-hidden className="inline-flex">
            <Avatar member={person.member} groesse={22} />
          </span>
        ) : null}
        <span data-wer className="text-ui text-ink truncate">
          {wer}
        </span>
      </span>
      <span
        data-wert
        className="text-ui text-ink-bright tnum col-start-2 row-start-1 text-right whitespace-nowrap md:col-start-3"
      >
        {wert}
      </span>
      <StatusMarke status={f.status} className="col-start-3 row-start-1 justify-self-end md:col-start-4" />
      <div className="col-span-full row-start-2 flex min-w-0 items-center gap-3 md:col-span-1 md:col-start-2 md:row-start-1">
        {manuell && felder <= HAKEN_BIS ? (
          <Haken
            anzahl={felder}
            erledigt={Math.min(felder, Math.floor(f.ist + 1e-9))}
            label={label}
            gesperrt={gesperrt}
            onPlus={() => onZaehlen(1)}
            onMinus={() => onZaehlen(-1)}
          />
        ) : (
          <>
            <Balken anteil={f.anteil} tempo={f.tempo} status={f.status} label={label} wert={wert} className="flex-1" />
            {manuell ? (
              <PlusMinus
                gesperrt={gesperrt}
                minusMoeglich={f.ist > 0}
                onPlus={() => onZaehlen(1)}
                onMinus={() => onZaehlen(-1)}
              />
            ) : null}
          </>
        )}
      </div>
      {klein ? (
        <span
          data-klein
          className="text-small text-ink-3 tnum col-span-full row-start-3 md:col-span-3 md:col-start-2 md:row-start-2"
        >
          {klein}
        </span>
      ) : null}
    </li>
  )
}

export function ErgebnisBlock({
  ziel,
  ansicht,
  personen,
  meId,
  aktionen,
}: {
  ziel: OkrZiel
  ansicht: ErgebnisAnsicht
  personen: readonly TeamPerson[]
  meId: string | null
  aktionen: OkrAktionen
}) {
  const { ergebnis: e, fortschritte, todos } = ansicht
  const titelId = useId()
  return (
    <section aria-labelledby={titelId} className="border-line min-w-0 border-t px-6 pt-4 pb-5 max-md:px-4 max-md:pb-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 pt-1">
          <h3 id={titelId} className="text-h3 text-ink-bright [overflow-wrap:anywhere]">
            {e.titel}
          </h3>
          <p className="text-small text-ink-3 mt-0.5">{ergebnisZeile(e)}</p>
        </div>
        <Menue
          label={`Menü für „${e.titel}“`}
          className="-mr-2 max-md:-mr-2.5"
          eintraege={[
            { label: 'Bearbeiten', onSelect: () => aktionen.ergebnisBearbeiten(ziel, e) },
            { label: 'Löschen', danger: true, onSelect: () => aktionen.ergebnisLoeschen(e) },
          ]}
        />
      </div>
      <ul
        aria-label={`Fortschritt: ${e.titel}`}
        className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 md:grid-cols-[7.5rem_minmax(0,1fr)_auto_auto]"
      >
        {fortschritte.map((f) => (
          <Zeile
            key={f.memberId ?? 'team'}
            e={e}
            f={f}
            person={personen.find((p) => p.id === f.memberId)}
            // die Zeile des Teams bucht für die angemeldete Person
            gesperrt={f.memberId === null && !meId}
            onZaehlen={(delta) => aktionen.zaehlen(e, f.memberId, delta)}
          />
        ))}
      </ul>
      <Todos ergebnis={e} todos={todos} personen={personen} />
    </section>
  )
}
