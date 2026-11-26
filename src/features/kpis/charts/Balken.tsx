// Tagesverlauf: ein Balken je Kalendertag, Lücke 3 px, Höhe 128. Werktage in der Signalfarbe (Blau) mit 40 % Deckkraft
// (Hover 75 %), Wochenende blass (deco), heute volles Blau, Zukunft leer. Der Wert steht über dem Balken bei Hover, am
// Spitzentag und heute – bei wenigen Balken (Woche, 7 Tage, Telefon) über jedem Balken mit Wert, denn dort ist Platz und am
// Telefon gibt es keinen Hover. Bei vielen Balken (Monat, 30 Tage) ist ein zweistelliger Wert breiter als der Balkenschritt:
// dauerhaft beschriftet sind dann nur heute und EIN Spitzentag, nie zwei Nachbarn. Darunter die Tagesnummer, bei vielen
// Balken nur an jedem zweiten Tag (ein Monat in der schmalen Spalte lief sonst zu einer Ziffernkette zusammen); heute ist
// immer beschriftet. Keine Gitterlinien.
// Reines SVG ohne Chart-Bibliothek; Breiten in Prozent, damit die Balken mit der Spalte atmen.
import { cn } from '@/components/ui/cn'
import { fmtZahl } from '@/lib/format'
import { isodow, type Tag } from '@/lib/zeit'

export type BalkenTag = { tag: Tag; wert: number }
export type BalkenProps = {
  tage: readonly BalkenTag[]
  heute: Tag
  /** aria-label, z. B. „Balkendiagramm: Angeschrieben pro Tag, Oktober 2026“ */
  label: string
  hoehe?: number
  className?: string
}

const WERT_H = 16
const ACHSE_H = 16
const LUECKE = 3
/** Bis zu so vielen Balken steht jeder Wert dauerhaft da. */
const ALLE_WERTE_BIS = 10
/** Ab mehr Balken trägt nur jeder zweite Tag seine Nummer – und nur ein Spitzentag dauerhaft seinen Wert. */
const JEDE_NUMMER_BIS = 16

/** 31 Balken (oder die Tage des Zeitraums), `data-tag`/`data-wert`/`data-art` je Balken für Tests. */
export function Balken({ tage, heute, label, hoehe = 128, className }: BalkenProps) {
  const n = Math.max(tage.length, 1)
  const max = Math.max(0, ...tage.filter((t) => t.tag <= heute).map((t) => t.wert))
  const gesamt = WERT_H + hoehe + ACHSE_H
  const basis = WERT_H + hoehe
  const schritt = 100 / n
  const alleWerte = tage.length <= ALLE_WERTE_BIS
  // Jeder zweite Tag, von heute aus gezählt (heute bleibt beschriftet, kein Nachbar stößt an); ohne heute vom ersten Tag aus
  const jedeNummer = tage.length <= JEDE_NUMMER_BIS
  const heuteIndex = tage.findIndex((t) => t.tag === heute)
  const anker = Math.max(0, heuteIndex)
  const istSpitze = (t: BalkenTag) => t.tag <= heute && max > 0 && t.wert === max
  // Viele Balken: der jüngste Spitzentag, der nicht direkt neben heute steht (heute hat Vorrang). Jeder Tag mit dem
  // Spitzenwert – bei „werktags immer 20“ fast alle – ergab Ketten wie „2020202020“.
  const spitze = jedeNummer
    ? -1
    : tage.findLastIndex((t, i) => istSpitze(t) && (heuteIndex < 0 || Math.abs(i - heuteIndex) !== 1))
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
        const peak = jedeNummer ? istSpitze(t) : i === spitze
        const wertImmer = istHeute || peak || (alleWerte && t.wert > 0)
        const mitNummer = jedeNummer || (i - anker) % 2 === 0
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
                  'tnum font-mono text-[12px] transition-opacity duration-[var(--t-1)]',
                  istHeute ? 'fill-signal' : wertImmer ? 'fill-ink-3' : 'fill-ink',
                  wertImmer ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                data-wertlabel
              >
                {fmtZahl(t.wert)}
              </text>
            ) : null}
            {mitNummer ? (
              <text
                x={mitte}
                y={gesamt - 2}
                textAnchor="middle"
                className={cn('tnum font-mono text-[12px]', istHeute ? 'fill-signal' : 'fill-ink-3')}
                aria-hidden
                data-tagnummer
              >
                {tagNr}
              </text>
            ) : null}
          </g>
        )
      })}
      <line x1="0" x2="100%" y1={basis} y2={basis} className="stroke-line-strong" strokeWidth={1} aria-hidden />
    </svg>
  )
}
