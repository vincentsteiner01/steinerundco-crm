// DESIGN-SYSTEM § 5.15 Funnel als Tabelle: Zeile = Stufe, Raster 168px 1fr 120px, padding 14 0, Haarlinie; Ziffer display-xl in
// Zeile 1–2, danach display; Nullwerte ink-3; Stufen-Nummer mono-sm ink-3; Konversion Mono 12,5 ink-2 + Haarlinien-Balken;
// Delta rechts Mono ink-2 + Vorperiode ink-3; Sub-Zeilen (Ausstehend, Erstgespräche vereinbart) 40 px ink-2 mit Fußnote.
// Klick auf die Ziffer → /leads gefiltert (§ 7.5).
import { Link } from 'react-router'
import { cn } from '@/components/ui/cn'
import { fmtAnteil, fmtDelta, fmtPp, fmtZahl } from '@/lib/format'
import { FunnelBalken } from './charts/FunnelBalken'
import type { FunnelZeile } from './kennzahlen'
import { leadsUrl, type LeadsKontext } from './leadsLink'
import { SheetBadge, ZaehlerHinweis, Ziffer, ZielPunkt } from './_Teile'

export type FunnelTabelleProps = {
  zeilen: readonly FunnelZeile[]
  vorLabel: string
  kontext: LeadsKontext
  className?: string
}

export function FunnelTabelle({ zeilen, vorLabel, kontext, className }: FunnelTabelleProps) {
  return (
    <ol className={cn('grid', className)} aria-label="Funnel">
      {zeilen.map((z) => {
        const url = leadsUrl(z.leads, kontext)
        const ton = z.wert === 0 ? 'ink-3' : z.sub ? 'ink-2' : 'bright'
        const ziffer = (
          <Ziffer groesse={z.gross ? 'xl' : 'md'} ton={ton} data-wert={z.wert}>
            {fmtZahl(z.wert)}
          </Ziffer>
        )
        const vor = [
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
            className="border-line grid grid-cols-[168px_1fr_120px] items-center gap-5 border-b py-3.5 first:pt-0 max-md:grid-cols-[110px_1fr] max-md:gap-3"
          >
            <div className="flex items-baseline gap-2">
              {url ? (
                <Link
                  to={url}
                  className="hover:decoration-line-strong underline decoration-transparent decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-[var(--t-1)]"
                  aria-label={`${z.label}: ${fmtZahl(z.wert)} – Leads öffnen`}
                >
                  {ziffer}
                </Link>
              ) : (
                ziffer
              )}
              {z.fussnote === 'zaehler' ? <ZaehlerHinweis /> : null}
            </div>
            <div className="grid min-w-0 gap-1.5">
              <span className="flex items-center gap-2 text-[15px] font-medium">
                <span className="mono-sm text-ink-3">{z.nr}</span>
                <span className={cn(z.sub && 'text-ink-2')}>{z.label}</span>
                {z.fussnote === 'sheet' ? <SheetBadge /> : null}
              </span>
              {z.quote !== undefined ? (
                <span className="tnum text-ink-2 flex items-center gap-2.5 font-mono text-[12.5px]" data-konversion>
                  <FunnelBalken anteil={z.quote} className="min-w-0 flex-1" />
                  <span>{z.quote === null ? '–' : fmtAnteil(z.quote)}</span>
                  {z.erreicht ? <ZielPunkt text={`Ziel ${fmtAnteil(z.ziel ?? 0)} erreicht`} /> : null}
                </span>
              ) : (
                <span className="text-small text-ink-3">{z.hinweis}</span>
              )}
            </div>
            <div className="tnum text-ink-3 text-right font-mono text-[12.5px] leading-normal max-md:hidden" data-delta>
              <b className="text-ink-2 block font-normal">
                {fmtDelta(z.delta)}
                {z.deltaPp !== null ? ` · ${fmtPp(z.deltaPp)}` : ''}
              </b>
              {/* Vorperiode und Ziel je eine Zeile: in 120 px bräche „· Ziel 28 %“ sonst mitten im Satz um */}
              <span className="block">{vor}</span>
              {ziel ? <span className="block">{ziel}</span> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
