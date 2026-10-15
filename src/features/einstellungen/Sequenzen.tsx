// Einstellungen → Sequenzen (BAUPLAN § 3.9 Sequenzen.tsx, § 1.5 Nr. 35, E-03, E-13): Liste (Name · Kanal · Schritte · laufende Leads
// · aktiv) + SequenzEditor (M1 public) für ?id=. Hinweis-Kasten „A alt“. Deaktivieren mit laufenden Leads fragt nach.
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Dialog, Glyph, HinweisKarte, Skeleton, Switch, cn } from '@/components/ui'
import { toast } from '@/components/toast'
import { useSequenceSave, useSequences } from '@/data'
import { SequenzEditor } from '@/features/sequenzen/public'
import { useHotkeys } from '@/lib/keyboard'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { KANAL_LABEL } from '@/texte/de'
import type { Channel, SequenceMitSchritten } from '@/types/domain'
import { useEnrollmentZaehler } from '@/data/enrollments'
import { sequenzUpsert } from './logik'

const HINWEIS_KEY = 'crm.einstellungen.hinweis-a-alt'
const HINWEIS_TEXT =
  'Alte Sheet-Regel (INFO-Tab): 3 / 3 / 3 Tage, dann alle 30 Tage – als Sequenz ‚A alt‘ vorhanden (inaktiv). Hier aktivieren, dann erscheint sie im Sequenz-Menü.'

const KANAL_REIHENFOLGE: Record<Channel, number> = { linkedin: 0, telefon: 1, email: 2, sonstiges: 3 }

function liesAusgeblendet(): boolean {
  try {
    return localStorage.getItem(HINWEIS_KEY) === new Date().toISOString().slice(0, 10)
  } catch {
    return false
  }
}

export function Sequenzen() {
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const { data: sequenzen } = useSequences()
  const { data: zaehler } = useEnrollmentZaehler()
  const save = useSequenceSave()
  const [frage, setFrage] = useState<SequenceMitSchritten | null>(null)
  const [hinweisAus, setHinweisAus] = useState(liesAusgeblendet)

  const zurueck = () => {
    const p = new URLSearchParams(params)
    p.delete('id')
    setParams(p)
  }
  useHotkeys(
    'global',
    {
      escape: () => {
        if (id) zurueck()
      },
    },
    [id, params],
  )

  if (!sequenzen) return <Skeleton zeilen={5} />

  const sortiert = [...sequenzen].sort(
    (a, b) => KANAL_REIHENFOLGE[a.channel] - KANAL_REIHENFOLGE[b.channel] || a.name.localeCompare(b.name, 'de'),
  )
  const laufend = (s: SequenceMitSchritten) => zaehler?.get(s.id) ?? 0

  const umschalten = (s: SequenceMitSchritten, an: boolean) => {
    if (!an && laufend(s) > 0) {
      setFrage(s)
      return
    }
    save.mutate(sequenzUpsert(s, an), {
      onSuccess: () => toast(an ? `Sequenz ‚${s.name}‘ aktiviert.` : `Sequenz ‚${s.name}‘ deaktiviert.`),
    })
  }
  const deaktivierenBestaetigt = () => {
    if (!frage) return
    const s = frage
    save.mutate(sequenzUpsert(s, false), { onSuccess: () => toast(`Sequenz ‚${s.name}‘ deaktiviert.`) })
    setFrage(null)
  }
  const hinweisAusblenden = () => {
    try {
      localStorage.setItem(HINWEIS_KEY, new Date().toISOString().slice(0, 10))
    } catch {
      // kein Speicher – nur für diese Sitzung
    }
    setHinweisAus(true)
  }
  const oeffnen = (sid: string) => {
    const p = new URLSearchParams(params)
    p.set('id', sid)
    setParams(p)
  }
  if (id) {
    const s = sequenzen.find((x) => x.id === id)
    return (
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Button variante="quiet" groesse="S" icon={ArrowLeft} onClick={zurueck} kbd="Esc">
            Alle Sequenzen
          </Button>
          {s ? (
            <span className="text-h3 text-ink-bright">
              {s.name} <span className="text-ink-3 font-normal">· {KANAL_LABEL[s.channel]}</span>
            </span>
          ) : null}
        </div>
        {s ? (
          <SequenzEditor sequenceId={s.id} />
        ) : (
          <p className="text-body text-ink-2">Diese Sequenz gibt es nicht (mehr).</p>
        )}
      </div>
    )
  }

  const aAlt = sequenzen.find((x) => x.key === SEQUENZ.linkedin_sheet_regel)

  return (
    <div className="grid gap-4">
      {!hinweisAus && aAlt && !aAlt.active ? (
        <HinweisKarte
          text={HINWEIS_TEXT}
          aktion={{ label: '‚A alt‘ aktivieren', onClick: () => umschalten(aAlt, true) }}
          onAusblenden={hinweisAusblenden}
        />
      ) : null}
      <table className="w-full border-collapse text-[14px]" aria-label="Sequenzen">
        <thead>
          <tr className="hairline text-left">
            <th scope="col" className="label h-8 pr-3 font-semibold">
              Name
            </th>
            <th scope="col" className="label h-8 pr-3 font-semibold">
              Kanal
            </th>
            <th scope="col" className="label h-8 pr-3 text-right font-semibold">
              Schritte
            </th>
            <th scope="col" className="label h-8 pr-3 text-right font-semibold">
              Laufende Leads
            </th>
            <th scope="col" className="label h-8 text-right font-semibold">
              Aktiv
            </th>
          </tr>
        </thead>
        <tbody>
          {sortiert.map((s) => (
            <tr key={s.id} className={cn('hairline h-10', !s.active && 'text-ink-3')} data-id={s.id}>
              <td className="pr-3">
                <button
                  type="button"
                  onClick={() => oeffnen(s.id)}
                  className="text-ink hover:text-ink-bright inline-flex items-center gap-2 text-left font-medium underline-offset-4 hover:underline"
                >
                  {s.name}
                  {s.key === SEQUENZ.linkedin_sheet_regel ? (
                    <span className="text-small text-ink-3 font-normal">Sheet-Regel</span>
                  ) : null}
                </button>
              </td>
              <td className="pr-3">
                <span className="inline-flex items-center gap-1.5">
                  <Glyph kanal={s.channel} />
                  <span className="text-small text-ink-2">{KANAL_LABEL[s.channel]}</span>
                </span>
              </td>
              <td className="mono pr-3 text-right">{s.steps.length}</td>
              <td className="mono pr-3 text-right">{laufend(s)}</td>
              <td className="text-right">
                <Switch
                  checked={s.active}
                  onCheckedChange={(an) => umschalten(s, an)}
                  label={`${s.name} aktiv`}
                  disabled={save.isPending}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-small text-ink-3">
        {sortiert.length} Sequenzen · inaktive erscheinen im Sequenz-Menü ausgegraut mit Hinweis „in Einstellungen
        aktivieren“.
      </p>
      <Dialog
        offen={frage !== null}
        onOpenChange={(o) => {
          if (!o) setFrage(null)
        }}
        titel="Sequenz deaktivieren"
        text={
          frage
            ? `${laufend(frage)} laufende Leads behalten ihre Schritte. Die Sequenz ‚${frage.name}‘ lässt sich nur nicht mehr neu starten.`
            : undefined
        }
        primaer={{ label: 'Deaktivieren', onClick: deaktivierenBestaetigt }}
      />
    </div>
  )
}
