// BAUPLAN § 3.3 `LeadSeite.tsx` (ux § 1.6, § 3.3.5, LD-12, LD-13): Vollseite mit Kopf, NaechsterSchritt + FelderRaster (breit), Kanal-Karten
// nebeneinander, Tabs (?tab=) Timeline · Notizen · Gespräche (Anrufe + Termine mit Status-Buttons; No-Show eines Erstgesprächs →
// Vorschlag-Toast „Sequenz ‚No-Show Erstgespräch‘ starten?“ ↵) · Rechtliches (Anrufgrund-/Erlaubnis-Historie, Datenschutz-Info,
// Widerspruch, Sperrlisten-Status, Firmensperre, „Auskunft exportieren (JSON)“).
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  Beenden,
  Freigeben,
  NotizFeld,
  TerminEintragen,
  Uebergeben,
  Uebernehmen,
  Wiedervorlage,
  WiderspruchErfassen,
} from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { useActivities } from '@/data/activities'
import { useCalls } from '@/data/calls'
import { useEnroll } from '@/data/enrollments'
import { zeigeFehler } from '@/data/errors'
import { useLead, useLeadUpdate } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useMeetings, useMeetingStatus } from '@/data/meetings'
import { useQueue } from '@/data/queue'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useTags } from '@/data/tags'
import { fmtDatum, fmtDatumZeit, fmtDauer } from '@/lib/format'
import { ERSTE_STAGE_DER_PHASE } from '@/lib/stufen'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { ANRUFGRUND_LABEL, ERGEBNIS_LABEL, ERLAUBNIS_LABEL } from '@/texte/de'
import type { Activity, LeadMitBezug, Meeting, MeetingStatus, PhaseKey } from '@/types/domain'
import { sperrlistenEintraege } from '@/lib/gates'
import { useLeadAktionen, type LeadAktion } from './aktionsBus'
import { exportLead } from './exportLead'
import { FelderRaster } from './FelderRaster'
import { EmailKarte } from './kanal/EmailKarte'
import { LinkedInKarte } from './kanal/LinkedInKarte'
import { TelefonKarte } from './kanal/TelefonKarte'
import { KopfAktionen, KopfChips } from './LeadKopf'
import { phasenAktion, queueItemFuer } from './detailLogik'
import { NaechsterSchritt } from './NaechsterSchritt'
import { noShowVorschlag } from './noShow'
import { ROLLE_LABEL } from './spalten'
import { Timeline } from './Timeline'
import { anzeigeName } from '@/lib/mitglied'

type TabKey = 'timeline' | 'notizen' | 'gespraeche' | 'rechtliches'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'notizen', label: 'Notizen' },
  { key: 'gespraeche', label: 'Gespräche' },
  { key: 'rechtliches', label: 'Rechtliches' },
]
const STATUS_LABEL: Record<MeetingStatus, string> = {
  geplant: 'geplant',
  stattgefunden: 'stattgefunden',
  no_show: 'No-Show',
  abgesagt: 'abgesagt',
  verschoben: 'verschoben',
}
const TYP_LABEL: Record<Meeting['type'], string> = {
  erstgespraech: 'Erstgespräch',
  strategiegespraech: 'Strategiegespräch',
  folgegespraech: 'Folgegespräch',
}

export function Component() {
  const { id } = useParams()
  const { data: lead, isPending, error } = useLead(id)
  if (isPending)
    return (
      <>
        <SeitenKopf titel="Lead" />
        <Skeleton zeilen={8} />
      </>
    )
  if (error || !lead)
    return (
      <>
        <SeitenKopf titel="Lead" />
        <EmptyState titel="Lead nicht gefunden." satz="Vielleicht im Papierkorb oder gelöscht." />
      </>
    )
  return <Vollseite lead={lead} />
}

function Vollseite({ lead }: { lead: LeadMitBezug }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const me = useMeId()
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'timeline') as TabKey
  const setTab = (k: TabKey) => {
    const p = new URLSearchParams(params)
    p.set('tab', k)
    setParams(p, { replace: true })
  }
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const { data: tags } = useTags()
  const { data: sperrliste } = useSperrliste()
  const { data: queue } = useQueue(lead.owner_id ?? null)
  const update = useLeadUpdate()
  // Kanalgenau: die Gates prüfen die Kanäle der Treffer (Integration: vorher sperrte jeder Treffer alle Kanäle)
  const treffer = sperrlistenEintraege(sperrliste, lead)
  const gesperrt = treffer.length > 0
  const [aktion, setAktion] = useState<LeadAktion | null>(null)
  const [terminTyp, setTerminTyp] = useState<'erstgespraech' | 'strategiegespraech'>('erstgespraech')
  useLeadAktionen(lead.id, (a) => setAktion(a))
  const item = queueItemFuer(queue, lead.id)

  const phaseWechsel = (ziel: PhaseKey) => {
    const a = phasenAktion(ziel)
    if (a === 'termin') setTerminTyp(ziel === 'strategiegespraech' ? 'strategiegespraech' : 'erstgespraech')
    if (a) return setAktion(a)
    void update.mutateAsync({
      id: lead.id,
      erwartetUpdatedAt: lead.updated_at,
      patch: { stage: ERSTE_STAGE_DER_PHASE[ziel] },
    })
  }
  // Kontrollierte Aktionen: Öffnen über den eigenen Button/die eigene Taste setzt die Aktion, Schließen räumt sie ab
  const umschalten = (a: LeadAktion) => (o: boolean) => setAktion(o ? a : null)
  const unsichtbar = <span className="sr-only" aria-hidden />
  const fremd = !!me && (lead.released || lead.owner_id !== me)

  return (
    <div data-lead-seite={lead.id}>
      <SeitenKopf
        titel={lead.full_name ?? '–'}
        kontext={
          [lead.company_name, lead.role !== 'unbekannt' ? ROLLE_LABEL[lead.role] : lead.role_title, lead.city]
            .filter(Boolean)
            .join(' · ') || 'Lead'
        }
        rechts={
          <>
            <Button variante="quiet" icon={ArrowLeft} onClick={() => navigate(-1)}>
              Zurück
            </Button>
            <KopfAktionen lead={lead} sperrliste={treffer} settings={settings} />
          </>
        }
      />
      <KopfChips
        lead={lead}
        members={members ?? []}
        settings={settings}
        tags={tags}
        sperrliste={treffer}
        onPhase={phaseWechsel}
        className="mb-5"
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1">
        <NaechsterSchritt lead={lead} item={item} kontext="peek" aktiv={false} sperrliste={treffer} />
        <div data-felder>
          <FelderRaster lead={lead} members={members ?? []} settings={settings} breit />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 max-xl:grid-cols-1" data-kanal-karten>
        <LinkedInKarte
          lead={lead}
          members={members ?? []}
          offen
          onToggle={() => undefined}
          immerOffen
          sperrliste={treffer}
        />
        <TelefonKarte lead={lead} offen onToggle={() => undefined} immerOffen sperrliste={treffer} />
        <EmailKarte lead={lead} offen onToggle={() => undefined} immerOffen sperrliste={treffer} settings={settings} />
      </div>
      <Tabs tabs={TABS} wert={tab} onChange={setTab} ariaLabel="Lead-Bereiche" className="mb-5" />
      <div className="max-w-[880px]">
        {tab === 'timeline' ? <Timeline leadId={lead.id} /> : null}
        {tab === 'notizen' ? (
          <>
            <div className="mb-4" data-notizfeld>
              <NotizFeld leadId={lead.id} aktiv bleibtOffen />
            </div>
            <Timeline leadId={lead.id} startFilter="notizen" ohneFilter mitNaechstes={false} />
          </>
        ) : null}
        {tab === 'gespraeche' ? <Gespraeche lead={lead} /> : null}
        {tab === 'rechtliches' ? <Rechtliches lead={lead} gesperrt={gesperrt} /> : null}
      </div>
      <div className="border-line mt-8 flex flex-wrap items-center gap-1.5 border-t pt-4">
        <Uebergeben
          leadId={lead.id}
          aktiv
          offen={aktion === 'uebergeben'}
          onOpenChange={umschalten('uebergeben')}
          trigger={aktion === 'uebergeben' ? unsichtbar : undefined}
        />
        <Freigeben
          leadId={lead.id}
          aktiv
          offen={aktion === 'freigeben'}
          onOpenChange={umschalten('freigeben')}
          trigger={aktion === 'freigeben' ? unsichtbar : undefined}
        />
        <Beenden leadId={lead.id} aktiv offen={aktion === 'beenden'} onOpenChange={umschalten('beenden')} />
        <Wiedervorlage
          leadId={lead.id}
          aktiv
          offen={aktion === 'wiedervorlage'}
          onOpenChange={umschalten('wiedervorlage')}
        />
        <TerminEintragen
          leadId={lead.id}
          aktiv
          typ={terminTyp}
          offen={aktion === 'termin'}
          onOpenChange={umschalten('termin')}
        />
        {fremd ? <Uebernehmen leadId={lead.id} aktiv /> : null}
      </div>
    </div>
  )
}

function Gespraeche({ lead }: { lead: LeadMitBezug }) {
  const { data: calls, isPending: callsLaden } = useCalls(lead.id, 100)
  const { data: meetings, isPending: meetingsLaden } = useMeetings(lead.id)
  const status = useMeetingStatus()
  const enroll = useEnroll()
  const { data: members } = useMembers()
  const name = (id: string | null) => {
    const m = id ? members?.find((x) => x.id === id) : null
    return anzeigeName(m, '–')
  }
  const setze = async (m: Meeting, s: MeetingStatus) => {
    try {
      await status.mutateAsync({ id: m.id, leadId: lead.id, status: s })
    } catch {
      return
    }
    toast(`${TYP_LABEL[m.type]} ${STATUS_LABEL[s]}.`)
    if (s === 'no_show' && m.type === 'erstgespraech')
      noShowVorschlag(() => {
        enroll
          .mutateAsync({ leadId: lead.id, sequenceKey: SEQUENZ.email_noshow_erstgespraech, memberId: lead.owner_id })
          .then(() => toast('Sequenz ‚No-Show Erstgespräch‘ gestartet.'))
          .catch(() => undefined)
      })
  }
  return (
    <div className="grid gap-6">
      <section>
        <h3 className="text-h3 mb-2.5">Termine</h3>
        {meetingsLaden ? <Skeleton zeilen={2} /> : null}
        {!meetingsLaden && (meetings ?? []).length === 0 ? (
          <p className="text-small text-ink-3">Noch kein Termin.</p>
        ) : null}
        <ul className="grid gap-2">
          {(meetings ?? []).map((m) => (
            <li
              key={m.id}
              className="border-line flex flex-wrap items-center gap-2 rounded-md border px-3.5 py-2.5"
              data-meeting={m.id}
            >
              <span className="text-ink text-[14px] font-medium">{TYP_LABEL[m.type]}</span>
              <span className="mono-sm text-ink-3">{fmtDatumZeit(m.scheduled_at)}</span>
              <span className="mono-sm text-ink-3">{m.duration_min} Min.</span>
              {m.location ? <span className="text-small text-ink-3">{m.location}</span> : null}
              <span className="text-small text-ink-3">{name(m.member_id)}</span>
              <Chip ton={m.status === 'geplant' ? 'later' : m.status === 'stattgefunden' ? 'done' : 'ended'}>
                {STATUS_LABEL[m.status]}
              </Chip>
              <span className="flex-1" />
              {m.status === 'geplant' ? (
                <span className="flex flex-wrap gap-1" role="group" aria-label={`Status ${TYP_LABEL[m.type]}`}>
                  <Button
                    variante="secondary"
                    groesse="S"
                    busy={status.isPending}
                    onClick={() => void setze(m, 'stattgefunden')}
                  >
                    Stattgefunden
                  </Button>
                  <Button variante="quiet" groesse="S" busy={status.isPending} onClick={() => void setze(m, 'no_show')}>
                    No-Show
                  </Button>
                  <Button
                    variante="quiet"
                    groesse="S"
                    busy={status.isPending}
                    onClick={() => void setze(m, 'abgesagt')}
                  >
                    Abgesagt
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2.5">Anrufe</h3>
        {callsLaden ? <Skeleton zeilen={2} /> : null}
        {!callsLaden && (calls ?? []).length === 0 ? <p className="text-small text-ink-3">Noch kein Anruf.</p> : null}
        <ul className="grid gap-1.5">
          {(calls ?? []).map((c) => (
            <li
              key={c.id}
              className="border-line grid grid-cols-[120px_1fr] gap-x-3 border-b py-2 text-[13px]"
              data-call={c.id}
            >
              <span className="mono-sm text-ink-3">{fmtDatumZeit(c.started_at)}</span>
              <span className="text-ink">
                {ERGEBNIS_LABEL[c.outcome] ?? c.outcome}
                {c.reached_name ? ` · ${c.reached_name}` : ''}
                {c.duration_sec ? ` · ${fmtDauer(c.duration_sec)}` : ''}
                {c.attempt_no ? ` · Versuch ${c.attempt_no}` : ''}
                <span className="mono-sm text-ink-3 ml-1.5">{name(c.member_id)}</span>
                {c.note ? (
                  <span className="text-ink-2 border-line-strong mt-1 block border-l pl-2.5">{c.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Rechtliches({ lead, gesperrt }: { lead: LeadMitBezug; gesperrt: boolean }) {
  const me = useMeId()
  const q = useActivities(lead.id, { types: ['einwilligung', 'widerspruch'] })
  const { data: members } = useMembers()
  const [laeuft, setLaeuft] = useState(false)
  const [zuletzt, setZuletzt] = useState<string | null>(null)
  const eintraege = q.data?.pages.flat() ?? []
  const kind = (a: Activity) =>
    a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
      ? ((a.metadata as { kind?: string }).kind ?? null)
      : null
  const anrufgruende = eintraege.filter((a) => a.type === 'einwilligung' && kind(a) === 'anrufgrund')
  const einwilligungen = eintraege.filter(
    (a) => a.type === 'einwilligung' && kind(a) !== 'anrufgrund' && kind(a) !== 'datenschutz',
  )
  const name = (id: string | null) => {
    const m = id ? members?.find((x) => x.id === id) : null
    return anzeigeName(m, 'System')
  }
  useEffect(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage()
  }, [q.hasNextPage, q.isFetchingNextPage, q])

  const exportieren = async () => {
    if (laeuft) return
    setLaeuft(true)
    try {
      const { dateiname } = await exportLead(lead.id, me)
      setZuletzt(dateiname)
      toast(`Auskunft exportiert – ${dateiname}.`)
    } catch (e) {
      zeigeFehler(e)
    }
    setLaeuft(false)
  }

  return (
    <div className="grid gap-6">
      <section>
        <h3 className="text-h3 mb-2">Anrufgrund-Historie</h3>
        <p className="text-small text-ink-2 mb-2">
          Aktuell: {lead.call_basis ? ANRUFGRUND_LABEL[lead.call_basis] : '–'}
          {lead.call_basis_note ? ` · ${lead.call_basis_note}` : ''}
        </p>
        {anrufgruende.length === 0 ? <p className="text-small text-ink-3">Noch kein Anrufgrund gesetzt.</p> : null}
        <ul className="grid gap-1">
          {anrufgruende.map((a) => (
            <li key={a.id} className="text-small text-ink">
              <span className="mono-sm text-ink-3 mr-2">{fmtDatum(a.occurred_at)}</span>
              {a.outcome ? (ANRUFGRUND_LABEL[a.outcome as keyof typeof ANRUFGRUND_LABEL] ?? a.outcome) : '–'}
              {a.note ? ` · ${a.note}` : ''}
              <span className="mono-sm text-ink-3 ml-2">{name(a.member_id)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Erlaubnis-Historie (E-Mail)</h3>
        <p className="text-small text-ink-2 mb-2">
          Aktuell: {ERLAUBNIS_LABEL[lead.email_consent_basis]}
          {lead.email_consent_at ? ` · ${fmtDatum(lead.email_consent_at)}` : ''}
          {lead.email_consent_note ? ` · ‚${lead.email_consent_note}‘` : ''}
        </p>
        {einwilligungen.length === 0 ? <p className="text-small text-ink-3">Noch kein Eintrag.</p> : null}
        <ul className="grid gap-1">
          {einwilligungen.map((a) => (
            <li key={a.id} className="text-small text-ink">
              <span className="mono-sm text-ink-3 mr-2">{fmtDatum(a.occurred_at)}</span>
              {a.outcome ? (ERLAUBNIS_LABEL[a.outcome as keyof typeof ERLAUBNIS_LABEL] ?? a.outcome) : 'Einwilligung'}
              {a.note ? ` · ‚${a.note}‘` : ''}
              <span className="mono-sm text-ink-3 ml-2">{name(a.member_id)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Datenschutz-Info</h3>
        <p className="text-small text-ink-2">
          {lead.privacy_notice_sent_at
            ? `Gesendet am ${fmtDatum(lead.privacy_notice_sent_at)}${lead.privacy_notice_version ? ` (${lead.privacy_notice_version})` : ''}`
            : 'Noch nicht gesendet.'}
        </p>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Widerspruch</h3>
        {lead.do_not_contact ? (
          <p className="text-small text-danger">
            Widerspruch{lead.objection_at ? ` am ${fmtDatum(lead.objection_at)}` : ''} ·{' '}
            {lead.do_not_contact_channels?.length ? lead.do_not_contact_channels.join(', ') : 'alle Kanäle'}
            {lead.objection_note ? ` · ‚${lead.objection_note}‘` : ''}
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-small text-ink-3">Kein Widerspruch.</p>
            <WiderspruchErfassen
              leadId={lead.id}
              trigger={
                <Button variante="quiet" groesse="S">
                  Widerspruch erfassen
                </Button>
              }
            />
          </div>
        )}
      </section>
      <section>
        <h3 className="text-h3 mb-2">Sperrliste und Firmensperre</h3>
        <div className="flex flex-wrap gap-1.5">
          {gesperrt ? <Chip ton="danger">Auf der Sperrliste</Chip> : <Chip ton="muted">Nicht auf der Sperrliste</Chip>}
          {lead.companies?.do_not_contact ? (
            <Chip ton="danger">Firma gesperrt – nicht anschreiben</Chip>
          ) : (
            <Chip ton="muted">Firma nicht gesperrt</Chip>
          )}
        </div>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Auskunft (Art. 15)</h3>
        <p className="text-small text-ink-2 mb-2">
          Lead, Firma, Aktivitäten, Anrufe, E-Mails, Termine, Aufgaben, Vernetzungen, Sequenzen und Tags als eine
          JSON-Datei. Der Export wird in der Timeline protokolliert.
        </p>
        <Button variante="secondary" busy={laeuft} onClick={() => void exportieren()}>
          Auskunft exportieren (JSON)
        </Button>
        {zuletzt ? <p className="mono-sm text-ink-3 mt-2">{zuletzt}</p> : null}
        <p className="text-small text-ink-3 mt-3">
          Löschfrist-Vorschau und Einwilligungsnachweis über alle Leads kommen in v1.1.
        </p>
      </section>
    </div>
  )
}
