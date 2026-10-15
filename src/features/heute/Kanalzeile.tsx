// Kanalzeile (ux § 3.1.1 Nr. 2, BAUPLAN § 3.2 Kanalzeile.tsx): LinkedIn-Block „Anfragen heute 12 / 30 · Woche 118 / 150 · Annahme (7 T) 28 %“
// mit +1 +5 +10 und „Liste einfügen“ · Telefon-Block „Anrufe heute 23 · Erreicht 4 · Entscheider 2 · Termine 1“ mit „Call-Block starten“.
// Blöcke erscheinen nur, wenn die Person den Kanal nutzt (Seite entscheidet).
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import { fmtAnteil, fmtVerhaeltnis, fmtZahl } from '@/lib/format'
import type { TageszaehlerDaten } from './useTageszaehler'

export type KanalzeileProps = {
  daten: TageszaehlerDaten
  linkedin: boolean
  telefon: boolean
  onListeEinfuegen: () => void
  onCallBlock: () => void
  /** Der Tageszähler steht ab 1180 px rechts in der Rail (reference.html): dann den LinkedIn-Block nicht doppelt zeigen (Runde 2). */
  zaehlerImRail?: boolean
  className?: string
}

/**
 * Zähler setzen (Direkteingabe) für die Kanalzeile – gleiche Bedienung wie im Tageszähler (Stepper): ↵/Blur übernimmt,
 * Esc verwirft. Runde 3: unter 1180 px ist die Kanalzeile der einzige Ort des Zählers, also braucht sie −1 und das Feld.
 */
function ZaehlerFeld({ wert, onSetzen }: { wert: number; onSetzen: (n: number) => void }) {
  const [eingabe, setEingabe] = useState<string | null>(null)
  const verwerfen = useRef(false)
  return (
    <span className="border-line-strong bg-surface-hover focus-within:border-signal flex h-7 w-16 items-center rounded-sm border px-2">
      <input
        aria-label="Zähler setzen"
        inputMode="numeric"
        className="tnum w-full bg-transparent text-right font-mono text-[12.5px] outline-none"
        value={eingabe ?? String(wert)}
        onFocus={() => setEingabe(String(wert))}
        onChange={(e) => setEingabe(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => {
          const n = Number.parseInt(eingabe ?? '', 10)
          if (!verwerfen.current && Number.isFinite(n) && n !== wert) onSetzen(Math.max(0, n))
          verwerfen.current = false
          setEingabe(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.preventDefault()
            verwerfen.current = true
            e.currentTarget.blur()
          }
        }}
      />
    </span>
  )
}

function Zahl({ wert, label, warn }: { wert: string; label: string; warn?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-ink-3">{label}</span>{' '}
      <span className={cn('tnum font-mono text-[13px] font-medium', warn ? 'text-overdue' : 'text-ink')}>{wert}</span>
    </span>
  )
}

export function Kanalzeile({
  daten,
  linkedin,
  telefon,
  onListeEinfuegen,
  onCallBlock,
  zaehlerImRail,
  className,
}: KanalzeileProps) {
  if (!linkedin && !telefon) return null
  const b = daten.budget
  return (
    <div className={cn('mb-4 grid gap-2.5', zaehlerImRail && !telefon && 'wide:hidden', className)} data-kanalzeile>
      {linkedin ? (
        <div
          data-kanal-linkedin
          className={cn(
            'border-line text-small flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-3.5 py-2.5',
            zaehlerImRail && 'wide:hidden',
          )}
        >
          <Glyph kanal="linkedin" aktiv />
          <Zahl label="Anfragen heute" wert={fmtVerhaeltnis(daten.wert, b.tagesziel)} />
          <Zahl label="Woche" wert={fmtVerhaeltnis(daten.woche, b.wochenbudget)} warn={b.warnung} />
          {daten.annahmeQuote7 !== null ? <Zahl label="Annahme (7 T)" wert={fmtAnteil(daten.annahmeQuote7)} /> : null}
          <Zahl label="Heute noch möglich" wert={fmtZahl(b.moeglich)} warn={b.erreicht} />
          <span className="flex-1" />
          <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Zähler">
            {[-1, 1, 5, 10].map((n) => (
              <Button key={n} groesse="S" onClick={() => daten.delta(n)} className="tnum font-mono">
                {n > 0 ? `+${n}` : `−${Math.abs(n)}`}
              </Button>
            ))}
            <ZaehlerFeld wert={daten.wert} onSetzen={daten.setzen} />
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
