// Tageszähler (BAUPLAN § 3.2 Tageszaehler.tsx, DESIGN-SYSTEM § 5.2 Stepper): Stepper (M0) + Fußzeile „Oktober bisher 346 · Ziel 30/Tag ·
// gestern 38 · Woche 118 / 150“ + „n davon mit Profil erfasst“ + Link „Liste einfügen statt zählen → Schnellimport ⌘⇧O“.
// Warnung ab warn_at_pct des Wochenbudgets (Amber), bei 0 „Wochenbudget erreicht – weitere Anfragen auf eigenes Risiko“.
import { Stepper } from '@/components/ui/Stepper'
import { cn } from '@/components/ui/cn'
import { fmtAnteil, fmtVerhaeltnis, fmtZahl, monatLabel } from '@/lib/format'
import type { TageszaehlerDaten } from './useTageszaehler'

export type TageszaehlerProps = {
  daten: TageszaehlerDaten
  onListeEinfuegen: () => void
  className?: string
}

export const BUDGET_ERREICHT_TEXT = 'Wochenbudget erreicht – weitere Anfragen auf eigenes Risiko'

export function Tageszaehler({ daten, onListeEinfuegen, className }: TageszaehlerProps) {
  const { budget } = daten
  const monat = monatLabel(daten.heute.slice(0, 7)).split(' ')[0] ?? ''
  return (
    <Stepper
      label="Anfragen heute"
      wert={daten.wert}
      ziel={budget.tagesziel}
      manuell={daten.manuell > 0}
      onDelta={daten.delta}
      onSetzen={daten.setzen}
      className={className}
      fuss={
        <div className="grid gap-1" data-tageszaehler-fuss>
          <p className={cn('tnum m-0', budget.warnung && 'text-overdue')}>
            Woche <span className="font-mono">{fmtVerhaeltnis(daten.woche, budget.wochenbudget)}</span>
            {daten.annahmeQuote7 !== null ? (
              <>
                {' '}
                · Annahme (7 T) <span className="font-mono">{fmtAnteil(daten.annahmeQuote7)}</span>
              </>
            ) : null}{' '}
            · Heute noch möglich <span className="font-mono">{fmtZahl(budget.moeglich)}</span>
          </p>
          {budget.erreicht ? <p className="text-overdue m-0">{BUDGET_ERREICHT_TEXT}</p> : null}
          <p className="tnum m-0">
            {monat} bisher <span className="font-mono">{fmtZahl(daten.monat)}</span> · Ziel{' '}
            <span className="font-mono">{fmtZahl(budget.tagesziel)}</span>/Tag · gestern{' '}
            <span className="font-mono">{fmtZahl(daten.gestern)}</span>
          </p>
          <p className="tnum m-0">
            <span className="font-mono">{fmtZahl(daten.getrackt)}</span> davon mit Profil erfasst
            {daten.manuell > 0 ? (
              <>
                {' '}
                · <span className="font-mono">{fmtZahl(daten.manuell)}</span> manuell
              </>
            ) : null}
          </p>
          <p className="m-0 pt-1">
            Liste einfügen statt zählen →{' '}
            <button
              type="button"
              onClick={onListeEinfuegen}
              className="text-ink-2 hover:text-ink underline-offset-2 hover:underline"
            >
              Schnellimport
            </button>{' '}
            <kbd className="kbd">⌘⇧O</kbd>
          </p>
        </div>
      }
    />
  )
}
