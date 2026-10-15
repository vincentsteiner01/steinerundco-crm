// BAUPLAN § 3.7 Baum.tsx – Kanal → Phase → Leitfaden. Phasenkopf 34 px (Mono-Ziffer + Label, darunter `beschreibung` small ink-3,
// § 1.5 Nr. 41), Einträge 34 px mit Nutzung rechts (v_template_performance), Chips „Standard für Schritt n“ und „inaktiv“.
import { useEffect, useRef } from 'react'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { fmtProzent, fmtZahl } from '@/lib/format'
import type { Channel, Template, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { baumGruppen, nutzung } from './helfer'
import { labelTeile } from './phasen'

export type Verwendung = { sequenzName: string; position: number }

export type BaumProps = {
  kanal: Channel
  vorlagen: readonly Template[]
  perf: ReadonlyMap<string, TemplatePerformance>
  verwendungen: ReadonlyMap<string, Verwendung[]>
  q: string
  /** nur diese Phase zeigen (`?phase=`) */
  phase?: TemplatePhase | null
  cursorId: string | null
  onCursor: (id: string) => void
  onOeffnen: (id: string) => void
}

export function Baum({ kanal, vorlagen, perf, verwendungen, q, phase, cursorId, onCursor, onOeffnen }: BaumProps) {
  const gruppen = baumGruppen(vorlagen, kanal, q, phase)
  const wurzel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!cursorId || !wurzel.current) return
    const el = wurzel.current.querySelector<HTMLElement>(`[data-id="${cursorId}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [cursorId])

  return (
    <div ref={wurzel} role="tree" aria-label="Leitfäden" className="grid content-start gap-3">
      {gruppen.length === 0 ? (
        <p className="text-small text-ink-3 px-2.5 py-3">Nichts gefunden für ‚{q.trim()}‘.</p>
      ) : null}
      {gruppen.map(({ def, eintraege }) => {
        const { ziffer, text } = labelTeile(def.label)
        return (
          <div key={def.key} role="group" aria-label={text} data-phase={def.key}>
            <div className="flex min-h-[34px] flex-col justify-center px-2.5 py-1">
              <span className="text-ui text-ink flex items-center gap-2 font-medium">
                {ziffer ? <span className="text-ink-3 tnum w-4 font-mono text-[12.5px]">{ziffer}</span> : null}
                <span>{text}</span>
                <span className="text-ink-3 tnum ml-auto font-mono text-[11.5px]">{eintraege.length || '–'}</span>
              </span>
              {def.beschreibung ? (
                <span className="text-small text-ink-3 truncate-1 block" title={def.beschreibung}>
                  {def.beschreibung}
                </span>
              ) : null}
            </div>
            {eintraege.map((t) => {
              const n = nutzung(perf.get(t.id))
              const verw = verwendungen.get(t.id) ?? []
              const aktiv = t.id === cursorId
              return (
                <div
                  key={t.id}
                  role="treeitem"
                  aria-selected={aktiv}
                  aria-level={2}
                  tabIndex={aktiv ? 0 : -1}
                  data-id={t.id}
                  data-cursor={aktiv || undefined}
                  onClick={() => onCursor(t.id)}
                  onDoubleClick={() => onOeffnen(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onOeffnen(t.id)
                    }
                  }}
                  className={cn(
                    'text-ui hover:bg-surface-hover flex min-h-[34px] cursor-default items-center gap-2 rounded-sm px-2.5 py-1 font-normal',
                    'ease-brand transition-[background] duration-[var(--t-1)]',
                    aktiv ? 'cursor-bar text-ink-bright' : t.active ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {verw.map((v) => (
                    <Chip
                      key={`${v.sequenzName}-${v.position}`}
                      ton="muted"
                      title={`${v.sequenzName} · Schritt ${v.position}`}
                    >
                      Standard für Schritt {v.position}
                    </Chip>
                  ))}
                  {!t.active ? <Chip ton="ended">inaktiv</Chip> : null}
                  <span className="text-ink-3 tnum font-mono text-[12px] whitespace-nowrap" aria-label="Nutzung">
                    {n ? `${fmtZahl(n.gesendet)} · ${n.quote === null ? '–' : fmtProzent(n.quote)}` : '–'}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
