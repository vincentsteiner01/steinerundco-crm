// Telefon › Deal-Pipeline (`/telefon/pipeline`, 23.10.2026): Mikes acht Phasen ab dem Erstgespräch (EG vereinbart · EG neu
// terminieren · SG vereinbart · SG neu terminieren · SG Folgebesprechung · Follow-Up · Kunde · Beendet). Die Phase ergibt sich aus
// Stufe und Terminen (logik.ts) – wer im Lead einen Termin bucht, auf No-Show setzt oder den Kunden gewinnt, verschiebt die Karte.
// Deshalb kein Ziehen: Klick öffnet den Lead im Peek, dort passiert die Änderung.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Chip } from '@/components/ui/Chip'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useMeId } from '@/data/members'
import { useDeals, type TelefonLead } from '@/data/telefonAnsichten'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { berlinTag } from '@/lib/zeit'
import {
  DEAL_PHASEN,
  istFaellig,
  nachPhase,
  naechstesFollowUp,
  relevanterTermin,
  TERMIN_LABEL,
  type DealPhase,
} from './ansichten/logik'
import { TelefonUnterNav } from './ansichten/Teile'

type Wer = 'alle' | 'meine'

const KOPF_TON: Record<DealPhase, string> = {
  eg_vereinbart: 'bg-tag-gelb text-tag-gelb-ink',
  eg_neu: 'bg-tag-rot text-tag-rot-ink',
  sg_vereinbart: 'bg-tag-orange text-tag-orange-ink',
  sg_neu: 'bg-tag-rot text-tag-rot-ink',
  sg_folge: 'bg-tag-lila text-tag-lila-ink',
  follow_up: 'bg-tag-blau text-tag-blau-ink',
  kunde: 'bg-tag-gruen text-tag-gruen-ink',
  beendet: 'bg-tag-grau text-tag-grau-ink',
}

function Karte({ d, heute, onOeffnen }: { d: TelefonLead; heute: string; onOeffnen: (id: string) => void }) {
  const f = naechstesFollowUp(d)
  const t = relevanterTermin(d)
  return (
    <button
      type="button"
      onClick={() => onOeffnen(d.id)}
      className={cn(
        'bg-surface-raised shadow-card hover:shadow-float block w-full min-w-0 rounded-sm px-3 py-2.5 text-left transition-shadow',
        f?.due_at && istFaellig(f.due_at, heute) && 'ring-overdue/40 ring-1',
      )}
    >
      <span className="text-ink-bright block truncate text-[14px] font-medium">
        {d.company_name || d.full_name || '–'}
      </span>
      <span className="text-small text-ink-2 block truncate">
        {[d.company_name ? d.full_name : null, d.city].filter(Boolean).join(' · ') || ' '}
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        {t ? (
          <Chip
            // geplant, aber vorbei → Ergebnis fehlt (stattgefunden / No-Show im Lead setzen)
            ton={t.status !== 'geplant' ? 'later' : berlinTag(t.scheduled_at) < heute ? 'overdue' : 'today'}
            className="font-mono"
            title={
              t.status === 'geplant' && berlinTag(t.scheduled_at) < heute
                ? `${TERMIN_LABEL[t.type]} war – Ergebnis im Lead eintragen`
                : TERMIN_LABEL[t.type]
            }
          >
            {t.type === 'erstgespraech' ? 'EG' : t.type === 'strategiegespraech' ? 'SG' : 'Folge'}{' '}
            {fmtDatumKurz(t.scheduled_at)}
          </Chip>
        ) : null}
        {f?.due_at ? (
          <Chip
            ton={istFaellig(f.due_at, heute) ? 'overdue' : 'later'}
            className="font-mono"
            title={f.title ?? 'Follow-up'}
          >
            {fmtDatumKurz(f.due_at)} · {fmtZeit(f.due_at)}
          </Chip>
        ) : null}
      </span>
      {d.next_action_label ? (
        <span className="text-ink-3 mt-1.5 block truncate text-[12px]">{d.next_action_label}</span>
      ) : null}
    </button>
  )
}

export function Component() {
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useDeals()
  const meId = useMeId()
  const [wer, setWer] = useState<Wer>('alle')
  const heute = heuteBerlin()

  const deals = useMemo(
    () => (data ?? []).filter((d) => wer === 'alle' || d.owner_id === meId || d.sales_owner_id === meId),
    [data, wer, meId],
  )
  const spalten = useMemo(() => nachPhase(deals), [deals])
  const offen = deals.filter((d) => d.stage !== 'kunde' && d.stage !== 'beendet').length

  const oeffnen = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('lead', id)
    setParams(p, { replace: true })
  }

  return (
    <>
      <TelefonUnterNav />
      <SeitenKopf
        titel="Deal-Pipeline"
        kontext="ab Erstgespräch · Phase aus den Terminen"
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: offen, label: 'offen' },
                { wert: spalten.kunde.length, label: 'Kunden' },
              ]}
            />
            <Segment<Wer>
              ariaLabel="Wessen Deals"
              optionen={[
                { key: 'alle', label: 'Alle' },
                { key: 'meine', label: 'Meine' },
              ]}
              wert={wer}
              onChange={setWer}
            />
          </>
        }
      />

      {isError ? (
        <LadeFehler text="Deals konnten nicht geladen werden." onNochmal={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton zeilen={6} />
      ) : (
        <>
          <p className="text-small text-ink-3 mb-4 max-w-[70ch]">
            Karten wandern von selbst: Termin im Lead buchen, auf No-Show setzen oder als Kunde markieren – die Spalte
            folgt.
          </p>
          {/* ab 768 px: Spalten nebeneinander, die Leiste scrollt quer (nicht die Seite) */}
          <div className="-mx-1 overflow-x-auto px-1 pb-3 max-md:hidden" role="list" aria-label="Deal-Phasen">
            <div className="grid w-max auto-cols-[232px] grid-flow-col gap-3">
              {DEAL_PHASEN.map((p) => (
                <section
                  key={p.key}
                  role="listitem"
                  aria-label={p.label}
                  data-phase={p.key}
                  className="bg-sidebar flex min-h-[220px] flex-col rounded-md p-1.5"
                >
                  <header className="flex items-center gap-2 px-1.5 pt-1 pb-2" title={p.hinweis}>
                    <span className={cn('rounded-xs px-2 py-0.5 text-[12px] font-medium', KOPF_TON[p.key])}>
                      {p.label}
                    </span>
                    <span className="tnum text-ink-3 ml-auto font-mono text-[12px]">{spalten[p.key].length}</span>
                  </header>
                  <div className="grid gap-1.5">
                    {spalten[p.key].map((d) => (
                      <Karte key={d.id} d={d} heute={heute} onOeffnen={oeffnen} />
                    ))}
                    {spalten[p.key].length === 0 ? (
                      <span className="text-ink-3 px-1.5 py-2 text-[12px]">{p.hinweis}</span>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* iPhone: Phasen untereinander, leere ausgeblendet */}
          <div className="grid grid-cols-1 gap-5 md:hidden">
            {DEAL_PHASEN.filter((p) => spalten[p.key].length > 0).map((p) => (
              <section key={p.key} aria-label={p.label}>
                <h2 className="mb-2 flex items-center gap-2">
                  <span className={cn('rounded-xs px-2 py-0.5 text-[12px] font-medium', KOPF_TON[p.key])}>
                    {p.label}
                  </span>
                  <span className="tnum text-ink-3 font-mono text-[12px]">{spalten[p.key].length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-1.5">
                  {spalten[p.key].map((d) => (
                    <Karte key={d.id} d={d} heute={heute} onOeffnen={oeffnen} />
                  ))}
                </div>
              </section>
            ))}
            {deals.length === 0 ? <p className="text-ui text-ink-2">Noch kein Deal ab Erstgespräch.</p> : null}
          </div>
        </>
      )}
    </>
  )
}
