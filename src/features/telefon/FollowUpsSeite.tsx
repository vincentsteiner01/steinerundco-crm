// Telefon › Follow-ups (`/telefon/follow-ups`, 23.10.2026): Mikes „Follow-ups & nächste Schritte“ – alle offenen Rückrufe,
// Wiedervorlagen und Aufgaben plus geplante Termine, gruppiert Überfällig · Heute · Nächste 7 Tage · Später. Klick öffnet den Lead,
// „Anrufen“ den Anruf-Screen; erledigt wird wie gewohnt im Lead bzw. nach dem Anruf.
import { Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMeId, useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useFollowUps } from '@/data/telefonAnsichten'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { fmtTelefon } from '@/lib/telefon'
import { FOLLOWUP_GRUPPEN, followUpEintraege, followUpGruppe, type FollowUpEintrag } from './ansichten/logik'
import { TelefonUnterNav } from './ansichten/Teile'

type Wer = 'alle' | 'meine'

export function Component() {
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useFollowUps()
  const { data: settings } = useSettings()
  const { data: members } = useMembers()
  const meId = useMeId()
  const [wer, setWer] = useState<Wer>('alle')
  const heute = heuteBerlin()

  const eintraege = useMemo(
    () =>
      followUpEintraege(data?.aufgaben ?? [], data?.termine ?? []).filter((e) => wer === 'alle' || e.memberId === meId),
    [data, wer, meId],
  )
  const gruppen = useMemo(() => {
    const g = new Map<string, FollowUpEintrag[]>()
    for (const e of eintraege) {
      const k = followUpGruppe(e.zeit, heute)
      g.set(k, [...(g.get(k) ?? []), e])
    }
    return g
  }, [eintraege, heute])
  const name = (id: string | null) => {
    const m = members?.find((x) => x.id === id)
    return m ? anzeigeName(m) : ''
  }

  const oeffnen = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('lead', id)
    setParams(p, { replace: true })
  }

  return (
    <>
      <TelefonUnterNav />
      <SeitenKopf
        titel="Follow-ups"
        kontext="Rückrufe · Wiedervorlagen · Termine"
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: gruppen.get('ueberfaellig')?.length ?? 0, label: 'überfällig', ton: 'overdue' },
                { wert: gruppen.get('heute')?.length ?? 0, label: 'heute', ton: 'signal' },
              ]}
            />
            <Segment<Wer>
              ariaLabel="Wessen Follow-ups"
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
        <LadeFehler text="Follow-ups konnten nicht geladen werden." onNochmal={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton zeilen={6} />
      ) : eintraege.length === 0 ? (
        <p className="text-ui text-ink-2 py-6">Nichts offen – keine Rückrufe, Wiedervorlagen oder geplanten Termine.</p>
      ) : (
        <div className="grid gap-7">
          {FOLLOWUP_GRUPPEN.filter((g) => gruppen.get(g.key)?.length).map((g) => (
            <section key={g.key} aria-label={g.label} data-gruppe={g.key}>
              <h2 className="text-h3 text-ink mb-2.5 flex items-baseline gap-2">
                {g.label}
                <span className="tnum text-ink-3 font-mono text-[12px]">{gruppen.get(g.key)?.length}</span>
              </h2>
              <ul className="border-line divide-line divide-y rounded-md border">
                {(gruppen.get(g.key) ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="grid grid-cols-[136px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3.5 py-2.5 max-md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <span className="flex flex-wrap items-center gap-1.5 max-md:order-2">
                      {e.zeit ? (
                        <Chip
                          ton={g.key === 'ueberfaellig' ? 'overdue' : g.key === 'heute' ? 'today' : 'later'}
                          className="font-mono"
                        >
                          {g.key === 'heute' ? fmtZeit(e.zeit) : `${fmtDatumKurz(e.zeit)} · ${fmtZeit(e.zeit)}`}
                        </Chip>
                      ) : (
                        <Chip ton="later">ohne Datum</Chip>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => oeffnen(e.lead.id)}
                      className="min-w-0 text-left max-md:order-1 max-md:col-span-2"
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="text-ink-bright truncate font-medium">
                          {e.lead.full_name ?? e.lead.company_name ?? '–'}
                        </span>
                        <span className="text-small text-ink-3 truncate">{e.lead.company_name ?? ''}</span>
                      </span>
                      <span className="text-small text-ink-2 flex min-w-0 flex-wrap items-center gap-x-2">
                        <span className="font-medium">{e.label}</span>
                        {e.titel ? <span className="truncate">{e.titel}</span> : null}
                        {name(e.memberId) ? <span className="text-ink-3">· {name(e.memberId)}</span> : null}
                      </span>
                    </button>
                    <span className="flex items-center gap-2 max-md:order-3">
                      <span className="max-lg:hidden">
                        <StatusChip stage={e.lead.stage} settings={settings} />
                      </span>
                      {e.lead.phone_e164 ? (
                        <Link
                          to={PFADE.anruf(e.lead.id)}
                          title={fmtTelefon(e.lead.phone_e164)}
                          className="border-line-strong text-small text-ink hover:bg-surface-hover inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5"
                        >
                          <Phone size={14} strokeWidth={1.75} aria-hidden />
                          Anrufen
                        </Link>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
