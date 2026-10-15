// BAUPLAN § 3.7 Baum.tsx – Kanal → Phase → Leitfaden. Phasenkopf 34 px (Mono-Ziffer + Label, darunter `beschreibung` small ink-3,
// § 1.5 Nr. 41), Einträge 34 px; darunter Chip „Standard für Schritt n“ und die Nutzung im Klartext (v_template_performance).
import { useEffect, useRef } from 'react'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { fmtAnteil, fmtZahl } from '@/lib/format'
import type { Channel, Template, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { baumGruppen, nutzung, nutzungText, standardChip } from './helfer'
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
    <div ref={wurzel} role="tree" aria-label="Leitfäden" className="grid min-w-0 grid-cols-1 content-start gap-3">
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
                <span className="min-w-0 truncate">{text}</span>
                {/* Runde 3: die unbeschriftete Anzahl rechts im Phasenkopf („2“, „4“, „8“) wirkte verirrt – die Einträge stehen
                    ohnehin darunter; nur noch für Screenreader */}
                <span className="sr-only">
                  , {eintraege.length} {eintraege.length === 1 ? 'Leitfaden' : 'Leitfäden'}
                </span>
              </span>
              {def.beschreibung ? (
                <span className="text-small text-ink-3 truncate-1 block" title={def.beschreibung}>
                  {def.beschreibung}
                </span>
              ) : null}
            </div>
            {eintraege.map((t) => {
              const n = nutzung(perf.get(t.id))
              const chip = standardChip(verwendungen.get(t.id) ?? [])
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
                    'text-ui hover:bg-surface-hover grid min-h-[34px] min-w-0 cursor-default content-center gap-1 rounded-sm px-2.5 py-1 font-normal',
                    'ease-brand transition-[background] duration-[var(--t-1)]',
                    aktiv ? 'cursor-bar text-ink-bright' : t.active ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={t.name}>
                      {t.name}
                    </span>
                    {!t.active ? <Chip ton="ended">inaktiv</Chip> : null}
                  </span>
                  {/* Zweite Zeile: Standard-Chip und Nutzung mit Klartext („148 gesendet · 5 % Antwort“). Runde 3: unbeschriftete
                      Werte rechts („148 · 5 %“) wirkten wie verirrte Zeichen; ohne Nutzung steht nichts da. */}
                  {chip || (n && n.gesendet > 0) ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                      {chip ? (
                        <Chip ton="muted" title={chip.titel} className="max-w-full overflow-hidden text-ellipsis">
                          {chip.text}
                        </Chip>
                      ) : null}
                      {n && n.gesendet > 0 ? (
                        <span className="text-small text-ink-3 whitespace-nowrap" title={nutzungText(n)} data-nutzung>
                          <span className="tnum font-mono">{fmtZahl(n.gesendet)}</span> gesendet ·{' '}
                          {n.quote === null ? (
                            'Antwortquote –'
                          ) : (
                            <>
                              <span className="tnum font-mono">{fmtAnteil(n.quote)}</span> Antwort
                            </>
                          )}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
