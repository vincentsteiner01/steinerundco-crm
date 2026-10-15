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
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={cn(
        'border-line grid grid-cols-2 border-t border-b md:grid-cols-[repeat(var(--n),minmax(0,1fr))]',
        className,
      )}
      style={{ ['--n' as string]: kacheln.length }}
    >
      {kacheln.map((k) => {
        const delta = kachelDelta(k)
        const vergleich = kachelVergleich(k, vorLabel)
        const ziel = kachelZiel(k)
        const sub = [vergleich, ziel].filter(Boolean).join(' · ')
        return (
          <div
            key={k.key}
            role="listitem"
            data-kachel={k.key}
            className="border-line relative grid content-start gap-1.5 border-r px-5 py-4 pb-3.5 first:pl-0 last:border-r-0 max-md:border-b max-md:px-3 max-md:even:border-r-0 max-md:[&:nth-child(odd)]:pl-0 md:[&:nth-last-child(-n+1)]:border-b-0"
          >
            <span className="label flex items-center gap-1.5">
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
            <span className="tnum text-ink-2 font-mono text-[12.5px] leading-snug" data-delta>
              {delta ?? '–'}
              {sub ? <span className="text-ink-3"> {sub}</span> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
