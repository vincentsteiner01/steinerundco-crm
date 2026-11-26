// Funnel als Tabelle: Zeile = Stufe, Raster 168px 1fr 120px, Haarlinie darunter. Ziffer sehr groß in den ersten beiden Zeilen,
// danach groß; Nullwerte blass; Stufen-Nummer klein davor; Quote zur Vorstufe mit Haarlinien-Balken; rechts Veränderung der
// Anzahl und darunter die Vorperiode mit Anzahl und Anteil („−14“ über „Okt. 157 · 34 %“; am Telefon ausgeblendet) – die
// Anteile beider Zeiträume stehen so nebeneinander, ohne das Kürzel „pp“. Ohne verlässlichen Vergleich steht dort „–“.
// Die Ziffernspalte wächst mit der breitesten Ziffer (vierstellig am Telefon lief sonst in die Stufen-Nummer); alle Zeilen
// teilen sich ihre Spalten (subgrid). Die Stufen-Nummer hat eine eigene Spur – die Beschriftung bricht daneben um, nie darunter.
// Die Zeilen sind reine Anzeige – nichts ist klickbar. Kleinste Schrift 13 px.
import { cn } from '@/components/ui/cn'
import { fmtAnteil, fmtDelta, fmtZahl } from '@/lib/format'
import { FunnelBalken } from './charts/FunnelBalken'
import type { FunnelZeile } from './kennzahlen'
import { SheetBadge, ZaehlerHinweis, Ziffer, ZielPunkt } from './_Teile'

export type FunnelTabelleProps = {
  zeilen: readonly FunnelZeile[]
  /** Kurzlabel der Vorperiode („Sept.“, „KW 41“) */
  vorLabel: string
  className?: string
}

export function FunnelTabelle({ zeilen, vorLabel, className }: FunnelTabelleProps) {
  return (
    <ol
      className={cn(
        'grid min-w-0 grid-cols-[minmax(168px,max-content)_1fr_120px] gap-x-5 max-md:grid-cols-[minmax(110px,max-content)_1fr] max-md:gap-x-3',
        className,
      )}
      aria-label="Funnel"
    >
      {zeilen.map((z) => {
        const ton = z.wert === 0 ? 'ink-3' : z.sub ? 'ink-2' : 'bright'
        const vor =
          z.vorWert === null
            ? null
            : [
                `${vorLabel} ${fmtZahl(z.vorWert)}`,
                z.vorQuote !== undefined && z.vorQuote !== null ? fmtAnteil(z.vorQuote) : null,
              ]
                .filter(Boolean)
                .join(' · ')
        const ziel = z.ziel !== null ? `Ziel ${fmtAnteil(z.ziel)}` : null
        return (
          <li
            key={z.metric}
            data-zeile={z.metric}
            data-sub={z.sub || undefined}
            className="border-line col-span-full grid grid-cols-subgrid items-center border-b py-3.5 first:pt-0"
          >
            <div className="flex items-baseline gap-2">
              <Ziffer groesse={z.gross ? 'xl' : 'md'} ton={ton} data-wert={z.wert}>
                {fmtZahl(z.wert)}
              </Ziffer>
              {z.fussnote === 'zaehler' ? <ZaehlerHinweis /> : null}
            </div>
            <div className="grid min-w-0 gap-1.5">
              <span className="flex items-baseline gap-x-2 text-[15px] font-medium">
                <span className="tnum text-small text-ink-3 shrink-0 font-mono">{z.nr}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn(z.sub && 'text-ink-2')}>{z.label}</span>
                  {z.fussnote === 'sheet' ? <SheetBadge /> : null}
                </span>
              </span>
              {z.quote !== undefined ? (
                <span className="tnum text-small text-ink-2 flex items-center gap-2.5 font-mono" data-konversion>
                  <FunnelBalken anteil={z.quote} className="min-w-0 flex-1" />
                  <span>{z.quote === null ? '–' : fmtAnteil(z.quote)}</span>
                  {z.erreicht ? <ZielPunkt text={`Ziel ${fmtAnteil(z.ziel ?? 0)} erreicht`} /> : null}
                </span>
              ) : z.hinweis ? (
                <span className="text-small text-ink-3">{z.hinweis}</span>
              ) : null}
            </div>
            <div className="tnum text-small text-ink-3 text-right font-mono leading-normal max-md:hidden" data-delta>
              <b className="text-ink-2 block font-normal">{z.delta === null ? '–' : fmtDelta(z.delta)}</b>
              {/* Vorperiode und Ziel je eine Zeile: in 120 px bräche „· Ziel 28 %“ sonst mitten im Satz um */}
              {vor ? <span className="block whitespace-nowrap">{vor}</span> : null}
              {ziel ? <span className="block">{ziel}</span> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
