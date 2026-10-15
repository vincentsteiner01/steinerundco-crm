// M3 – Ergebnisleiste (BAUPLAN § 3.4, DESIGN-SYSTEM § 5.13): 15 Buttons in drei Gruppen mit Gruppenlabel, S-Buttons 32 px mit
// kbd links, `D` in danger, gewählt = surface-hover + Lime-Rahmen. Mobil (`gross`): 48 px, volle Breite, ohne Tastenhinweis.
import { cn } from '@/components/ui/cn'
import { GRUPPEN_LABEL, type ErgebnisDef, type ErgebnisGruppe, type ErgebnisTaste } from './ergebnisse'

export type ErgebnisleisteProps = {
  ergebnisse: readonly ErgebnisDef[]
  gewaehlt: ErgebnisTaste | null
  onWaehlen: (def: ErgebnisDef) => void
  gross?: boolean
  disabled?: boolean
  className?: string
}

const GRUPPEN: readonly ErgebnisGruppe[] = ['A', 'B', 'C']

export function Ergebnisleiste({ ergebnisse, gewaehlt, onWaehlen, gross, disabled, className }: ErgebnisleisteProps) {
  return (
    <div
      role="group"
      aria-label="Ergebnis"
      // Unter 1180 px fließen alle 15 Tasten in einer Zeilenfolge (3 statt 6 Zeilen) – die Leiste klebt unten und darf
      // den Anruf-Bereich nicht zudecken (Sichtprüfung 1024 × 768)
      className={cn('grid gap-2.5', !gross && 'max-wide:flex max-wide:flex-wrap max-wide:gap-1.5', className)}
    >
      {GRUPPEN.map((g) => (
        <div
          key={g}
          role="group"
          aria-label={GRUPPEN_LABEL[g]}
          // Label-Spalte fest (eine Zeile), Buttons umbrechen in IHRER Spalte – nicht unter das Label (Sichtprüfung 1440 px)
          // Unter 1180 px (Spalten gestapelt) ohne Label-Spalte, damit die klebende Leiste flach bleibt; Tasten tragen die kbd
          className={cn(
            gross
              ? 'flex flex-col items-stretch gap-1.5'
              : 'max-wide:contents grid grid-cols-[148px_minmax(0,1fr)] items-start gap-x-3',
          )}
        >
          <span
            className={cn(
              'label',
              gross ? 'mt-1.5 mb-0.5' : 'max-wide:sr-only flex h-8 items-center whitespace-nowrap',
            )}
            data-testid="ergebnis-gruppe"
          >
            {GRUPPEN_LABEL[g]}
          </span>
          <div
            className={cn(
              'flex gap-1.5',
              gross ? 'flex-col items-stretch' : 'max-wide:contents min-w-0 flex-wrap items-center',
            )}
          >
            {ergebnisse
              .filter((e) => e.gruppe === g)
              .map((e) => {
                const aktiv = gewaehlt === e.taste
                return (
                  <button
                    key={e.taste}
                    type="button"
                    aria-pressed={aktiv}
                    title={e.label}
                    data-taste={e.taste}
                    disabled={disabled}
                    onClick={() => onWaehlen(e)}
                    className={cn(
                      'ease-brand inline-flex items-center gap-2 rounded-sm border font-medium whitespace-nowrap transition-[background,border-color,color] duration-[var(--t-1)]',
                      'active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45',
                      gross ? 'h-12 w-full justify-start px-3 text-[15px]' : 'h-8 pr-2.5 pl-1.5 text-[12.5px]',
                      aktiv ? 'bg-surface-hover border-signal' : 'border-line-strong hover:bg-surface-hover',
                      e.danger ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {gross ? null : <kbd className={cn('kbd', aktiv ? 'text-ink' : 'text-ink-3')}>{e.taste}</kbd>}
                    {e.kurz}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
