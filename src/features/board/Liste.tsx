// Eine Liste des Boards (25.11.2026): hellgraue, abgerundete Fläche mit Titel und Kartenzahl, die Karten untereinander.
// Die Liste ist das Ablageziel beim Ziehen. Lange Listen zeigen zunächst 50 Karten, darunter leise „Weitere anzeigen“.
// Verlässt eine Karte die Liste über ihren Knopf, bleibt der Fokus in der Liste: auf der nachrückenden Karte, sonst der
// davor, in der leeren Liste auf dem Titel – nicht auf <body>, von wo Tab wieder am Seitenanfang begänne.
import { useDroppable } from '@dnd-kit/core'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import type { BoardKarte } from '@/data/board'
import type { Member } from '@/types/domain'
import { Karte } from './Karte'
import { kartenKnoten, nameAufKarte } from './kartenKnoten'
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
  // Die Grenze bleibt angehoben – sonst klappt die Liste nach dem Hervorheben zurück und die Karte ist wieder weg
  if (stelle >= grenze) setGrenze(stelle + 1)
  const sichtbar = karten.slice(0, Math.max(grenze, stelle + 1))
  const rest = karten.length - sichtbar.length

  const bereich = useRef<HTMLElement | null>(null)
  const kopf = useRef<HTMLHeadingElement | null>(null)
  // Gemerkt beim Druck auf einen Karten-Knopf: welche Karte geht und welche den Fokus erbt (`null` = keine mehr da)
  const fokusNachZug = useRef<{ weg: string; erbe: string | null } | null>(null)
  const verschieben = (karte: BoardKarte, ziel: BoardListe) => {
    // Nur wenn der Fokus auf dieser Karte liegt (Tastatur; in Chrome auch nach einem Mausklick) – sonst ist nichts zu retten
    if (kartenKnoten(karte.id, bereich.current)?.contains(document.activeElement)) {
      const i = karten.findIndex((k) => k.id === karte.id)
      fokusNachZug.current = { weg: karte.id, erbe: (karten[i + 1] ?? karten[i - 1])?.id ?? null }
    }
    onVerschieben(karte, ziel)
  }
  useLayoutEffect(() => {
    const f = fokusNachZug.current
    // erst wenn die Karte die Liste verlassen hat (der Zug erscheint einen Augenblick nach dem Klick)
    if (!f || karten.some((k) => k.id === f.weg)) return
    fokusNachZug.current = null
    // hat inzwischen etwas anderes den Fokus, bleibt er dort
    if (document.activeElement && document.activeElement !== document.body) return
    // Ziel ist der Name der Karte (öffnet das Blatt), nie ihr grüner oder roter Knopf: eine gehaltene Eingabetaste würde
    // sonst Karte um Karte verschieben
    ;(nameAufKarte(kartenKnoten(f.erbe, bereich.current)) ?? kopf.current)?.focus()
  }, [karten])
  // „Weitere anzeigen“ verschwindet mit dem letzten Nachlegen – der Fokus fiele auf <body>. Er geht auf die erste Karte, die
  // neu dazukommt (wieder ihr Name). Gemerkt wird sie nur, wenn der Knopf den Fokus hat (Tastatur; in Chrome auch nach einem
  // Mausklick – dann ohne sichtbaren Ring: `focus()` aus dem Skript zeigt ihn nur nach einer Taste, :focus-visible).
  const fokusNachMehr = useRef<string | null>(null)
  const mehr = (knopf: HTMLButtonElement) => {
    if (knopf === document.activeElement) fokusNachMehr.current = karten[sichtbar.length]?.id ?? null
    setGrenze((g) => g + KARTEN_JE_SEITE)
  }
  useLayoutEffect(() => {
    const id = fokusNachMehr.current
    if (!id) return
    fokusNachMehr.current = null
    const knoten = kartenKnoten(id, bereich.current)
    // Ohne Sprung: Chrome rückt ein Fokusziel unter dem Rand sonst in die Mitte der Liste (rund 300 px). Die Karte kommt nur
    // so weit ins Bild wie nötig – sie steht dort, wo eben noch der Knopf war.
    nameAufKarte(knoten)?.focus({ preventScroll: true })
    knoten?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [grenze])
  return (
    // Ablageziel ist die ganze Spalte bis zum unteren Rand des Boards, nicht nur die graue Fläche – eine kurze Liste
    // wäre beim Ziehen sonst schwer zu treffen. Die graue Fläche selbst ist nur so hoch wie ihr Inhalt.
    <div
      ref={setNodeRef}
      data-liste={liste}
      className="h-full min-h-0 w-[min(300px,86vw)] shrink-0 snap-start md:w-[272px] xl:w-auto xl:min-w-0"
    >
      <section
        ref={bereich}
        aria-labelledby={titelId}
        className={cn(
          // relative: die unsichtbare Beschriftung (sr-only, absolut) bleibt so in der Liste – sonst ragt sie aus der quer
          // scrollenden Reihe heraus und macht auf dem Telefon die ganze Seite breiter
          // @container: die Karten messen ihre Breite an der Liste (100cqw = Innenbreite), siehe unten
          'bg-sidebar @container relative flex max-h-full min-h-0 flex-col rounded-md p-2',
          'ease-brand transition-[box-shadow] duration-[var(--t-1)]',
          isOver && 'ring-signal/50 ring-2',
        )}
      >
        <header className="flex h-10 shrink-0 items-center gap-2 px-1.5">
          {/* tabIndex -1: Ziel für den Fokus, wenn die letzte Karte die Liste verlassen hat */}
          <h2 ref={kopf} id={titelId} tabIndex={-1} className="text-h3 text-ink-bright truncate rounded-xs">
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
          // Innenabstand 2 px: der feine Rand der Karten (shadow-card) würde am Scrollbereich sonst abgeschnitten.
          // Rollbalken: Wo er Platz braucht (Windows, Mac mit Maus), nahm er den Karten 15 px – die zwei Knöpfe passten dann
          // nicht mehr nebeneinander, und lange Listen sahen anders aus als kurze. Deshalb reicht der Scrollbereich rechts bis
          // an den Listenrand (-mr-2), der schmale Balken liegt im Randstreifen und ist in jeder Liste eingeplant (stable).
          // Die Karten sind so breit wie die Liste innen (100cqw), höchstens bis 2 px vor den Balken. Der Randstreifen ist
          // 8 px breit, der schmale Balken in Chrome 11 px: die Karte gibt dann noch 5 px ab – dafür ist die Knopfreihe
          // bemessen (Karte.tsx).
          <ul className="-mr-2 -ml-0.5 grid min-h-0 [scrollbar-width:thin] [scrollbar-gutter:stable] grid-cols-1 content-start gap-2 overflow-y-auto overscroll-y-contain py-0.5 pl-0.5 [&>li]:w-[min(100cqw,100%_-_2px)]">
            {sichtbar.map((k) => (
              <Karte
                key={k.id}
                karte={k}
                member={k.owner_id ? members?.find((m) => m.id === k.owner_id) : null}
                hervorgehoben={k.id === hervorgehoben}
                onOeffnen={onOeffnen}
                onVerschieben={verschieben}
              />
            ))}
            {rest > 0 ? (
              <li>
                <Button variante="quiet" className="w-full" onClick={(e) => mehr(e.currentTarget)}>
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
