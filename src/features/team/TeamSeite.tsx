// Team (Route /team, Neustart 25.11.2026): je Person eine Karte mit Avatar und Name, darunter die Zahl ihrer Karten in den vier
// Listen des Boards. Gezählt wird aus denselben Daten wie das Board (useBoardKarten, nach Zugehörigkeit) – die Zahlen stimmen
// deshalb immer mit /leads überein und laufen über Realtime mit. Bewusst nichts weiter: kein Zeitraum, keine Kennzahlen,
// kein Protokoll, keine Links, keine Tasten.
import { useId, useMemo } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBoardKarten, type BoardKarte } from '@/data/board'
import { useMembers } from '@/data/members'
import { BOARD_LISTEN, type BoardListe } from '@/features/board/listen'
import { teamPersonen, type TeamPerson } from './personen'

type Zahlen = Record<BoardListe, number>

const nullen = (): Zahlen => Object.fromEntries(BOARD_LISTEN.map((l) => [l.key, 0])) as Zahlen

/** Karten je Person und Liste. Karten ohne Zugehörigkeit zählen bei niemandem. */
function zaehle(karten: readonly BoardKarte[]): Map<string, Zahlen> {
  const jePerson = new Map<string, Zahlen>()
  for (const k of karten) {
    if (!k.owner_id) continue
    const zahlen = jePerson.get(k.owner_id) ?? nullen()
    zahlen[k.board_liste] += 1
    jePerson.set(k.owner_id, zahlen)
  }
  return jePerson
}

function PersonenKarte({ person, zahlen }: { person: TeamPerson; zahlen: Zahlen }) {
  const titelId = useId()
  return (
    <section
      aria-labelledby={titelId}
      className="border-line bg-surface shadow-card rounded-md border px-6 pt-6 pb-3 max-md:px-5 max-md:pt-5"
    >
      <div className="flex items-center gap-3.5">
        {/* Der Name steht daneben – das Bild muss nicht noch einmal vorgelesen werden */}
        <span aria-hidden className="inline-flex">
          <Avatar member={person.member} groesse={48} />
        </span>
        <h2 id={titelId} className="text-h2 text-ink-bright min-w-0 truncate">
          {person.name}
        </h2>
      </div>
      {/* Zwei Spalten für alle vier Zeilen (subgrid): die Zahlen stehen rechtsbündig untereinander, die Listennamen in einer Flucht */}
      <ul className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
        {BOARD_LISTEN.map((l) => (
          <li key={l.key} className="border-line col-span-2 grid grid-cols-subgrid items-baseline border-t py-3">
            <span className="text-h2 text-ink-bright tnum text-right">{zahlen[l.key]}</span>
            <span className="text-body text-ink-2">{l.titel}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Component() {
  const mitglieder = useMembers()
  const board = useBoardKarten()
  const personen = useMemo(() => teamPersonen(mitglieder.data ?? []), [mitglieder.data])
  const jePerson = useMemo(() => zaehle(board.data ?? []), [board.data])
  // Schon geladene Zahlen bleiben stehen, auch wenn ein späteres Neuladen scheitert
  const geladen = !!mitglieder.data && !!board.data
  const fehler = !geladen && (mitglieder.isError || board.isError)

  const nochmal = () => {
    if (mitglieder.isError) void mitglieder.refetch()
    if (board.isError) void board.refetch()
  }

  return (
    <div>
      <header className="pt-7 pb-6 max-md:pt-5 max-md:pb-5">
        {/* min-h-11 wie auf Leads und Leitfäden (dort die Höhe des blauen Knopfs): der Titel sitzt auf allen Seiten gleich */}
        <h1 className="headline flex min-h-11 items-center">Team</h1>
      </header>

      {geladen ? (
        <ul className="flex flex-wrap gap-4">
          {personen.map((p) => (
            <li key={p.id} className="w-full min-w-0 md:w-[340px]">
              <PersonenKarte person={p} zahlen={jePerson.get(p.id) ?? nullen()} />
            </li>
          ))}
        </ul>
      ) : fehler ? (
        <div role="alert" className="grid justify-items-start gap-5 py-4">
          <p className="text-body text-ink-2">Das Team konnte nicht geladen werden.</p>
          <Button groesse="L" onClick={nochmal}>
            Erneut versuchen
          </Button>
        </div>
      ) : (
        <Skeleton zeilen={5} className="max-w-[340px]" />
      )}
    </div>
  )
}
