// Feedback 0b376afc (17.10.2026): eigene Telefon-Kennzahlen statt LinkedIn-Blöcken – Ergebnisse der Anrufe (Verteilung über die
// 15 Tasten) und Erreichbarkeit nach Uhrzeit (Connect-Quote je Stunde, Berlin). Reine Darstellung, Rechnung in kennzahlen.ts.
import { fmtAnteil, fmtZahl } from '@/lib/format'
import type { ErgebnisZeile, StundenZeile } from './kennzahlen'
import { BlockKopf } from './_Teile'

function Balken({ anteil, ton = 'ink' }: { anteil: number; ton?: 'ink' | 'signal' }) {
  return (
    <span className="bg-surface-hover block h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
      <span
        className={ton === 'signal' ? 'bg-signal block h-full' : 'bg-signal/45 block h-full'}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, anteil)) * 100)}%` }}
      />
    </span>
  )
}

export function AnrufErgebnisse({ zeilen, gesamt }: { zeilen: readonly ErgebnisZeile[]; gesamt: number }) {
  return (
    <section aria-label="Ergebnisse der Anrufe" className="min-w-0">
      <BlockKopf titel="Ergebnisse" hinweis={`${fmtZahl(gesamt)} Anrufe · Anteil je Ergebnis`} />
      {zeilen.length === 0 ? (
        <p className="text-ink-3 text-[13.5px]">Im Zeitraum noch kein Anruf mit Ergebnis.</p>
      ) : (
        <ul className="grid gap-2.5">
          {zeilen.map((z) => (
            <li
              key={z.outcome}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1"
              data-ergebnis={z.outcome}
            >
              <span className="text-ink-2 min-w-0 truncate text-[13px]" title={`${z.gruppe} · ${z.label}`}>
                {z.label}
              </span>
              <span className="tnum text-ink font-mono text-[12.5px]">
                {fmtZahl(z.n)} <span className="text-ink-3">· {fmtAnteil(z.anteil)}</span>
              </span>
              <span className="col-span-2">
                <Balken anteil={z.anteil} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Erreichbarkeit({ stunden }: { stunden: readonly StundenZeile[] }) {
  const beste = stunden.reduce<StundenZeile | null>(
    (b, s) => (s.dials >= 3 && s.quote !== null && (b === null || (b.quote ?? 0) < s.quote) ? s : b),
    null,
  )
  return (
    <section aria-label="Erreichbarkeit nach Uhrzeit" className="min-w-0">
      <BlockKopf
        titel="Erreichbarkeit nach Uhrzeit"
        hinweis={beste ? `beste Stunde ${beste.stunde}–${beste.stunde + 1} Uhr` : 'Connects je Dial, Berliner Zeit'}
      />
      <div className="grid gap-1.5" role="table" aria-label="Connects je Stunde">
        <div role="row" className="label grid grid-cols-[52px_minmax(0,1fr)_116px] gap-3">
          <span role="columnheader">Uhrzeit</span>
          <span role="columnheader">Connect-Quote</span>
          <span role="columnheader" className="text-right whitespace-nowrap">
            Connects/Dials
          </span>
        </div>
        {stunden.map((s) => (
          <div
            key={s.stunde}
            role="row"
            className="grid grid-cols-[52px_minmax(0,1fr)_116px] items-center gap-3"
            data-stunde={s.stunde}
          >
            <span role="cell" className="tnum text-ink-2 font-mono text-[12.5px]">
              {String(s.stunde).padStart(2, '0')}:00
            </span>
            <span role="cell">
              <Balken anteil={s.quote ?? 0} ton={beste?.stunde === s.stunde ? 'signal' : 'ink'} />
            </span>
            <span role="cell" className="tnum text-ink-3 text-right font-mono text-[12.5px]">
              {s.dials ? `${fmtZahl(s.connects)}/${fmtZahl(s.dials)}` : '–'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
