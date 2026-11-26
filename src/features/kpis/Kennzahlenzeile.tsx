// Kennzahlenzeile: eine Haarlinien-Zeile mit zwei bis sechs Spalten – Beschriftung, große Zahl (+ Quote), darunter Veränderung und
// Vorperiode („−38 vs. Okt. 160“, Anzahl gegen Anzahl). Trenner sind senkrechte Haarlinien; keine Boxen, keine Icons. Am Telefon
// zweispaltig. Kleinste Schrift 13 px.
import { cn } from '@/components/ui/cn'
import { fmtAnteil } from '@/lib/format'
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
  // (-mr-px/-mb-px + overflow-hidden – deshalb kann die Zeile die Seite auch am Telefon nie in die Breite ziehen). Zwei Spalten
  // am Telefon, drei bis 1280 px, darüber alle in einer Zeile – sechs Spalten in 740 px (1024er Fenster) liefen sonst ineinander.
  return (
    <div className={cn('border-line min-w-0 overflow-hidden border-t border-b', className)}>
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
              <span className="text-small text-ink-3 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 self-start font-medium">
                {k.erreicht ? <ZielPunkt text={`${ziel ?? 'Ziel'} erreicht`} /> : null}
                <span>{k.label}</span>
                {k.fussnote === 'sheet' ? <SheetBadge /> : null}
              </span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <Ziffer ton={k.wert === null || k.wert === 0 ? 'ink-3' : 'bright'} data-wert>
                  {formatWert(k.art, k.wert)}
                </Ziffer>
                {k.quote !== null ? (
                  <span className="tnum text-ink-2 font-mono text-[14px]" data-quote>
                    {fmtAnteil(k.quote)}
                  </span>
                ) : null}
                {k.fussnote === 'zaehler' ? <ZaehlerHinweis /> : null}
              </span>
              {/* Veränderung und Vergleich brechen nur zwischen den beiden Angaben um; das Ziel steht in einer eigenen Zeile */}
              <span className="tnum text-small text-ink-2 min-w-0 font-mono leading-snug" data-delta>
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
