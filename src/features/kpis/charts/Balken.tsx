// DESIGN-SYSTEM § 5.15 Tagesverlauf: Balken je Kalendertag, gap 3, Höhe 128, Balken ink 26 % (Hover 60 %), Wochenende deco,
// heute Lime, Zukunft leer, Wert Mono 11 px über dem Balken bei Hover/Peak/heute, Achse Mono 10,5 ink-3, keine Gitterlinien.
// Reines SVG ohne Chart-Bibliothek (BAUPLAN § 1.5 Nr. 10); Breiten in Prozent, damit die Balken mit der Spalte atmen.
import { cn } from '@/components/ui/cn'
import { fmtZahl } from '@/lib/format'
import { isodow, type Tag } from '@/lib/zeit'

export type BalkenTag = { tag: Tag; wert: number }
export type BalkenProps = {
  tage: readonly BalkenTag[]
  heute: Tag
  /** aria-label, z. B. „Balkendiagramm: Gespräche eröffnet pro Tag im Oktober 2026“ */
  label: string
  hoehe?: number
  className?: string
}

const WERT_H = 16
const ACHSE_H = 16
const LUECKE = 3

/** 31 Balken (oder die Tage des Zeitraums), `data-tag`/`data-wert`/`data-art` je Balken für Tests. */
export function Balken({ tage, heute, label, hoehe = 128, className }: BalkenProps) {
  const n = Math.max(tage.length, 1)
  const max = Math.max(0, ...tage.filter((t) => t.tag <= heute).map((t) => t.wert))
  const gesamt = WERT_H + hoehe + ACHSE_H
  const basis = WERT_H + hoehe
  const schritt = 100 / n
  return (
    <svg
      role="img"
      aria-label={label}
      width="100%"
      height={gesamt}
      className={cn('block overflow-visible', className)}
      data-balken
    >
      <title>{label}</title>
      {tage.map((t, i) => {
        const zukunft = t.tag > heute
        const istHeute = t.tag === heute
        const wochenende = isodow(t.tag) >= 6
        const anteil = max > 0 ? t.wert / max : 0
        const h = zukunft ? 0 : Math.max(istHeute ? 2 : t.wert > 0 ? 1 : 0, Math.round(anteil * hoehe))
        const peak = !zukunft && max > 0 && t.wert === max
        const art = zukunft ? 'zukunft' : istHeute ? 'heute' : wochenende ? 'wochenende' : 'tag'
        const x = `${(i * schritt).toFixed(3)}%`
        const breite = `calc(${schritt.toFixed(3)}% - ${LUECKE}px)`
        const mitte = `calc(${(i * schritt + schritt / 2).toFixed(3)}%)`
        const tagNr = t.tag.slice(8, 10)
        return (
          <g key={t.tag} className="group" data-tag={t.tag} data-wert={zukunft ? undefined : t.wert} data-art={art}>
            <rect x={x} y={0} width={breite} height={basis} className="fill-transparent" aria-hidden />
            {!zukunft ? (
              <rect
                x={x}
                y={basis - h}
                width={breite}
                height={h}
                rx={1}
                className={cn(
                  'ease-brand transition-opacity duration-[var(--t-1)]',
                  istHeute ? 'fill-signal' : wochenende ? 'fill-deco' : 'fill-signal opacity-40 group-hover:opacity-75',
                )}
              />
            ) : null}
            {!zukunft ? (
              <text
                x={mitte}
                y={basis - h - 4}
                textAnchor="middle"
                className={cn(
                  'tnum font-mono text-[11px] transition-opacity duration-[var(--t-1)]',
                  istHeute
                    ? 'fill-signal opacity-100'
                    : peak
                      ? 'fill-ink-3 opacity-100'
                      : 'fill-ink opacity-0 group-hover:opacity-100',
                )}
                data-wertlabel
              >
                {fmtZahl(t.wert)}
              </text>
            ) : null}
            <text
              x={mitte}
              y={gesamt - 2}
              textAnchor="middle"
              className={cn('tnum font-mono text-[10.5px]', istHeute ? 'fill-signal' : 'fill-ink-3')}
              aria-hidden
            >
              {tagNr}
            </text>
          </g>
        )
      })}
      <line x1="0" x2="100%" y1={basis} y2={basis} className="stroke-line-strong" strokeWidth={1} aria-hidden />
    </svg>
  )
}
