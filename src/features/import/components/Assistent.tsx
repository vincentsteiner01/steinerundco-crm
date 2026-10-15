// oxlint-disable react/only-export-components -- Stepper/Zähler/Chips teilen sich Konstanten und Helfer (wie components/ui/Avatar.tsx)
// DESIGN-SYSTEM § 5.17: Stepper „1 Quelle · 2 Spalten · 3 Prüfen · 4 Fertig“ als Mono-Ziffern in 22-px-Kreisen
// (aktiv Lime-Fläche + signal-ink, erledigt ink-Rahmen), Haarlinie dazwischen; Zähler-Zeile Mono; Status-Chips.
import type { ReactNode } from 'react'
import { Chip, cn, type ChipTon } from '@/components/ui'
import type { Schritt } from '../useImport'

export const SCHRITTE: { nr: Schritt; label: string }[] = [
  { nr: 1, label: 'Quelle' },
  { nr: 2, label: 'Spalten' },
  { nr: 3, label: 'Prüfen' },
  { nr: 4, label: 'Fertig' },
]

export function Stepper({ aktiv, onSchritt }: { aktiv: Schritt; onSchritt?: (s: Schritt) => void }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Schritte">
      {SCHRITTE.map((s, i) => {
        const istAktiv = s.nr === aktiv
        const erledigt = s.nr < aktiv
        const klickbar = erledigt && aktiv !== 4 && !!onSchritt
        return (
          <li key={s.nr} className="flex items-center gap-3" aria-current={istAktiv ? 'step' : undefined}>
            <button
              type="button"
              disabled={!klickbar}
              onClick={() => klickbar && onSchritt?.(s.nr)}
              className={cn('flex items-center gap-2 rounded-sm disabled:cursor-default', klickbar && 'hover:text-ink')}
              aria-label={`Schritt ${s.nr} ${s.label}`}
            >
              <span
                className={cn(
                  'tnum inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border font-mono text-[12px] leading-none',
                  istAktiv
                    ? 'bg-signal text-signal-ink border-signal'
                    : erledigt
                      ? 'border-ink text-ink'
                      : 'border-line-strong text-ink-3',
                )}
              >
                {s.nr}
              </span>
              <span className={cn('text-ui', istAktiv ? 'text-ink' : erledigt ? 'text-ink-2' : 'text-ink-3')}>
                {s.label}
              </span>
            </button>
            {i < SCHRITTE.length - 1 ? <span aria-hidden className="hairline-t w-6 sm:w-10" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Zähler-Zeile: „216 Zeilen · 198 neu · 15 aktualisiert …“ (Mono, Zahlen ink-bright). */
export function Zaehler({
  eintraege,
}: {
  eintraege: { wert: number | string; label: string; ton?: 'overdue' | 'danger' }[]
}) {
  return (
    <p className="text-ink-2 tnum mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[13px]">
      {eintraege.map((e, i) => (
        <span key={e.label} className="whitespace-nowrap">
          {i > 0 ? <span className="text-ink-3 mr-2">·</span> : null}
          <b
            className={cn(
              'font-medium',
              e.ton === 'overdue' ? 'text-overdue' : e.ton === 'danger' ? 'text-danger' : 'text-ink-bright',
            )}
          >
            {e.wert}
          </b>{' '}
          {e.label}
        </span>
      ))}
    </p>
  )
}

export type ImportStatus =
  | 'neu'
  | 'duplikat'
  | 'archiv'
  | 'gesperrt'
  | 'ungueltig'
  | 'unvollstaendig'
  | 'sales_nav'
  | 'firmenseite'
  | 'dublette_liste'
  | 'firma_gesperrt'
  | 'nicht_anschreiben'
  | 'beide_angefragt'
  | 'error'
  | 'ohne_zustaendig'
  | 'aktualisiert'

/** DESIGN-SYSTEM § 5.17: Neu neutral · Dublette overdue · Archiv ended · Sperrliste danger · Firma gesperrt danger. */
export const STATUS_CHIP: Record<ImportStatus, { label: string; ton: ChipTon }> = {
  neu: { label: 'Neu', ton: 'neutral' },
  duplikat: { label: 'Dublette', ton: 'overdue' },
  aktualisiert: { label: 'Aktualisiert', ton: 'overdue' },
  archiv: { label: 'Archiv', ton: 'ended' },
  gesperrt: { label: 'Sperrliste', ton: 'danger' },
  ungueltig: { label: 'Ungültig', ton: 'danger' },
  unvollstaendig: { label: 'Unvollständig', ton: 'muted' },
  sales_nav: { label: 'Sales-Nav', ton: 'muted' },
  firmenseite: { label: 'Firmenseite', ton: 'muted' },
  dublette_liste: { label: 'Dublette (Liste)', ton: 'overdue' },
  firma_gesperrt: { label: 'Firma gesperrt', ton: 'danger' },
  nicht_anschreiben: { label: 'Nicht anschreiben', ton: 'danger' },
  beide_angefragt: { label: 'beide angefragt', ton: 'muted' },
  error: { label: '#ERROR!', ton: 'overdue' },
  ohne_zustaendig: { label: 'Ohne Zuständigen', ton: 'overdue' },
}

export function StatusChipImport({ status, title }: { status: ImportStatus; title?: string }) {
  const c = STATUS_CHIP[status]
  return (
    <Chip ton={c.ton} title={title}>
      {c.label}
    </Chip>
  )
}

export function AmDesktop({ kinder }: { kinder?: ReactNode }) {
  return (
    <div className="max-w-[420px] py-16">
      <h2 className="headline mb-2.5 text-[32px]">Am Desktop bearbeiten.</h2>
      <p className="text-body text-ink-2">
        Der Import braucht eine Tabelle und eine Tastatur – auf dem Telefon geht nur der Schnellimport.
      </p>
      {kinder}
    </div>
  )
}

/** Firmenname-Vergleich lowercase/trim (BAUPLAN § 3.8 SchrittPruefen). */
export function firmaGesperrt(
  company: string | null | undefined,
  firmen: readonly { name: string; do_not_contact: boolean }[] | undefined,
): boolean {
  if (!company || !firmen) return false
  const n = company.trim().toLowerCase()
  return firmen.some((f) => f.do_not_contact && f.name.trim().toLowerCase() === n)
}
