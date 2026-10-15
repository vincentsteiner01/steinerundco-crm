// BAUPLAN § 3.6 / § 7.3 Leitfäden: v_template_performance (Vorlage · gesendet · Antworten (7 T) · Quote; K-06), „Geantwortet nach
// Schritt“ als Balken je Sequenzschritt (aus useActivitiesZeitraum, letzterSchrittJeLead), Notiz-Variante vs. ohne
// (Annahme-/Antwortquote je note_variant, Hinweis „Entscheidung nach 200 je Variante“).
import { useMemo } from 'react'
import { cn } from '@/components/ui/cn'
import { Glyph } from '@/components/ui/Glyph'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import type { ActivityZeitraum } from '@/data/activities'
import type { useSequencesIndex } from '@/data/sequences'
import { fmtProzent, fmtZahl } from '@/lib/format'
import { KANAL_LABEL } from '@/texte/de'
import type { Channel, TemplatePerformance } from '@/types/domain'
import { FunnelBalken } from './charts/FunnelBalken'
import { Sparkline } from './charts/Sparkline'
import { NOTIZ_VARIANTE_LABEL, type NotizVariante } from './kennzahlen'
import { BlockKopf } from './_Teile'
import { wochenStart } from './zeitraum'

export type KanalWahl = 'alle' | Channel

export type LeitfaedenTabelleProps = {
  templates: readonly TemplatePerformance[]
  kanal: KanalWahl
  nachSchritt: Map<string, number>
  sequenzen: ReturnType<typeof useSequencesIndex>['data']
  notizVarianten: readonly NotizVariante[]
  /** Aktivitäten des Zeitraums (für die Wochen-Sparkline je Vorlage) */
  aktivitaeten: readonly ActivityZeitraum[]
}

type Zeile = TemplatePerformance & { id: string; verlauf: number[] }

const h = spaltenHelper<Zeile>()

export function LeitfaedenTabelle({
  templates,
  kanal,
  nachSchritt,
  sequenzen,
  notizVarianten,
  aktivitaeten,
}: LeitfaedenTabelleProps) {
  const zeilen = useMemo<Zeile[]>(() => {
    // Sendungen je Vorlage und ISO-Woche im Zeitraum (Sparkline, max. 8 Wochen)
    const wochenJeVorlage = new Map<string, Map<string, number>>()
    const alleWochen = new Set<string>()
    for (const a of aktivitaeten) {
      if (!a.template_id) continue
      const w = wochenStart(a.occurred_at.slice(0, 10))
      alleWochen.add(w)
      const m = wochenJeVorlage.get(a.template_id) ?? new Map<string, number>()
      m.set(w, (m.get(w) ?? 0) + 1)
      wochenJeVorlage.set(a.template_id, m)
    }
    const wochen = [...alleWochen].sort().slice(-8)
    return templates
      .filter((t) => t.template_id && (t.gesendet ?? 0) > 0 && (kanal === 'alle' || t.channel === kanal))
      .map((t) => ({
        ...t,
        id: t.template_id as string,
        verlauf: wochen.map((w) => wochenJeVorlage.get(t.template_id as string)?.get(w) ?? 0),
      }))
      .sort((a, b) => (b.gesendet ?? 0) - (a.gesendet ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
  }, [templates, kanal, aktivitaeten])

  const spalten = useMemo<DataTableSpalte<Zeile>[]>(
    () => [
      h.accessor('name', {
        header: 'Vorlage',
        meta: { breite: '44%' },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            {row.original.channel ? <Glyph kanal={row.original.channel} /> : null}
            <span className="truncate">{row.original.name}</span>
          </span>
        ),
      }),
      h.accessor('gesendet', {
        header: 'Gesendet',
        meta: { rechts: true, mono: true, breite: '14%' },
        cell: ({ getValue }) => fmtZahl(getValue() ?? 0),
      }),
      h.accessor('beantwortet', {
        header: 'Antworten (7 T)',
        meta: { rechts: true, mono: true, breite: '16%' },
        cell: ({ getValue }) => fmtZahl(getValue() ?? 0),
      }),
      h.accessor('antwort_quote', {
        header: 'Quote',
        meta: { rechts: true, mono: true, breite: '12%' },
        cell: ({ getValue }) => {
          const q = getValue()
          return q === null ? '–' : fmtProzent(q)
        },
      }),
      h.display({
        id: 'verlauf',
        header: 'Je Woche',
        meta: { rechts: true, ausblenden: 'lg', breite: '14%' },
        cell: ({ row }) =>
          row.original.verlauf.length ? (
            <span className="inline-flex justify-end">
              <Sparkline
                werte={row.original.verlauf}
                label={`Sendungen je Woche: ${row.original.verlauf.join(', ')}`}
              />
            </span>
          ) : null,
      }),
    ],
    [],
  )

  const sequenzListe = useMemo(() => {
    if (!sequenzen) return []
    return sequenzen.sequenzen
      .filter((s) => kanal === 'alle' || s.channel === kanal)
      .map((s) => ({
        key: s.key,
        name: s.name,
        channel: s.channel,
        schritte: s.steps.map((st) => ({
          id: st.id,
          label: `${st.position} · ${st.name}`,
          n: nachSchritt.get(st.id) ?? 0,
        })),
      }))
      .filter((s) => s.schritte.some((st) => st.n > 0))
  }, [sequenzen, nachSchritt, kanal])

  return (
    <section aria-label="Leitfäden" className="grid min-w-0 grid-cols-1 gap-8">
      <div>
        <BlockKopf titel="Leitfäden" hinweis="gesendet gesamt · Antwort binnen 7 Tagen" />
        <DataTable<Zeile>
          daten={zeilen}
          spalten={spalten}
          rowId={(r) => r.id}
          sticky={false}
          ariaLabel="Leitfäden-Tabelle"
          // Fünf schmale Spalten brauchen die 1040 px der Lead-Tabellen nicht (1024 px: „Antworten (7“ abgeschnitten); mobil 600 px + Querscroll
          className="max-xl:[&>table]:min-w-0 max-md:[&>table]:min-w-[600px]"
          leer={<p className="text-small text-ink-3">Noch keine Vorlage gesendet.</p>}
        />
      </div>

      <div>
        <BlockKopf titel="Geantwortet nach Schritt" hinweis="Antworten je Sequenzschritt im Zeitraum" />
        {sequenzListe.length === 0 ? (
          <p className="text-small text-ink-3">Noch keine Antwort einem Sequenzschritt zugeordnet.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {sequenzListe.map((s) => {
              const max = Math.max(1, ...s.schritte.map((st) => st.n))
              return (
                <div key={s.key} data-sequenz={s.key}>
                  <span className="label mb-2 flex items-center gap-2">
                    <Glyph kanal={s.channel} />
                    {s.name}
                  </span>
                  <ol className="grid gap-1.5">
                    {s.schritte.map((st) => (
                      <li
                        key={st.id}
                        className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-3 text-[13px]"
                        data-schritt={st.id}
                      >
                        <span className={cn('truncate', st.n === 0 ? 'text-ink-3' : 'text-ink-2')}>{st.label}</span>
                        <FunnelBalken anteil={st.n / max} />
                        <span className={cn('tnum text-right font-mono', st.n === 0 ? 'text-ink-3' : 'text-ink')}>
                          {fmtZahl(st.n)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {kanal === 'alle' || kanal === 'linkedin' ? (
        <div>
          <BlockKopf
            titel="Notiz-Variante"
            hinweis={`${KANAL_LABEL.linkedin} · Anfragen im Zeitraum · Entscheidung nach 200 je Variante`}
          />
          {notizVarianten.length === 0 ? (
            <p className="text-small text-ink-3">Noch keine Anfragen im Zeitraum.</p>
          ) : (
            <table className="w-full border-collapse" aria-label="Notiz-Variante">
              <thead>
                <tr>
                  <th scope="col" className="label border-line-strong border-b pb-2 text-left">
                    Variante
                  </th>
                  <th scope="col" className="label border-line-strong border-b pb-2 text-right">
                    Anfragen
                  </th>
                  <th scope="col" className="label border-line-strong border-b pb-2 text-right">
                    Angenommen
                  </th>
                  <th scope="col" className="label border-line-strong border-b pb-2 text-right">
                    Antworten
                  </th>
                </tr>
              </thead>
              <tbody>
                {notizVarianten.map((v) => (
                  <tr
                    key={v.variante}
                    className="border-line text-ink-2 h-9 border-b text-[13.5px]"
                    data-variante={v.variante}
                  >
                    <td>{NOTIZ_VARIANTE_LABEL[v.variante]}</td>
                    <td className="tnum text-ink text-right font-mono">{fmtZahl(v.gesamt)}</td>
                    <td className="tnum text-ink text-right font-mono">
                      {fmtZahl(v.angenommen)}
                      <span className="text-ink-3">
                        {' '}
                        · {v.annahmeQuote === null ? '–' : fmtProzent(v.annahmeQuote)}
                      </span>
                    </td>
                    <td className="tnum text-ink text-right font-mono">
                      {fmtZahl(v.antworten)}
                      <span className="text-ink-3">
                        {' '}
                        · {v.antwortQuote === null ? '–' : fmtProzent(v.antwortQuote)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  )
}
