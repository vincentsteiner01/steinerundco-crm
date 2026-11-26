// Wochentabelle: eine Zeile je Kalenderwoche, Zahlen rechtsbündig, kommende Wochen „—“, die laufende Woche mit Strich in der
// Signalfarbe links, Summenzeile „Gesamt“ mit kräftiger Oberkante. Wochen, die den Zeitraum nur anschneiden, zählen nur die Tage
// im Zeitraum (Oktober 2026 → KW 40 65 · KW 41 0 · KW 42 17 · Gesamt 82) – die Spalte „Zeitraum“ nennt genau diese Tage
// („01.10.–04.10.“, ein einzelner Tag „01.11.“), nicht die ganze Woche. Gerechnet aus Tageswerten – die alten Monatszähler
// zählen hier nie. Unter 900 px (Telefon, schmales Fenster) steht der Zeitraum unter der Woche und die erste Spalte bleibt
// beim Wischen stehen; die Tabelle scrollt in sich, nie die Seite.
import { cn } from '@/components/ui/cn'
import { fmtZahl } from '@/lib/format'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Tag } from '@/lib/zeit'
import { summeWochen, wochen, type TagesMetrik, type TagesMetrikDef, type TagesWert } from './kennzahlen'
import { BlockKopf } from './_Teile'

export type WochentabelleProps = {
  tage: readonly TagesWert[]
  heute: Tag
  metriken: readonly TagesMetrikDef[]
  /** Hervorgehobene Spalte (Kennzahl des Tagesverlaufs) */
  aktiv: TagesMetrik
  gesamtLabel?: string
  /** Spalten ohne einen einzigen Wert im Zeitraum ausblenden (die aktive bleibt) – sieben Spalten passen selten nebeneinander. */
  leereAusblenden?: boolean
}

const kurz = (tag: Tag): string => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`
/** `12.10.–18.10.` · ein einzelner Tag `01.11.` */
const spanne = (von: Tag, bis: Tag): string => (von === bis ? kurz(von) : `${kurz(von)}–${kurz(bis)}`)

const KOPF = 'text-small text-ink-3 border-line-strong border-b pb-2 font-medium'
/** Darunter passen acht Spalten nicht mehr nebeneinander (gemessen: 719 px Tabelle auf 696 px Platz bei 800 px Fensterbreite). */
const SCHMAL = '(max-width: 899px)'

export function Wochentabelle({
  tage,
  heute,
  metriken: alleMetriken,
  aktiv,
  gesamtLabel = 'Gesamt',
  leereAusblenden = false,
}: WochentabelleProps) {
  const mobil = useMediaQuery(SCHMAL)
  const zeilen = wochen(tage, heute)
  const summe = summeWochen(zeilen)
  const metriken = leereAusblenden ? alleMetriken.filter((m) => m.key === aktiv || summe[m.key] > 0) : alleMetriken
  const erster = tage[0]?.tag
  const letzter = tage[tage.length - 1]?.tag
  // Die Tage der Woche, die wirklich gezählt sind: am Rand des Zeitraums weniger als Montag–Sonntag
  const gezaehlt = (von: Tag, bis: Tag): string =>
    spanne(erster && erster > von ? erster : von, letzter && letzter < bis ? letzter : bis)
  const zelle = (w: number, leer: boolean, hervor: boolean) => (
    <span className={cn(leer ? 'text-ink-3' : hervor ? 'text-ink' : 'text-ink-2')}>{leer ? '—' : fmtZahl(w)}</span>
  )
  // Schmal: die erste Spalte bleibt stehen, der Rest wird sichtbar angeschnitten – so erschließt sich das Wischen
  const fest = mobil ? 'bg-canvas sticky left-0 z-10' : null
  // Abstand vor jeder Zahlenspalte – schmal etwas enger, dann passen bei 768 px noch alle sechs
  const vor = mobil ? 'pl-3' : 'pl-4'
  return (
    <section aria-label="Wochen" className="min-w-0">
      <BlockKopf titel="Wochen" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap" aria-label="Wochentabelle">
          <thead>
            <tr>
              <th scope="col" className={cn(KOPF, 'pr-4 text-left', fest)}>
                Woche
              </th>
              {mobil ? null : (
                <th scope="col" className={cn(KOPF, 'pr-2 text-left')}>
                  Zeitraum
                </th>
              )}
              {metriken.map((m) => (
                <th key={m.key} scope="col" className={cn(KOPF, vor, 'text-right')}>
                  {m.kurz}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const zukunft = z.von > heute
              const zeitraum = gezaehlt(z.von, z.bis)
              return (
                <tr
                  key={z.von}
                  data-kw={z.kw}
                  data-aktuell={z.aktuell || undefined}
                  className={cn('border-line h-9 border-b text-[13.5px]', z.aktuell ? 'text-ink' : 'text-ink-2')}
                >
                  <td
                    className={cn(
                      'pr-4 whitespace-nowrap',
                      fest,
                      mobil && 'py-1.5',
                      z.aktuell &&
                        'before:bg-signal pl-2.5 before:absolute before:inset-y-0 before:left-0 before:w-0.5',
                      z.aktuell && !mobil && 'relative',
                    )}
                  >
                    KW {z.kw}
                    {mobil ? (
                      <span className="tnum text-small text-ink-3 block font-mono" data-zeitraum>
                        {zeitraum}
                      </span>
                    ) : null}
                  </td>
                  {mobil ? null : (
                    <td className="tnum text-small text-ink-3 pr-2 font-mono whitespace-nowrap" data-zeitraum>
                      {zeitraum}
                    </td>
                  )}
                  {metriken.map((m) => (
                    <td key={m.key} className={cn('tnum text-right font-mono', vor)} data-metrik={m.key}>
                      {zelle(z.werte[m.key], zukunft, m.key === aktiv)}
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr className="border-line-strong text-ink h-9 border-t text-[13.5px] font-medium" data-gesamt>
              <td colSpan={mobil ? 1 : 2} className={cn('pr-4', fest)}>
                {gesamtLabel}
              </td>
              {metriken.map((m) => (
                <td key={m.key} className={cn('tnum text-right font-mono', vor)} data-metrik={m.key}>
                  {fmtZahl(summe[m.key])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
