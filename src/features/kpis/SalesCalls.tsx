// BAUPLAN § 7.4 Nr. 5 Sales-Calls: drei Mono-Zahlen „Erstgespräche gebucht n · Strategiegespräche n · Kunden n“ + nächster
// Termin („Do 16.10., 10:00 · Name“) aus meetings geplant (min scheduled_at).
import { useLead } from '@/data/leads'
import { fmtDatumKurz, fmtZahl, fmtZeit } from '@/lib/format'
import type { Meeting } from '@/types/domain'
import { wert, type FunnelWerte } from './kennzahlen'
import { BlockKopf, Ziffer } from './_Teile'

export type SalesCallsProps = { werte: FunnelWerte; naechsterTermin: Meeting | null; zeitraumLabel: string }

export function SalesCalls({ werte: w, naechsterTermin, zeitraumLabel }: SalesCallsProps) {
  const { data: lead } = useLead(naechsterTermin?.lead_id)
  const eintraege = [
    {
      key: 'erstgespraeche_vereinbart',
      label: 'Erstgespräche gebucht',
      wert: wert(w.summen, 'erstgespraeche_vereinbart'),
    },
    { key: 'strategiegespraeche', label: 'Strategiegespräche', wert: wert(w.summen, 'strategiegespraeche') },
    { key: 'kunden_gewonnen', label: 'Kunden gewonnen', wert: wert(w.summen, 'kunden_gewonnen') },
  ] as const
  const termin = naechsterTermin
    ? `${fmtDatumKurz(naechsterTermin.scheduled_at)}, ${fmtZeit(naechsterTermin.scheduled_at)}${lead?.full_name ? ` · ${lead.full_name}` : ''}`
    : null
  return (
    <section aria-label="Sales-Calls">
      <BlockKopf titel="Sales-Calls" hinweis={zeitraumLabel} />
      <div className="grid grid-cols-3 gap-4">
        {eintraege.map((e, i) => (
          <div key={e.key} className="grid content-start gap-1" data-sales={e.key}>
            <Ziffer ton={e.wert === 0 ? 'ink-3' : 'bright'}>{fmtZahl(e.wert)}</Ziffer>
            <span className="text-ink-3 text-[12px] leading-tight">{e.label}</span>
            {i === 0 && termin ? (
              <span className="tnum text-ink-2 font-mono text-[12.5px]" data-termin>
                {termin}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
