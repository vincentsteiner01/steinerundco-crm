// BAUPLAN § 3.3 / DESIGN-SYSTEM § 5.12 – Kanban-Spalte 272 px, Kopf 36 px: label + Zähler Mono + Konversion mono-sm ink-3 + Ø Tage;
// eingeklappt 44 px breit mit vertikalem Label (Angefragt · Wiedervorlage · Beendet, localStorage). Drop-Ziel: 2-px-Lime-Linie.
// Leer: gestrichelte Fläche „Keine Leads“ (ux § 4.1).
// Runde 2 (echte Daten, 184 Karten in „Eröffnet“): Kopf steht fest, die Kartenliste scrollt in der Spalte (`data-karten`), das Board
// hat die Fensterhöhe (useBoardHoehe) – so bleiben Köpfe und die horizontale Scrollleiste immer sichtbar.
// Runde 3: lange Spalten (> VIRTUELL_AB Karten) rendern nur die sichtbaren Karten (@tanstack/react-virtual, Höhe gemessen) –
// 184 Karten mit je einem dnd-kit-Draggable machten das Board träge. Der Tastatur-Cursor (J/K) scrollt per Index in Sicht.
import { useDroppable } from '@dnd-kit/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type ReactNode } from 'react'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { PHASE_FARBE } from '@/components/ui/phaseFarbe'
import type { Phase } from '@/lib/stufen'
import { LEER } from '@/texte/de'
import { KARTE_SCHAETZUNG, konversionText, VIRTUELL_AB } from './logik'

export type SpaltenKopf = {
  zaehler: number
  /** Konversion zur Vorstufe aus dem Bestand (0…1, kann > 1 sein) oder null (erste Spalte / Vorstufe leer) */
  konversion: number | null
  /** Zähler der Vorstufe (für den title „184 von 2“) */
  vorstufe?: number
  /** Ø Tage in Phase aus v_pipeline_counts */
  tage: number | null
}

export function Spalte({
  phase,
  kopf,
  eingeklappt,
  onToggle,
  pflicht,
  anzahl,
  karte,
  schluessel,
  cursorIndex = -1,
}: {
  phase: Phase
  kopf: SpaltenKopf
  eingeklappt: boolean
  onToggle: () => void
  /** Drop verlangt Pflichtangabe (Kalender/Grund-Icon beim Hover) */
  pflicht: boolean
  /** Anzahl Karten in der Spalte */
  anzahl: number
  /** Karte an Position i */
  karte: (i: number) => ReactNode
  /** Stabiler Schlüssel der Karte an Position i (Lead-ID) */
  schluessel: (i: number) => string
  /** Position der Cursor-Karte in dieser Spalte (−1 = keine) – wird in Sicht gescrollt */
  cursorIndex?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key })
  if (eingeklappt) {
    return (
      <div
        ref={setNodeRef}
        data-spalte={phase.key}
        data-eingeklappt
        className={cn(
          'bg-sidebar flex min-h-0 w-11 shrink-0 snap-start flex-col items-center rounded-md border border-transparent pt-2',
          isOver && 'border-signal',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`${phase.label} ausklappen`}
          className="label hover:text-ink flex flex-col items-center gap-2 [writing-mode:vertical-rl]"
        >
          <span className="tnum font-mono text-[12px] tracking-normal normal-case">{kopf.zaehler}</span>
          {phase.label}
        </button>
      </div>
    )
  }
  return (
    <div
      ref={setNodeRef}
      data-spalte={phase.key}
      className={cn(
        // Notion-Kanban (helles Design, 20.10.2026): getönte Spaltenfläche, farbiges Phasen-Etikett im Kopf, weiße Karten
        'bg-sidebar flex min-h-0 w-[272px] shrink-0 snap-start flex-col rounded-md px-1.5 pb-1.5',
        isOver && 'ring-signal/50 ring-2',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded
        className="hover:text-ink flex h-10 min-w-0 shrink-0 items-center gap-2 px-1 text-left whitespace-nowrap"
        title={pflicht ? 'Drop verlangt eine Angabe (Datum oder Grund)' : undefined}
      >
        <Chip ton={PHASE_FARBE[phase.key]} className="min-w-0" title={phase.label}>
          {phase.label}
        </Chip>
        <span className="text-ink-3 tnum shrink-0 font-mono text-[13px]">{kopf.zaehler}</span>
        {kopf.konversion !== null ? (
          <span
            className="mono-sm text-ink-3 shrink-0"
            title={`Konversion zur Vorstufe (Bestand)${kopf.vorstufe !== undefined ? ` · ${kopf.zaehler} von ${kopf.vorstufe}` : ''}`}
          >
            {konversionText(kopf.konversion)}
          </span>
        ) : null}
        {kopf.tage !== null ? (
          <span className="mono-sm text-ink-3 ml-auto shrink-0" title="Ø Tage in Phase">
            Ø {Math.round(kopf.tage)} T
          </span>
        ) : null}
        {pflicht ? (
          <span className="text-ink-3 shrink-0 text-[11px]" aria-hidden>
            {phase.key === 'beendet' ? '☰' : '▦'}
          </span>
        ) : null}
      </button>
      {anzahl === 0 ? (
        <div className="min-h-0 flex-1" data-karten>
          <div className="border-line-strong text-ink-3 rounded-md border border-dashed px-3 py-6 text-center text-[12.5px]">
            {LEER.pipelineSpalte.titel}
          </div>
        </div>
      ) : (
        <KartenListe anzahl={anzahl} karte={karte} schluessel={schluessel} cursorIndex={cursorIndex} />
      )}
    </div>
  )
}

function KartenListe({
  anzahl,
  karte,
  schluessel,
  cursorIndex,
}: {
  anzahl: number
  karte: (i: number) => ReactNode
  schluessel: (i: number) => string
  cursorIndex: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const virtuell = anzahl > VIRTUELL_AB
  // React Compiler memoisiert diese Komponente bewusst nicht (useVirtualizer liefert pro Render neue Funktionen) – gewollt
  // oxlint-disable-next-line react/incompatible-library
  const v = useVirtualizer({
    count: virtuell ? anzahl : 0,
    getScrollElement: () => ref.current,
    estimateSize: () => KARTE_SCHAETZUNG,
    overscan: 6,
    getItemKey: schluessel,
  })
  useEffect(() => {
    if (virtuell && cursorIndex >= 0 && cursorIndex < anzahl) v.scrollToIndex(cursorIndex, { align: 'auto' })
  }, [virtuell, cursorIndex, anzahl, v])

  return (
    <div
      ref={ref}
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      data-karten
      data-virtuell={virtuell || undefined}
    >
      {virtuell ? (
        <div className="relative w-full" style={{ height: v.getTotalSize() }}>
          {v.getVirtualItems().map((it) => (
            <div
              key={it.key}
              data-index={it.index}
              ref={v.measureElement}
              // flow-root: der mb-2 der Karte zählt zur gemessenen Höhe
              className="absolute top-0 left-0 flow-root w-full"
              style={{ transform: `translateY(${it.start}px)` }}
            >
              {karte(it.index)}
            </div>
          ))}
        </div>
      ) : (
        Array.from({ length: anzahl }, (_, i) => karte(i))
      )}
    </div>
  )
}
