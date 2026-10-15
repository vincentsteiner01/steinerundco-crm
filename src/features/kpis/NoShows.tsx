// BAUPLAN § 7.4 Nr. 6: vier Zahlen display 40 ink-3 + Voice-Fußnote „Fließen bewusst in keine Konversion ein.“ (ohne Quote).
import { fmtZahl } from '@/lib/format'
import { wert, type FunnelWerte } from './kennzahlen'
import { BlockKopf, Ziffer } from './_Teile'

const EINTRAEGE = [
  { key: 'erstgespraech_no_show', label: ['Erstgespräch', 'No-Show'] },
  { key: 'erstgespraech_abgesagt', label: ['Erstgespräch', 'abgesagt'] },
  { key: 'strategiegespraech_no_show', label: ['Strategiegespräch', 'No-Show'] },
  { key: 'strategiegespraech_abgesagt', label: ['Strategiegespräch', 'abgesagt'] },
] as const

export function NoShows({ werte: w }: { werte: FunnelWerte }) {
  return (
    <section aria-label="No-Shows und Absagen">
      <BlockKopf titel="No-Shows und Absagen" />
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        {EINTRAEGE.map((e) => (
          <div key={e.key} className="grid content-start gap-1" data-noshow={e.key}>
            <Ziffer ton="ink-3">{fmtZahl(wert(w.summen, e.key))}</Ziffer>
            <span className="text-ink-3 text-[12px] leading-tight">
              {e.label[0]}
              <br />
              {e.label[1]}
            </span>
          </div>
        ))}
      </div>
      <p className="voice mt-3">Fließen bewusst in keine Konversion ein.</p>
    </section>
  )
}
