// BAUPLAN § 3.3 / DESIGN-SYSTEM § 5.12 – Kanban-Spalte 272 px, Kopf 36 px: label + Zähler Mono + Konversion mono-sm ink-3 + Ø Tage;
// eingeklappt 44 px breit mit vertikalem Label (Angefragt · Wiedervorlage · Beendet, localStorage). Drop-Ziel: 2-px-Lime-Linie.
// Leer: gestrichelte Fläche „Keine Leads“ (ux § 4.1).
import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { fmtProzent } from '@/lib/format'
import type { Phase } from '@/lib/stufen'
import { LEER } from '@/texte/de'

export type SpaltenKopf = {
  zaehler: number
  /** Konversion zur Vorstufe aus dem Bestand (0…1) oder null (erste Spalte / Vorstufe leer) */
  konversion: number | null
  /** Ø Tage in Phase aus v_pipeline_counts */
  tage: number | null
}

export function Spalte({
  phase,
  kopf,
  eingeklappt,
  onToggle,
  pflicht,
  children,
  leer,
}: {
  phase: Phase
  kopf: SpaltenKopf
  eingeklappt: boolean
  onToggle: () => void
  /** Drop verlangt Pflichtangabe (Kalender/Grund-Icon beim Hover) */
  pflicht: boolean
  children: ReactNode
  leer: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key })
  if (eingeklappt) {
    return (
      <div
        ref={setNodeRef}
        data-spalte={phase.key}
        data-eingeklappt
        className={cn(
          'border-line bg-surface flex w-11 shrink-0 snap-start flex-col items-center rounded-md border pt-2',
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
      className={cn('flex w-[272px] shrink-0 snap-start flex-col', isOver && 'border-signal rounded-md border-t-2')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded
        className="hover:text-ink flex h-9 items-center gap-2 text-left"
        title={pflicht ? 'Drop verlangt eine Angabe (Datum oder Grund)' : undefined}
      >
        <span className="label">{phase.label}</span>
        <span className="text-ink tnum font-mono text-[13px]">{kopf.zaehler}</span>
        {kopf.konversion !== null ? (
          <span className="mono-sm text-ink-3" title="Konversion zur Vorstufe (Bestand)">
            {fmtProzent(kopf.konversion)}
          </span>
        ) : null}
        {kopf.tage !== null ? (
          <span className="mono-sm text-ink-3 ml-auto" title="Ø Tage in Phase">
            Ø {Math.round(kopf.tage)} T
          </span>
        ) : null}
        {pflicht ? (
          <span className="text-ink-3 text-[11px]" aria-hidden>
            {phase.key === 'beendet' ? '☰' : '▦'}
          </span>
        ) : null}
      </button>
      <div className="min-h-24 flex-1">
        {leer ? (
          <div className="border-line text-ink-3 rounded-md border border-dashed px-3 py-6 text-center text-[12.5px]">
            {LEER.pipelineSpalte.titel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
