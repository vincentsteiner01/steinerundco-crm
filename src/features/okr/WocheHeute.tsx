// „Heute“ und „Diese Woche“: zwei kompakte Tafeln mit dem, was man täglich braucht. Je Tafel eine kleine Tabelle –
// Zeile = Key Result, Spalten = die Personen; ein Key Result fürs Team läuft über alle Spalten. Erreicht = Haken und grün.
// Nur die Key Results der Monatsziele, die im Ausschnitt ein Soll haben (ausschnittZeilen).
import { Check } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/components/ui/cn'
import type { TeamPerson } from '@/features/team/personen'
import { fmtDatumKurz } from '@/lib/format'
import { kalenderwoche, type Tag } from '@/lib/zeit'
import { hatSoll, type Ausschnitt, type ErgebnisAnsicht } from './ansicht'
import { aufgerundet, istSollText, type IstSoll } from './rechnen'

function Zelle({ x, einheit }: { x: IstSoll | null | undefined; einheit: string | null }) {
  if (!x || !hatSoll(x)) return <span className="text-ink-3">–</span>
  const erreicht = x.ist >= aufgerundet(x.soll) - 1e-9
  return (
    <span
      data-erreicht={erreicht || undefined}
      className={cn('inline-flex items-center gap-1', erreicht ? 'text-done font-semibold' : 'text-ink')}
    >
      {erreicht ? (
        <>
          <Check size={14} strokeWidth={2.5} aria-hidden />
          <span className="sr-only">Erreicht: </span>
        </>
      ) : null}
      {istSollText(x, einheit)}
    </span>
  )
}

function Tafel({
  titel,
  neben,
  ausschnitt,
  zeilen,
  personen,
}: {
  titel: string
  neben: string
  ausschnitt: Ausschnitt
  zeilen: readonly ErgebnisAnsicht[]
  personen: readonly TeamPerson[]
}) {
  const titelId = useId()
  // Personen-Spalten nur, wenn mindestens ein Key Result je Person gilt – sonst steht rechts einfach die Zahl des Teams
  const jePerson = zeilen.some((z) => z.ergebnis.je_person)
  return (
    <section aria-labelledby={titelId} data-tafel={ausschnitt} className="bg-sidebar min-w-0 rounded-md px-5 pt-4 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titelId} className="text-h3 text-ink-bright">
          {titel}
        </h2>
        <span className="text-small text-ink-3 tnum whitespace-nowrap">{neben}</span>
      </div>
      <table aria-labelledby={titelId} className="mt-2 w-full">
        {jePerson ? (
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Key Result</span>
              </th>
              {personen.map((p) => (
                <th key={p.id} scope="col" className="text-small text-ink-3 pb-1 pl-4 text-right font-medium">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {zeilen.map(({ ergebnis: e, fortschritte }) => (
            <tr key={e.id} className="border-line border-t">
              <th scope="row" className="text-ui text-ink py-2.5 text-left font-normal [overflow-wrap:anywhere]">
                {e.titel}
              </th>
              {e.je_person ? (
                personen.map((p) => (
                  <td key={p.id} className="text-ui tnum py-2.5 pl-4 text-right whitespace-nowrap">
                    <Zelle x={fortschritte.find((f) => f.memberId === p.id)?.[ausschnitt]} einheit={e.einheit} />
                  </td>
                ))
              ) : (
                <td
                  colSpan={jePerson ? Math.max(1, personen.length) : 1}
                  className={cn('text-ui tnum py-2.5 pl-4 whitespace-nowrap', jePerson ? 'text-center' : 'text-right')}
                >
                  <Zelle x={fortschritte[0]?.[ausschnitt]} einheit={e.einheit} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function WocheHeute({
  heute,
  heuteZeilen,
  wocheZeilen,
  personen,
  className,
}: {
  heute: Tag
  heuteZeilen: readonly ErgebnisAnsicht[]
  wocheZeilen: readonly ErgebnisAnsicht[]
  personen: readonly TeamPerson[]
  className?: string
}) {
  return (
    <aside
      aria-label="Heute und diese Woche"
      // zwischen 768 und 1180 px nebeneinander über den Monatszielen, ab 1180 px untereinander in der rechten Spalte
      className={cn('wide:grid-cols-1 grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2', className)}
    >
      {heuteZeilen.length ? (
        <Tafel titel="Heute" neben={fmtDatumKurz(heute)} ausschnitt="heute" zeilen={heuteZeilen} personen={personen} />
      ) : null}
      {wocheZeilen.length ? (
        <Tafel
          titel="Diese Woche"
          neben={`KW ${kalenderwoche(heute)}`}
          ausschnitt="woche"
          zeilen={wocheZeilen}
          personen={personen}
        />
      ) : null}
    </aside>
  )
}
