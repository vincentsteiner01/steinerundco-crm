// Leads als Board wie Trello (25.11.2026, Neustart als einfaches CRM): vier Listen nebeneinander, jede Karte ein Lead.
// Hauptweg sind die zwei Knöpfe auf der Karte, Ziehen ist Zusatz; nach jedem Zug ein Toast mit „Rückgängig“.
// Ab 1280 px stehen die vier Listen im Raster, darunter als quer scrollende Reihe, die einrastet (Telefon: eine Liste je Wisch).
// Klick auf eine Karte setzt `?lead=<id>` – das Lead-Blatt rendert die Hülle (LeadOutlet), nicht diese Seite.
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Segment } from '@/components/ui/Segment'
import { useBoardKarten, type BoardKarte, type KarteAngelegt } from '@/data/board'
import { useMeId, useMembers } from '@/data/members'
import { anzeigeName } from '@/lib/mitglied'
import { useIstTelefon } from '@/lib/useMediaQuery'
import type { Member } from '@/types/domain'
import { KartenFlaeche } from './Karte'
import { useKartenAktionen } from './kartenAktionen'
import { LeadHinzufuegen } from './LeadHinzufuegen'
import { Liste } from './Liste'
import { BOARD_LISTEN, listenTitel } from './listen'
import { ALLE, filtereKarten, kartenName, nachListen, sortiereMitglieder } from './logik'
import { useBoardHoehe } from './useBoardHoehe'
import { kollision, useZiehSensoren, zielListe } from './ziehen'

/** So lange bleibt eine Karte hervorgehoben (gerade hinzugefügt bzw. „liegt schon in …“). */
const HERVORHEBEN_MS = 2500

export function Component() {
  const { data: karten, isPending, isError, refetch } = useBoardKarten()
  const { data: alleMitglieder } = useMembers()
  const meId = useMeId()
  const telefon = useIstTelefon()
  const [params, setParams] = useSearchParams()
  const [suche, setSuche] = useState('')
  const [person, setPerson] = useState<string>(ALLE)
  const [dialog, setDialog] = useState(false)
  const [hervorgehoben, setHervorgehoben] = useState<string | null>(null)
  const [gezogen, setGezogen] = useState<BoardKarte | null>(null)
  const { verschiebe } = useKartenAktionen()
  const sensoren = useZiehSensoren()
  const board = useRef<HTMLDivElement | null>(null)
  const hoehe = useBoardHoehe(board, isError)

  const members = useMemo(
    () => sortiereMitglieder(alleMitglieder).filter((m): m is Member & { id: string } => !!m.id),
    [alleMitglieder],
  )
  const listen = useMemo(() => nachListen(filtereKarten(karten ?? [], { suche, person })), [karten, suche, person])
  const gefiltert = suche.trim() !== '' || person !== ALLE

  const oeffne = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params)
      p.set('lead', id)
      setParams(p, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    if (!hervorgehoben) return
    const t = window.setTimeout(() => setHervorgehoben(null), HERVORHEBEN_MS)
    return () => window.clearTimeout(t)
  }, [hervorgehoben])

  const angelegt = (ergebnis: KarteAngelegt, name: string) => {
    // Die Karte soll zu sehen sein: Suche leeren, Personen-Filter nur lösen, wenn er sie verstecken würde
    setSuche('')
    if (person !== ALLE && ergebnis.owner_id !== person) setPerson(ALLE)
    setHervorgehoben(ergebnis.lead_id)
    if (ergebnis.status !== 'schon_da') return
    const karte = karten?.find((k) => k.id === ergebnis.lead_id)
    toast(`${karte ? kartenName(karte) : name} liegt schon in „${listenTitel(ergebnis.liste)}“.`)
  }

  const ziehStart = (e: DragStartEvent) => setGezogen(karten?.find((k) => k.id === e.active.id) ?? null)
  const ziehEnde = (e: DragEndEvent) => {
    const ziel = zielListe(e)
    if (gezogen && ziel) verschiebe(gezogen, ziel)
    setGezogen(null)
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Unter 1280 px rutschen Suche und Filter in eine zweite Zeile – der blaue Knopf bleibt immer oben rechts */}
      <header className="flex flex-wrap items-center gap-3 pt-7 pb-5 max-md:pt-5 max-md:pb-4">
        <h1 className="headline mr-auto">Leads</h1>
        <div className="flex min-w-0 items-center gap-3 max-xl:order-last max-xl:w-full">
          <div className="min-w-0 max-md:flex-1 md:w-52">
            <Input
              type="search"
              groesse={telefon ? 'L' : 'M'}
              aria-label="Suchen"
              placeholder="Suchen"
              autoComplete="off"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>
          <Segment
            ariaLabel="Zugehörigkeit"
            className="flex-none max-md:h-11!"
            wert={person}
            onChange={setPerson}
            optionen={[
              { key: ALLE, label: 'Alle' },
              ...members.map((m) => ({ key: m.id, label: anzeigeName(m, m.id) })),
            ]}
          />
        </div>
        <Button variante="primary" groesse="L" icon={Plus} onClick={() => setDialog(true)}>
          Lead hinzufügen
        </Button>
      </header>
      {isError ? <LadeFehler text="Die Leads konnten nicht geladen werden" onNochmal={() => void refetch()} /> : null}
      <DndContext
        sensors={sensoren}
        collisionDetection={kollision}
        onDragStart={ziehStart}
        onDragEnd={ziehEnde}
        onDragCancel={() => setGezogen(null)}
      >
        <div
          ref={board}
          style={hoehe ? { height: hoehe } : undefined}
          className={cn(
            // Reihe bis an den Bildschirmrand (Seitenrand als Innenabstand), damit Karten beim Wischen nicht am Rand abgeschnitten wirken
            'flex gap-3 overflow-x-auto py-1',
            'max-xl:-mx-gutter max-xl:px-gutter max-xl:scroll-px-gutter max-xl:pb-3',
            // Beim Ziehen kein Einrasten: es kämpft sonst mit dem automatischen Weiterscrollen am Rand
            gezogen ? 'snap-none' : 'snap-x max-md:snap-mandatory',
            'xl:grid xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)] xl:gap-4 xl:overflow-visible',
          )}
        >
          {BOARD_LISTEN.map((l) => (
            <Liste
              key={l.key}
              liste={l.key}
              titel={l.titel}
              karten={listen[l.key]}
              members={members}
              laedt={isPending}
              fehler={isError && !karten}
              gefiltert={gefiltert}
              hervorgehoben={hervorgehoben}
              onOeffnen={oeffne}
              onVerschieben={verschiebe}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {gezogen ? (
            <div inert className="shadow-float rotate-1 cursor-grabbing rounded-md">
              <KartenFlaeche karte={gezogen} member={members.find((m) => m.id === gezogen.owner_id)} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <LeadHinzufuegen offen={dialog} onOpenChange={setDialog} members={members} meId={meId} onAngelegt={angelegt} />
    </div>
  )
}
