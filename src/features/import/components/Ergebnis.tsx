// oxlint-disable react/only-export-components -- importDateline gehört zu den Ergebnis-Bausteinen
// Bausteine der Import-Ergebnisseite (Runde 3, echte Daten): Dateline ohne internen Schlüssel, Bilanz mit „216 neu“ als
// größter Zahl, Hinweise mit Überschrift + Anzahl, gruppiert nach Art und die Einzelzeilen eingeklappt (37 Zeilen „Mike und
// Vincent sind beide vernetzt …“ standen sonst ohne Ordnung untereinander).
import { ChevronDown } from 'lucide-react'
import { Fragment, useId, useMemo, useState } from 'react'
import { cn } from '@/components/ui/cn'
import { fmtZahl } from '@/lib/format'
import type { SheetDryRunZeile } from '../presets/crmTabelle'

/** „Import · CRM-Tabelle · 15.10.2026, 01:31 · datei.csv · Vincent“ – leere Teile entfallen. */
export function importDateline(t: {
  preset: string | null
  erstellt: string
  datei?: string | null
  person?: string | null
}): string {
  return ['Import', t.preset, t.erstellt, t.datei, t.person].filter((x): x is string => !!x && x !== '–').join(' · ')
}

export function Bilanz({
  neu,
  zeilen,
  aktualisiert,
  uebersprungen,
  gesperrt,
}: {
  neu: number
  zeilen: number
  aktualisiert: number
  uebersprungen: number
  gesperrt: number
}) {
  const neben = [
    { wert: zeilen, label: zeilen === 1 ? 'Zeile' : 'Zeilen' },
    { wert: aktualisiert, label: 'aktualisiert' },
    { wert: uebersprungen, label: 'übersprungen' },
    { wert: gesperrt, label: 'gesperrt' },
  ]
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3" data-bilanz>
      <p className="grid gap-1.5">
        <span className="display" data-neu>
          {fmtZahl(neu)}
        </span>
        <span className="label">neu angelegt</span>
      </p>
      <p className="text-ink-2 tnum flex flex-wrap items-baseline gap-x-2 gap-y-1 pb-[3px] font-mono text-[13px]">
        {neben.map((e, i) => (
          <Fragment key={e.label}>
            {/* Leerzeichen zwischen den Flex-Kindern: unsichtbar im Layout, aber im kopierten/vorgelesenen Text */}
            {i > 0 ? ' ' : null}
            <span className="whitespace-nowrap">
              {i > 0 ? <span className="text-ink-3">· </span> : null}
              <b className="text-ink-bright font-medium">{fmtZahl(e.wert)}</b> {e.label}
            </span>
          </Fragment>
        ))}
      </p>
    </div>
  )
}

const hinweisText = (h: SheetDryRunZeile) => h.hinweis ?? h.warnung ?? ''

/** Hinweise je Art zählen, häufigste zuerst (bei Gleichstand in der Reihenfolge des Imports). */
export function hinweisArten(hinweise: readonly SheetDryRunZeile[]): { text: string; anzahl: number }[] {
  const m = new Map<string, number>()
  for (const h of hinweise) {
    const t = hinweisText(h) || 'ohne Text'
    m.set(t, (m.get(t) ?? 0) + 1)
  }
  return [...m].map(([text, anzahl]) => ({ text, anzahl })).sort((a, b) => b.anzahl - a.anzahl)
}

export function Hinweise({ hinweise }: { hinweise: readonly SheetDryRunZeile[] }) {
  const [offen, setOffen] = useState(false)
  const id = useId()
  const arten = useMemo(() => hinweisArten(hinweise), [hinweise])
  return (
    <section aria-labelledby={`${id}-titel`} className="grid max-w-[760px] gap-2">
      <h2 id={`${id}-titel`} className="label flex items-baseline gap-2">
        Hinweise <span className="tnum font-mono tracking-normal normal-case">{fmtZahl(hinweise.length)}</span>
      </h2>
      <ul className="border-line-strong border-t" aria-label="Hinweise nach Art">
        {arten.map((a) => (
          <li key={a.text} className="hairline text-small flex min-h-8 items-center gap-3 py-1">
            <span className="text-ink-2 min-w-0 flex-1">{a.text}</span>
            <span className="text-ink-bright tnum flex-none font-mono">{fmtZahl(a.anzahl)}</span>
          </li>
        ))}
      </ul>
      <div>
        <button
          type="button"
          aria-expanded={offen}
          aria-controls={`${id}-zeilen`}
          onClick={() => setOffen((o) => !o)}
          className="text-small text-ink-2 hover:text-ink ease-brand -ml-2 inline-flex h-8 items-center gap-1.5 rounded-sm px-2 transition-[color] duration-[var(--t-1)]"
        >
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn('ease-brand transition-transform duration-[var(--t-1)]', offen ? 'rotate-180' : '')}
          />
          {offen
            ? 'Einzelne Zeilen ausblenden'
            : `${hinweise.length === 1 ? 'Die Zeile' : `Alle ${fmtZahl(hinweise.length)} Zeilen`} anzeigen`}
        </button>
      </div>
      {offen ? (
        <ul id={`${id}-zeilen`} className="border-line-strong rounded-md border" aria-label="Hinweise">
          {hinweise.slice(0, 200).map((h, i) => (
            <li
              key={i}
              className="hairline text-small text-ink-2 flex min-h-8 items-center gap-3 px-3 py-1 last:border-b-0 max-md:flex-wrap max-md:gap-y-0.5 max-md:py-2"
            >
              <span className="text-ink-3 tnum w-10 flex-none font-mono">{h.id ?? '–'}</span>
              <span className="text-ink min-w-0 flex-1 truncate">{h.name ?? '–'}</span>
              <span className="min-w-0 max-md:basis-full max-md:pl-[52px]">{hinweisText(h)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
