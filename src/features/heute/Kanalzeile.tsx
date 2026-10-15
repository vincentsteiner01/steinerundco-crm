// Kanalzeile (ux § 3.1.1 Nr. 2, BAUPLAN § 3.2 Kanalzeile.tsx): LinkedIn-Block „Anfragen heute 12 / 30 · Woche 118 / 150 · Annahme (7 T) 28 %“
// mit +1 +5 +10 und „Liste einfügen“ · Telefon-Block „Anrufe heute 23 · Erreicht 4 · Entscheider 2 · Termine 1“ mit „Call-Block starten“.
// Blöcke erscheinen nur, wenn die Person den Kanal nutzt (Seite entscheidet).
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import { fmtProzent, fmtVerhaeltnis, fmtZahl } from '@/lib/format'
import type { TageszaehlerDaten } from './useTageszaehler'

export type KanalzeileProps = {
  daten: TageszaehlerDaten
  linkedin: boolean
  telefon: boolean
  onListeEinfuegen: () => void
  onCallBlock: () => void
  className?: string
}

function Zahl({ wert, label, warn }: { wert: string; label: string; warn?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-ink-3">{label}</span>{' '}
      <span className={cn('tnum font-mono text-[13px] font-medium', warn ? 'text-overdue' : 'text-ink')}>{wert}</span>
    </span>
  )
}

export function Kanalzeile({ daten, linkedin, telefon, onListeEinfuegen, onCallBlock, className }: KanalzeileProps) {
  if (!linkedin && !telefon) return null
  const b = daten.budget
  return (
    <div className={cn('mb-4 grid gap-2.5', className)} data-kanalzeile>
      {linkedin ? (
        <div className="border-line text-small flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-3.5 py-2.5">
          <Glyph kanal="linkedin" aktiv />
          <Zahl label="Anfragen heute" wert={fmtVerhaeltnis(daten.wert, b.tagesziel)} />
          <Zahl label="Woche" wert={fmtVerhaeltnis(daten.woche, b.wochenbudget)} warn={b.warnung} />
          {daten.annahmeQuote7 !== null ? <Zahl label="Annahme (7 T)" wert={fmtProzent(daten.annahmeQuote7)} /> : null}
          <Zahl label="Heute noch möglich" wert={fmtZahl(b.moeglich)} warn={b.erreicht} />
          <span className="flex-1" />
          <span className="flex items-center gap-1.5" role="group" aria-label="Zähler">
            {[1, 5, 10].map((n) => (
              <Button key={n} groesse="S" onClick={() => daten.delta(n)} className="tnum font-mono">
                +{n}
              </Button>
            ))}
            <Button groesse="S" variante="quiet" kbd="⌘⇧O" onClick={onListeEinfuegen}>
              Liste einfügen
            </Button>
          </span>
        </div>
      ) : null}
      {telefon ? (
        <div className="border-line text-small flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-3.5 py-2.5">
          <Glyph kanal="telefon" aktiv />
          <Zahl label="Anrufe heute" wert={fmtZahl(daten.telefon.anrufe)} />
          <Zahl label="Erreicht" wert={fmtZahl(daten.telefon.erreicht)} />
          <Zahl label="Entscheider" wert={fmtZahl(daten.telefon.entscheider)} />
          <Zahl label="Termine" wert={fmtZahl(daten.telefon.termine)} />
          <span className="flex-1" />
          <Button groesse="S" onClick={onCallBlock}>
            Call-Block starten
          </Button>
        </div>
      ) : null}
    </div>
  )
}
