// Telefon › Sales-KPIs (`/telefon/kpis`, 23.10.2026): Mikes KPI-Seite aus dem Sales Hub – Kacheln, Vertriebstrichter, Conversions
// mit Show-Rates und die Tabelle je Tag · Woche · Monat. Die Zahlen zählt das CRM selbst (Anrufe, Ergebnisse, Termine, Kunden aus
// v_metric_events); „Anrufe nachtragen“ ergänzt Anrufe, die nicht über das CRM liefen (Tageszähler, werden addiert).
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/toast'
import { useCounterSetzen } from '@/data/counters'
import { useMetricEventZeilen } from '@/data/kpis'
import { useMeId, useMembers } from '@/data/members'
import { fmtAnteil, fmtZahl, heuteBerlin } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { istTag } from '@/lib/zeit'
import type { Metric } from '@/types/domain'
import {
  conversions,
  gesamt,
  kpiSpanne,
  SALES_SPALTEN,
  salesZeilen,
  trichter,
  type KpiAnsicht,
} from './ansichten/logik'
import { Balkenzeile, Kachel, Kacheln, TelefonUnterNav } from './ansichten/Teile'

const ANSICHTEN: { key: KpiAnsicht; label: string; spanne: string }[] = [
  { key: 'tage', label: 'Tage', spanne: 'letzte 14 Tage' },
  { key: 'wochen', label: 'Wochen', spanne: 'letzte 12 Wochen' },
  { key: 'monate', label: 'Monate', spanne: 'letzte 12 Monate' },
]

const NACHTRAG: { metric: Metric; label: string }[] = [
  { metric: 'anrufe', label: 'Anwahlen' },
  { metric: 'anrufe_erreicht', label: 'Telefonate (erreicht)' },
  { metric: 'entscheider_gespraeche', label: 'Entscheidergespräche' },
]

function Nachtragen({ offen, onOpenChange }: { offen: boolean; onOpenChange: (o: boolean) => void }) {
  const meId = useMeId()
  const setzen = useCounterSetzen()
  const [datum, setDatum] = useState(() => heuteBerlin())
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [fehler, setFehler] = useState<string | null>(null)

  const speichern = () => {
    if (!meId) return
    if (!istTag(datum) || datum > heuteBerlin()) return setFehler('Datum heute oder früher wählen.')
    const zahlen = NACHTRAG.map((n) => ({ ...n, wert: Number(werte[n.metric] || 0) }))
    if (zahlen.some((z) => !Number.isInteger(z.wert) || z.wert < 0)) return setFehler('Nur ganze Zahlen ab 0.')
    const zuSetzen = zahlen.filter((z) => z.wert > 0)
    if (!zuSetzen.length) return setFehler('Mindestens eine Zahl eintragen.')
    for (const z of zuSetzen)
      setzen.mutate({ metric: z.metric, value: z.wert, date: datum, memberId: meId, delta: true })
    toast('Nachgetragen.')
    setWerte({})
    setFehler(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      offen={offen}
      onOpenChange={onOpenChange}
      titel="Anrufe nachtragen"
      text="Für Anrufe, die nicht über das CRM liefen. Die Zahlen kommen zu den automatisch gezählten dazu."
      kinder={
        <>
          <FormField label="Datum" htmlFor="nachtrag-datum">
            <Input
              id="nachtrag-datum"
              type="date"
              value={datum}
              max={heuteBerlin()}
              onChange={(e) => setDatum(e.target.value)}
            />
          </FormField>
          {NACHTRAG.map((n) => (
            <FormField key={n.metric} label={n.label} htmlFor={`nachtrag-${n.metric}`}>
              <Input
                id={`nachtrag-${n.metric}`}
                inputMode="numeric"
                placeholder="0"
                value={werte[n.metric] ?? ''}
                onChange={(e) => {
                  setFehler(null)
                  setWerte((w) => ({ ...w, [n.metric]: e.target.value.replace(/\D/g, '') }))
                }}
              />
            </FormField>
          ))}
          {fehler ? (
            <p className="text-small text-danger" role="alert">
              {fehler}
            </p>
          ) : null}
        </>
      }
      primaer={{ label: 'Nachtragen', onClick: speichern, busy: setzen.isPending }}
    />
  )
}

export function Component() {
  const { data: members } = useMembers()
  const [ansicht, setAnsicht] = useState<KpiAnsicht>('wochen')
  const [person, setPerson] = useState<string>('team')
  const [nachtragen, setNachtragen] = useState(false)
  const heute = heuteBerlin()
  const spanne = useMemo(() => kpiSpanne(ansicht, heute), [ansicht, heute])
  const { data, istLaden, fehler, nachladen } = useMetricEventZeilen(person, spanne.von, spanne.bis)

  const zeilen = useMemo(() => salesZeilen(data, ansicht, spanne), [data, ansicht, spanne])
  const summe = useMemo(() => gesamt(zeilen), [zeilen])
  const stufen = trichter(summe)
  const maxStufe = Math.max(1, ...stufen.map((s) => s.wert))
  const conv = conversions(summe)
  const w = (m: Metric) => summe[m] ?? 0

  const personen = [
    { key: 'team', label: 'Team' },
    ...(members ?? []).map((m) => ({ key: m.id ?? '', label: anzeigeName(m) })).filter((p) => p.key),
  ]
  const spannenText = ANSICHTEN.find((a) => a.key === ansicht)?.spanne ?? ''

  return (
    <>
      <TelefonUnterNav />
      <SeitenKopf
        titel="Sales-KPIs"
        kontext={`${personen.find((p) => p.key === person)?.label ?? 'Team'} · ${spannenText}`}
        rechts={
          <>
            <Segment<string> ariaLabel="Person" optionen={personen} wert={person} onChange={setPerson} />
            <Segment<KpiAnsicht>
              ariaLabel="Ansicht"
              optionen={ANSICHTEN.map((a) => ({ key: a.key, label: a.label }))}
              wert={ansicht}
              onChange={setAnsicht}
            />
            <Button variante="secondary" icon={Plus} onClick={() => setNachtragen(true)}>
              Anrufe nachtragen
            </Button>
          </>
        }
      />
      <Nachtragen offen={nachtragen} onOpenChange={setNachtragen} />

      {fehler ? (
        <LadeFehler text="Kennzahlen konnten nicht geladen werden." onNochmal={nachladen} />
      ) : istLaden ? (
        <Skeleton zeilen={8} />
      ) : (
        <>
          <Kacheln>
            <Kachel label="Anwahlen" wert={fmtZahl(w('anrufe'))} hinweis={spannenText} />
            <Kachel label="Entscheidergespräche" wert={fmtZahl(w('entscheider_gespraeche'))} hinweis={spannenText} />
            <Kachel label="EG durchgeführt" wert={fmtZahl(w('erstgespraeche'))} hinweis={spannenText} />
            <Kachel
              label="Neukunden"
              wert={fmtZahl(w('kunden_gewonnen'))}
              hinweis={spannenText}
              ton={w('kunden_gewonnen') ? 'done' : undefined}
            />
          </Kacheln>

          <div className="mb-10 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <section aria-label="Vertriebstrichter" className="min-w-0">
              <h2 className="text-h3 text-ink mb-3.5">Vertriebstrichter</h2>
              <ul className="grid gap-2.5">
                {stufen.map((s) => (
                  <Balkenzeile key={s.label} label={s.label} anteil={s.wert / maxStufe} wert={fmtZahl(s.wert)} />
                ))}
              </ul>
            </section>
            <section aria-label="Conversions" className="min-w-0">
              <h2 className="text-h3 text-ink mb-3.5">Conversions</h2>
              <ul className="grid gap-2.5">
                {conv.map((c) => (
                  <Balkenzeile
                    key={c.label}
                    label={c.label}
                    anteil={c.quote ?? 0}
                    leise
                    wert={c.quote === null ? '–' : fmtAnteil(c.quote)}
                  />
                ))}
              </ul>
            </section>
          </div>

          <section aria-label="Verlauf">
            <h2 className="text-h3 text-ink mb-3.5">
              {ansicht === 'tage' ? 'Je Tag' : ansicht === 'wochen' ? 'Je Kalenderwoche' : 'Je Monat'}
            </h2>
            <div className="-mx-1 overflow-x-auto px-1">
              <table
                className="w-full min-w-[920px] border-collapse text-[13px] whitespace-nowrap"
                aria-label="Sales-KPIs je Zeitraum"
              >
                <thead>
                  <tr className="label border-line-strong border-b">
                    <th scope="col" className="py-2 pr-4 text-left font-medium">
                      {ansicht === 'tage' ? 'Datum' : ansicht === 'wochen' ? 'Woche' : 'Monat'}
                    </th>
                    {SALES_SPALTEN.map((s) => (
                      <th key={s.key} scope="col" title={s.label} className="py-2 pl-3 text-right font-medium">
                        {s.kurz}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.key} className="border-line border-b">
                      <th scope="row" className="text-ink py-2 pr-4 text-left font-normal">
                        {z.label}
                      </th>
                      {SALES_SPALTEN.map((s) => {
                        const v = z.summen[s.key] ?? 0
                        return (
                          <td
                            key={s.key}
                            className={`tnum py-2 pl-3 text-right font-mono ${v ? 'text-ink' : 'text-ink-3'}`}
                          >
                            {v ? fmtZahl(v) : '–'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-small text-ink-3 mt-3 max-w-[75ch]">
              Gezählt aus dem CRM: Anwahlen und Ergebnisse aus dem Anruf-Screen, Termine aus den Gesprächen im Lead,
              Kunden aus dem Phasenwechsel. Show-Rate = durchgeführt ÷ vereinbart.
            </p>
          </section>
        </>
      )}
    </>
  )
}
