// BAUPLAN § 3.7 Statistik.tsx – gesendet · Antworten 7 T · Quote (v_template_performance) · Ø Zeit bis Antwort und
// 8-Wochen-Mini-Balken (24 px SVG) aus den Aktivitäten der Vorlage (clientseitig, LF-06).
import { useId } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTemplateActivities } from '@/data/activities'
import { fmtProzent, fmtZahl, heuteBerlin, relativ } from '@/lib/format'
import { tagPlus } from '@/lib/zeit'
import type { TemplatePerformance } from '@/types/domain'
import { fmtTage, statistikAusAktivitaeten, statistikVon, WOCHEN } from './helfer'

export type StatistikProps = { templateId: string; perf?: TemplatePerformance | null }

const BREITE = 8
const LUECKE = 3
const HOEHE = 24

export function Statistik({ templateId, perf }: StatistikProps) {
  const id = useId()
  const heute = heuteBerlin()
  // 8-Wochen-Fenster plus 7 Tage Antwortfenster nach hinten
  const { data, isPending } = useTemplateActivities(templateId, statistikVon(heute), tagPlus(heute, 7))
  const lokal = data ? statistikAusAktivitaeten(data.sendungen, data.antworten, heute) : null
  const gesendet = perf?.gesendet ?? lokal?.gesendet ?? 0
  const beantwortet = perf?.beantwortet ?? lokal?.antworten7T ?? 0
  const quote = perf?.antwort_quote ?? lokal?.quote ?? null
  const max = Math.max(1, ...(lokal?.wochen ?? [0]))
  const breite = WOCHEN * BREITE + (WOCHEN - 1) * LUECKE

  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-2.5">
      <h3 id={`${id}-h`} className="label">
        Statistik
      </h3>
      {isPending && !perf ? (
        <Skeleton zeilen={1} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="text-ink-2 tnum flex flex-wrap items-baseline gap-x-4 font-mono text-[13px]">
            <span>
              <b className="text-ink-bright text-[16px] font-medium">{fmtZahl(gesendet)}</b> gesendet
            </span>
            <span>
              <b className="text-ink-bright text-[16px] font-medium">{fmtZahl(beantwortet)}</b> Antworten 7 T
            </span>
            <span>
              <b className="text-ink-bright text-[16px] font-medium">{quote === null ? '–' : fmtProzent(quote)}</b>{' '}
              Quote
            </span>
            <span>
              <b className="text-ink-bright text-[16px] font-medium">
                {lokal?.oeTageBisAntwort == null ? '–' : fmtTage(lokal.oeTageBisAntwort)}
              </b>{' '}
              Ø bis Antwort
            </span>
            {perf?.zuletzt_verwendet ? <span>zuletzt {relativ(perf.zuletzt_verwendet, heute)}</span> : null}
          </p>
          <svg
            width={breite}
            height={HOEHE}
            viewBox={`0 0 ${breite} ${HOEHE}`}
            role="img"
            aria-label={`Sendungen je Woche, ${WOCHEN} Wochen: ${(lokal?.wochen ?? []).join(', ')}`}
            className="text-ink-3 shrink-0"
          >
            {(lokal?.wochen ?? Array.from({ length: WOCHEN }, () => 0)).map((n, i) => {
              const h = n === 0 ? 1 : Math.max(2, Math.round((n / max) * HOEHE))
              return (
                <rect
                  key={i}
                  x={i * (BREITE + LUECKE)}
                  y={HOEHE - h}
                  width={BREITE}
                  height={h}
                  rx={1}
                  fill="currentColor"
                  className={i === WOCHEN - 1 ? 'text-signal' : undefined}
                  data-wert={n}
                />
              )
            })}
          </svg>
        </div>
      )}
    </section>
  )
}
