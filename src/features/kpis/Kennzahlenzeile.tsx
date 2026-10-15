// DESIGN-SYSTEM § 5.15 Kennzahlenzeile: eine Haarlinien-Zeile, 4–6 Spalten, Zahl display 40 + label + Delta Mono ink-2 +
// Lime-Punkt bei erreichtem Ziel; Trenner vertikale Haarlinien; keine Boxen, keine Icons. Mobil zweispaltig.
import { cn } from '@/components/ui/cn'
import { fmtProzent } from '@/lib/format'
import { formatWert, kachelDelta, kachelVergleich, kachelZiel, type Kachel } from './kennzahlen'
import { SheetBadge, ZaehlerHinweis, Ziffer, ZielPunkt } from './_Teile'

export type KennzahlenzeileProps = {
  kacheln: readonly Kachel[]
  /** Kurzlabel der Vorperiode („Sept.“, „KW 41“) */
  vorLabel: string
  ariaLabel: string
  className?: string
}

export function Kennzahlenzeile({ kacheln, vorLabel, ariaLabel, className }: KennzahlenzeileProps) {
  // Haarlinien ohne Kästen: jede Spalte trägt rechts + unten eine Linie; der Rahmen schneidet die der letzten Spalte/Zeile ab
  // (-mr-px/-mb-px + overflow-hidden). Zwei Spalten mobil, drei bis 1280 px, darüber alle in einer Zeile – sechs Spalten in
  // 740 px (1024er Fenster) liefen sonst ineinander.
  return (
    <div className={cn('border-line overflow-hidden border-t border-b', className)}>
      <div
        role="list"
        aria-label={ariaLabel}
        className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
        style={{ ['--n' as string]: kacheln.length }}
      >
        {kacheln.map((k) => {
          const delta = kachelDelta(k)
          const vergleich = kachelVergleich(k, vorLabel)
          const ziel = kachelZiel(k)
          return (
            <div
              key={k.key}
              role="listitem"
              data-kachel={k.key}
              className="border-line relative row-span-3 grid min-w-0 grid-cols-1 grid-rows-subgrid gap-y-1.5 border-r border-b px-5 py-4 pb-3.5 max-md:px-3 xl:first:pl-0 max-md:[&:nth-child(2n+1)]:pl-0 md:max-xl:[&:nth-child(3n+1)]:pl-0"
            >
              <span className="label flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 self-start">
                {k.erreicht ? <ZielPunkt text={`${ziel ?? 'Ziel'} erreicht`} /> : null}
                <span>{k.label}</span>
                {k.fussnote === 'sheet' ? <SheetBadge /> : null}
              </span>
              <span className="flex items-baseline gap-2">
                <Ziffer ton={k.wert === null || k.wert === 0 ? 'ink-3' : 'bright'} data-wert>
                  {formatWert(k.art, k.wert)}
                </Ziffer>
                {k.quote !== null ? (
                  <span className="tnum text-ink-2 font-mono text-[14px]" data-quote>
                    {fmtProzent(k.quote)}
                  </span>
                ) : null}
                {k.fussnote === 'zaehler' ? <ZaehlerHinweis /> : null}
              </span>
              {/* Delta + Vergleich in Zeile 1, Ziel in eigener Zeile – sonst bricht „· Ziel ≥ 28 %“ mitten im Satz um */}
              <span className="tnum text-ink-2 font-mono text-[12.5px] leading-snug" data-delta>
                <span className="whitespace-nowrap">{delta ?? '–'}</span>
                {vergleich ? (
                  <>
                    {' '}
                    <span className="text-ink-3 whitespace-nowrap">{vergleich}</span>
                  </>
                ) : null}
                {ziel ? <span className="text-ink-3 block">{ziel}</span> : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
