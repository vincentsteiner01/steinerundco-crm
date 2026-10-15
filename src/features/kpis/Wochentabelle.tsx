// DESIGN-SYSTEM § 5.15 Wochentabelle: Kopf label, Zeilen 36 px, Zahlen rechts Mono ink, leere Wochen „—“ ink-3, aktuelle Woche
// Lime-Balken links, Summenzeile „Gesamt“ Unterkante line-strong + 500. Wochen, die den Zeitraum nur anschneiden, zählen nur
// die Tage im Zeitraum (BAUPLAN § 1.5 Nr. 30: Okt 2026 → KW 40 65 · KW 41 0 · KW 42 17 · KW 43 0 · KW 44 0 · Gesamt 82).
import { cn } from '@/components/ui/cn'
import { fmtZahl, fmtZeitraum } from '@/lib/format'
import type { Tag } from '@/lib/zeit'
import { summeWochen, wochen, type TagesMetrik, type TagesMetrikDef, type TagesWert } from './kennzahlen'
import { BlockKopf } from './_Teile'

export type WochentabelleProps = {
  tage: readonly TagesWert[]
  heute: Tag
  metriken: readonly TagesMetrikDef[]
  /** Hervorgehobene Spalte (Metrik des Tagesverlaufs) */
  aktiv: TagesMetrik
  gesamtLabel?: string
}

export function Wochentabelle({ tage, heute, metriken, aktiv, gesamtLabel = 'Gesamt' }: WochentabelleProps) {
  const zeilen = wochen(tage, heute)
  const summe = summeWochen(zeilen)
  const zelle = (w: number, leer: boolean, hervor: boolean) => (
    <span className={cn(leer ? 'text-ink-3' : hervor ? 'text-ink' : 'text-ink-2')}>{leer ? '—' : fmtZahl(w)}</span>
  )
  return (
    <section aria-label="Wochen">
      <BlockKopf titel="Wochen" hinweis="aus Tageswerten gerechnet" />
      <table className="w-full border-collapse" aria-label="Wochentabelle">
        <thead>
          <tr>
            <th scope="col" className="label border-line-strong border-b pb-2 text-left">
              Woche
            </th>
            <th scope="col" className="label border-line-strong border-b pb-2 text-left">
              Zeitraum
            </th>
            {metriken.map((m) => (
              <th key={m.key} scope="col" className="label border-line-strong border-b pb-2 text-right">
                {m.kurz}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => {
            const zukunft = z.von > heute
            return (
              <tr
                key={z.von}
                data-kw={z.kw}
                data-aktuell={z.aktuell || undefined}
                className={cn('border-line h-9 border-b text-[13.5px]', z.aktuell ? 'text-ink' : 'text-ink-2')}
              >
                <td
                  className={cn(
                    'whitespace-nowrap',
                    z.aktuell &&
                      'before:bg-signal relative pl-2.5 before:absolute before:inset-y-0 before:left-0 before:w-0.5',
                  )}
                >
                  KW {z.kw}
                </td>
                {/* Konflikt Mock „01.–05.10.“ ↔ BAUPLAN § 7.4 Nr. 4 „KW 40 (28.09.–04.10.)“: BAUPLAN gilt – volle ISO-Spanne Mo–So. */}
                <td className="tnum text-ink-3 font-mono whitespace-nowrap">{fmtZeitraum(z.von, z.bis)}</td>
                {metriken.map((m) => (
                  <td key={m.key} className="tnum text-right font-mono" data-metrik={m.key}>
                    {zelle(z.werte[m.key], zukunft, m.key === aktiv)}
                  </td>
                ))}
              </tr>
            )
          })}
          <tr className="border-line-strong text-ink h-9 border-t text-[13.5px] font-medium" data-gesamt>
            <td colSpan={2}>{gesamtLabel}</td>
            {metriken.map((m) => (
              <td key={m.key} className="tnum text-right font-mono" data-metrik={m.key}>
                {fmtZahl(summe[m.key])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  )
}
