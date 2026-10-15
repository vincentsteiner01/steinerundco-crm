// M3 – `/telefon/anruf/:leadId` (BAUPLAN § 3.4 AnrufScreen.tsx, DESIGN-SYSTEM § 5.13, ux § 2.5 Schritt 2–3, § 3.5.2, § 5.4, § 7.5):
// Kopfzeile, drei Spalten 300 · 1fr · 320, Ergebnisleiste sticky, Wrap-up-Zeile; mobil einspaltig + Ergebnis-Modus (`?ergebnis=`).
// Scope `anruf` sperrt J/K und G-Akkorde (lib/keyboard). Ergebnis-Pflicht: Verlassen ohne Ergebnis fragt (useBlocker, T-04).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCalls, useCallsHeute } from '@/data/calls'
import { useLead } from '@/data/leads'
import { useMe, useMeId } from '@/data/members'
import { useSequences } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useTemplates } from '@/data/templates'
import { fmtDauer, fmtZeit } from '@/lib/format'
import { sperrlistenEintraege, telefonGate, type TelefonGate } from '@/lib/gates'
import { istEingabe, useHotkeyScope, useHotkeys } from '@/lib/keyboard'
import { fuellen, type PlatzhalterKontext } from '@/lib/platzhalter'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { berlinTag, tagPlus, tagZuDate } from '@/lib/zeit'
import { ANRUFGRUND_LABEL, DIALOG, GATE_GRUND_LABEL } from '@/texte/de'
import { useIstTelefon } from '@/lib/useMediaQuery'
import type { CallOutcome } from '@/types/domain'
import { AnrufgrundSetzen } from './AnrufgrundSetzen'
import { AnrufMitte } from './AnrufMitte'
import {
  blockDauerSec,
  blockHinweisFaellig,
  blockHinweisGezeigt,
  blockNaechster,
  blockPositionSetzen,
  blockUeberspringen,
  blockZeit,
  useCallBlock,
} from './CallBlock'
import { useCallOutcomeDefs } from '@/data/calls'
import { ScopeFormular } from '@/components/ui/ScopeFormular'
import { internesZiel } from '@/lib/url'
import { Ergebnisleiste } from './Ergebnisleiste'
import {
  ERGEBNIS_TASTEN,
  ergebnisNachOutcome,
  ergebnisNachTaste,
  ergebnisseMit,
  WRAPUP_LEER,
  type ErgebnisTaste,
  type WrapUpWerte,
} from './ergebnisse'
import { WIEDERHOLUNG_OUTCOMES, wrapUpVorbelegung } from './kadenz'
import { Kontext } from './Kontext'
import { Skript } from './Skript'
import { naechsterTab, skriptVorlagen, startTab, type SkriptTab } from './skriptLogik'
import { folgeText, useAnruf, type AnrufVorschlag } from './useAnruf'
import { WrapUp } from './WrapUp'
import { blockZusammenfassung } from './zusammenfassung'

const sicheresZiel = (z: string | null): string => internesZiel(z, PFADE.telefon)

export function Component() {
  const { leadId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const me = useMe()
  const meId = useMeId()
  const { data: lead, isPending, isError } = useLead(leadId)
  const { data: settings } = useSettings()
  const { data: templates } = useTemplates({ channel: 'telefon', active: true })
  const { data: defs } = useCallOutcomeDefs()
  const { data: calls } = useCalls(leadId, 20)
  const { data: callsHeute } = useCallsHeute(meId)
  const { data: sequenzen } = useSequences()
  const { data: sperrliste } = useSperrliste()
  const block = useCallBlock()
  const online = useUiStore((s) => s.online)
  const mobil = useIstTelefon()
  useHotkeyScope('anruf')

  const ergebnisse = useMemo(() => ergebnisseMit(defs), [defs])
  // Telefon-Gate (§ 8.2 Nr. 2) vor allen Tasten berechnen: zu → kein Wählen, keine Ergebnis-Tasten, kein Speichern (Review –
  // vorher nur ein Banner, Enter/`tel:`/Ergebnisse blieben aktiv; log_call prüft serverseitig nur do_not_contact und Firmensperre)
  const gate: TelefonGate = useMemo(
    () => (lead ? telefonGate(lead, sperrlistenEintraege(sperrliste, lead)) : { erlaubt: false }),
    [lead, sperrliste],
  )
  const gateGrund = gate.erlaubt ? null : gate.grund ? GATE_GRUND_LABEL[gate.grund] : 'Nicht anrufbar'
  const anrufenLink = useRef<HTMLAnchorElement | null>(null)
  const maxVersuche = settings?.telefon.max_attempts ?? 5
  const enrollment = useMemo(
    () =>
      lead?.enrollments.find((e) => e.channel === 'telefon' && (e.status === 'aktiv' || e.status === 'pausiert')) ??
      null,
    [lead],
  )
  const taskParam = params.get('task')
  const task = useMemo(() => {
    if (!lead) return null
    const offen = lead.tasks.filter((t) => t.kind === 'rueckruf' && t.status === 'offen')
    if (taskParam) return offen.find((t) => t.id === taskParam) ?? null
    const grenze = tagZuDate(tagPlus(berlinTag(new Date()), 1), '00:00').getTime()
    return (
      offen.filter((t) => new Date(t.due_at).getTime() < grenze).sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ??
      null
    )
  }, [lead, taskParam])
  const versuch =
    enrollment?.current_position ??
    (calls ?? []).filter((c) => ergebnisNachOutcome(c.outcome, ergebnisse)?.zaehltVersuch).length + 1

  const telefonSeq = sequenzen?.find((s) => s.key === SEQUENZ.telefon_standard)
  const kadenz = useMemo(
    () => ({
      feiertage: settings?.feiertage,
      dueTime: settings?.queue.due_time,
      delays: telefonSeq
        ? [...telefonSeq.steps].sort((a, b) => a.position - b.position).map((s) => s.delay_days)
        : undefined,
      slots: settings?.telefon.slots,
      maxVersuche,
    }),
    [settings, telefonSeq, maxVersuche],
  )

  // Skript
  const [tabGewaehlt, setTab] = useState<SkriptTab | null>(null)
  const [vorlageId, setVorlageId] = useState<string | null>(null)
  const [skriptZu, setSkriptZu] = useState(true)
  const anrufBasis = useAnruf(leadId, {
    lead,
    enrollmentId: enrollment?.id ?? null,
    taskId: task?.id ?? null,
    task,
    templateId: null,
    fromNumber: me?.caller_number_e164 ?? null,
    kadenz,
    busyMinuten: settings?.telefon.busy_retry_minutes,
    versuch,
  })
  const tab = tabGewaehlt ?? startTab(lead?.phone_type, versuch, anrufBasis.laeuft)
  const vorlagen = useMemo(
    () => skriptVorlagen(templates ?? [], tab, { callBasis: lead?.call_basis, versuch }),
    [templates, tab, lead, versuch],
  )
  const aktiveVorlage = vorlagen.find((t) => t.id === vorlageId) ?? vorlagen[0] ?? null
  const mailboxVorlage = useMemo(
    () => skriptVorlagen(templates ?? [], 'mailbox', { versuch })[0] ?? null,
    [templates, versuch],
  )
  const datenschutzVorlage = useMemo(() => skriptVorlagen(templates ?? [], 'datenschutz')[0] ?? null, [templates])
  const ctx = useMemo<PlatzhalterKontext>(() => ({ me: me ?? null }), [me])

  const anruf = useMemo(
    () => ({
      ...anrufBasis,
      anrufen: () => {
        anrufBasis.anrufen()
        if (versuch === 2 || versuch === 4) setTab('mailbox')
      },
    }),
    [anrufBasis, versuch],
  )

  // Wrap-up
  const def = anruf.ergebnis ? ergebnisNachTaste(anruf.ergebnis, ergebnisse) : null
  const [werte, setWerte] = useState<WrapUpWerte>(WRAPUP_LEER)
  const [versucht, setVersucht] = useState(false)
  const [nach, setNach] = useState<{ text: string; vorschlag: AnrufVorschlag } | null>(null)
  const [verwerfenOffen, setVerwerfenOffen] = useState(false)
  const [zweiStunden, setZweiStunden] = useState(false)
  const fertig = useRef(false)
  const notizRef = useRef<HTMLTextAreaElement | null>(null)
  const defTaste = def?.taste ?? null
  useEffect(() => {
    if (!def || !lead) return
    setWerte(wrapUpVorbelegung(def, lead, settings))
    setVersucht(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defTaste, lead?.id])

  // `?ergebnis=<outcome>` (Schnell-Ergebnis der Heute-Karte: no_answer · busy · voicemail · callback_scheduled, BAUPLAN § 3.2),
  // auch `?ergebnis=<Taste>` · `?ergebnis=modus` (mobil nach Rückkehr). Vorher galt nur die Taste – „NO_ANSWER“ fiel weg (Review).
  const ergebnisParam = params.get('ergebnis')
  useEffect(() => {
    if (!ergebnisParam || !lead || anruf.ergebnis || !gate.erlaubt) return
    const t = ergebnisParam.toUpperCase()
    const vorgabe = ERGEBNIS_TASTEN.includes(t as ErgebnisTaste)
      ? ergebnisNachTaste(t as ErgebnisTaste, ergebnisse)
      : ergebnisNachOutcome(ergebnisParam as CallOutcome, ergebnisse)
    if (vorgabe) anruf.ergebnisSetzen(vorgabe.taste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ergebnisParam, lead?.id, gate.erlaubt])
  const ergebnisModus = mobil && (!!ergebnisParam || !!anruf.ergebnis)
  useEffect(() => {
    if (!mobil) return
    const h = () => {
      if (document.visibilityState === 'visible' && anruf.laeuft && !params.get('ergebnis')) {
        const next = new URLSearchParams(params)
        next.set('ergebnis', 'modus')
        setParams(next, { replace: true })
      }
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [mobil, anruf.laeuft, params, setParams])

  // Block: Position, Timer, 2-h-Hinweis
  useEffect(() => {
    if (block && block.listeIds.includes(leadId)) blockPositionSetzen(block, leadId)
  }, [block, leadId])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (block && blockHinweisFaellig(block)) setZweiStunden(true)
  }, [block, tick])

  const zurueck = sicheresZiel(params.get('zurueck'))
  const naechster = useCallback(() => {
    fertig.current = true
    if (block) {
      const n = blockNaechster(block, leadId)
      if (n) {
        navigate(`${PFADE.anruf(n)}?block=${block.id}&zurueck=${encodeURIComponent(zurueck)}`, { replace: true })
        return
      }
      navigate(`${PFADE.telefon}?block=ende`)
      return
    }
    navigate(zurueck)
  }, [block, leadId, navigate, zurueck])

  const weiter = useCallback(
    async (ohne = false) => {
      if (!def || anruf.istSpeichern || !gate.erlaubt) return
      setVersucht(true)
      if (def.outcome === 'voicemail_left' && mailboxVorlage && !anruf.entwurf?.templateId)
        anruf.vorlageSetzen(mailboxVorlage.id)
      const r = await anruf.speichern(def, werte, ohne)
      if (!r) return
      const teile = [`Anruf · ${def.kurz}`]
      if (def.zaehltVersuch) teile.push(`Versuch ${r.call.attempt_no ?? versuch}/${maxVersuche}`)
      teile.push(fmtDauer(r.call.duration_sec ?? 0))
      const folge = WIEDERHOLUNG_OUTCOMES.has(def.outcome) || def.outcome === 'busy' ? ` – ${r.text}` : ''
      toast(`${teile.join(' · ')}${folge}.`)
      if (r.vorschlag) {
        setNach({ text: r.text, vorschlag: r.vorschlag })
        return
      }
      naechster()
    },
    [def, anruf, werte, mailboxVorlage, versuch, maxVersuche, naechster, gate.erlaubt],
  )

  const ueberspringen = useCallback(() => {
    if (anruf.laeuft) {
      toast('Anruf läuft – erst Ergebnis eintragen oder mit Esc verwerfen.')
      return
    }
    fertig.current = true
    if (block) {
      const { naechster: n } = blockUeberspringen(block, leadId)
      if (n && n !== leadId)
        navigate(`${PFADE.anruf(n)}?block=${block.id}&zurueck=${encodeURIComponent(zurueck)}`, { replace: true })
      else navigate(`${PFADE.telefon}?block=ende`)
      return
    }
    navigate(zurueck)
  }, [anruf.laeuft, block, leadId, navigate, zurueck])

  const verwerfen = useCallback(() => {
    anruf.verwerfen()
    fertig.current = true
    setVerwerfenOffen(false)
  }, [anruf])

  // Ergebnis-Pflicht (T-04): Navigation weg vom Screen fragt, solange ein Anruf ohne Ergebnis läuft
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      anruf.laeuft && !fertig.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    fertig.current = false
  }, [leadId])

  useHotkeys(
    'anruf',
    {
      enter: (e) => {
        if (istEingabe(e.target as Element | null)) return
        if (nach) naechster()
        else if (!gate.erlaubt) return
        // Enter wählt wie der Klick: `tel:`-Link + Timer + 2-s-Hinweis „Kein Telefon verbunden?“ (Review: vorher nur der Timer)
        else if (!anruf.laeuft) anrufenLink.current?.click()
        else if (def) void weiter(false)
      },
      'mod+enter': () => {
        if (nach) naechster()
        else if (def) void weiter(true)
      },
      escape: (e) => {
        if (istEingabe(e.target as Element | null)) return
        if (anruf.laeuft) setVerwerfenOffen(true)
        else navigate(zurueck)
      },
      n: () => notizRef.current?.focus(),
      tab: (e) => {
        e.preventDefault()
        setTab(naechsterTab(tab, 1))
      },
      'shift+tab': (e) => {
        e.preventDefault()
        setTab(naechsterTab(tab, -1))
      },
      'mod+shift+x': ueberspringen,
      ...Object.fromEntries(
        ergebnisse.map((erg) => [
          erg.taste.toLowerCase(),
          () => {
            if (nach || !gate.erlaubt) return
            anruf.ergebnisSetzen(erg.taste)
          },
        ]),
      ),
    },
    [anruf, def, weiter, nach, naechster, tab, ueberspringen, zurueck, ergebnisse, gate.erlaubt],
  )

  if (isPending && !lead) return <Skeleton zeilen={6} />
  if (isError || !lead) {
    return (
      <>
        <SeitenKopf titel="Anruf" />
        <EmptyState
          titel="Lead nicht gefunden."
          satz="Vielleicht gelöscht oder die Adresse stimmt nicht."
          primaer={{ label: 'Zur Anrufliste', onClick: () => navigate(PFADE.telefon) }}
        />
      </>
    )
  }

  const heuteZ = blockZusammenfassung(callsHeute ?? [], defs)
  const fortschritt = block
    ? { nummer: Math.max(1, block.listeIds.indexOf(leadId) + 1), gesamt: block.listeIds.length }
    : null
  const datenschutzText = datenschutzVorlage ? fuellen(datenschutzVorlage.body, lead, ctx).text : null
  const weiterGrund = !online ? 'Offline – Ergebnis wird nach dem Reconnect gesendet' : undefined
  const fehlt = def ? anruf.fehlt(def, werte) : []

  const kopfRechts = block ? (
    <>
      <Button variante="quiet" kbd="⌘⇧X" onClick={ueberspringen}>
        Überspringen
      </Button>
      <Button variante="secondary" onClick={() => navigate(`${PFADE.telefon}?block=ende`)}>
        Block beenden
      </Button>
    </>
  ) : (
    <Button variante="quiet" kbd="Esc" onClick={() => (anruf.laeuft ? setVerwerfenOffen(true) : navigate(zurueck))}>
      Zur Liste
    </Button>
  )

  const ergebnisBereich = nach ? (
    <div role="status" className="border-line-strong grid gap-3 rounded-md border px-3.5 py-3" data-testid="nach-anruf">
      <span className="text-ui">{nach.text}</span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button variante="secondary" onClick={() => navigate(nach.vorschlag.pfad)}>
          {nach.vorschlag.label}
        </Button>
        <Button variante="primary" kbd="↵" onClick={naechster}>
          Weiter
        </Button>
      </div>
    </div>
  ) : (
    <>
      <Ergebnisleiste
        ergebnisse={ergebnisse}
        gewaehlt={gate.erlaubt ? anruf.ergebnis : null}
        onWaehlen={(erg) => gate.erlaubt && anruf.ergebnisSetzen(erg.taste)}
        gross={ergebnisModus}
        disabled={!gate.erlaubt}
      />
      {def && gate.erlaubt ? (
        <WrapUp
          leadId={lead.id}
          leadName={lead.full_name ?? ''}
          def={def}
          werte={werte}
          onChange={setWerte}
          fehlt={fehlt}
          versucht={versucht}
          folgeText={folgeText(
            def,
            { task, kadenz, busyMinuten: settings?.telefon.busy_retry_minutes, versuch },
            anruf.entwurf?.startedAt ?? new Date().toISOString(),
          )}
          onWeiter={() => void weiter(false)}
          onWeiterOhne={() => void weiter(true)}
          onAbbrechen={() => anruf.ergebnisSetzen(null)}
          busy={anruf.istSpeichern}
          weiterDisabledGrund={weiterGrund}
          gross={ergebnisModus}
        />
      ) : null}
    </>
  )

  return (
    <div data-anruf-screen data-modus={ergebnisModus ? 'ergebnis' : 'anruf'}>
      <SeitenKopf
        titel="Anruf"
        kontext={`Telefon${block ? ` · Call-Block seit ${fmtZeit(block.start)}` : ''}`}
        rechts={kopfRechts}
      />

      <div
        className="border-line text-ink-3 tnum mb-6 flex h-10 flex-wrap items-center gap-4 border-b font-mono text-[12.5px] tracking-[0.02em]"
        data-testid="callbar"
      >
        {fortschritt ? (
          <span>
            Anruf <b className="text-ink font-medium">{fortschritt.nummer}</b> von{' '}
            <b className="text-ink font-medium">{fortschritt.gesamt}</b>
          </span>
        ) : null}
        {block ? (
          <span>
            Block <b className="text-ink font-medium">{blockZeit(blockDauerSec(block))}</b>
          </span>
        ) : null}
        <span>
          Heute: <b className="text-ink font-medium">{heuteZ.dials}</b> Dials ·{' '}
          <b className="text-ink font-medium">{heuteZ.erreicht}</b> Erreicht ·{' '}
          <b className="text-ink font-medium">{heuteZ.entscheider}</b> Entscheider ·{' '}
          <b className="text-ink font-medium">{heuteZ.termine}</b> Termine
        </span>
        <span className="flex-1" />
        {!online ? <Chip ton="overdue">offline – wird nachgetragen</Chip> : null}
      </div>

      {!gate.erlaubt ? (
        <div
          role="alert"
          className="border-line-strong text-ui mb-4 flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5"
        >
          <Chip ton="danger">{gateGrund}</Chip>
          <span className="text-ink-2 flex-1">
            Dieser Lead ist nicht anrufbar – Anrufen und Ergebnisse sind gesperrt
            {gate.grund === 'kein_anrufgrund' ? ', bis ein Anrufgrund gesetzt ist' : ''}.
          </span>
          {gate.grund === 'kein_anrufgrund' ? <AnrufgrundSetzen lead={lead} /> : null}
        </div>
      ) : null}

      {ergebnisModus ? (
        <div className="grid gap-5">
          <div>
            <h2 className="lead-name">{lead.full_name}</h2>
            <p className="text-ink-2 text-[13.5px]">{lead.company_name}</p>
            {lead.call_basis ? <Chip className="mt-2">Anrufgrund · {ANRUFGRUND_LABEL[lead.call_basis]}</Chip> : null}
          </div>
          <AnrufMitte
            lead={lead}
            anruf={anruf}
            notizRef={notizRef}
            datenschutzText={datenschutzText}
            privacyVersion={settings?.email.privacy_notice_version ?? 'v1.0'}
            gross
            gesperrtGrund={gateGrund}
            anrufenRef={anrufenLink}
          />
          <Skript
            templates={templates ?? []}
            lead={lead}
            ctx={ctx}
            versuch={versuch}
            tab={tab}
            onTab={setTab}
            vorlageId={aktiveVorlage?.id ?? null}
            onVorlage={setVorlageId}
            eingeklappt={skriptZu}
            onToggle={() => setSkriptZu((z) => !z)}
          />
          {ergebnisBereich}
        </div>
      ) : (
        <>
          <div
            className={cn('grid items-start gap-8', 'grid-cols-[300px_minmax(0,1fr)_320px] max-[1180px]:grid-cols-1')}
          >
            <Kontext lead={lead} versuch={versuch} maxVersuche={maxVersuche} />
            <AnrufMitte
              lead={lead}
              anruf={anruf}
              notizRef={notizRef}
              datenschutzText={datenschutzText}
              privacyVersion={settings?.email.privacy_notice_version ?? 'v1.0'}
              gross={mobil}
              gesperrtGrund={gateGrund}
              anrufenRef={anrufenLink}
            />
            <Skript
              templates={templates ?? []}
              lead={lead}
              ctx={ctx}
              versuch={versuch}
              tab={tab}
              onTab={setTab}
              vorlageId={aktiveVorlage?.id ?? null}
              onVorlage={setVorlageId}
              eingeklappt={mobil ? skriptZu : false}
              onToggle={mobil ? () => setSkriptZu((z) => !z) : undefined}
            />
          </div>
          <div className="bg-canvas border-line sticky bottom-0 z-10 mt-7 grid gap-2.5 border-t pt-3 pb-2">
            {ergebnisBereich}
          </div>
        </>
      )}

      <Dialog
        offen={verwerfenOffen || blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o) {
            setVerwerfenOffen(false)
            if (blocker.state === 'blocked') blocker.reset()
          }
        }}
        titel={DIALOG.anrufVerwerfen.text}
        text={DIALOG.anrufVerwerfen.hinweis}
        abbrechen={DIALOG.anrufVerwerfen.behalten}
        primaer={{
          label: DIALOG.anrufVerwerfen.primaer,
          danger: true,
          onClick: () => {
            verwerfen()
            if (blocker.state === 'blocked') blocker.proceed()
            else navigate(zurueck)
          },
        }}
        kinder={<ScopeFormular />}
      />

      {block && zweiStunden ? (
        <Dialog
          offen
          onOpenChange={(o) => {
            if (!o) {
              blockHinweisGezeigt(block)
              setZweiStunden(false)
            }
          }}
          titel="2 Stunden – weitermachen oder beenden?"
          text={`Der Call-Block läuft seit ${fmtZeit(block.start)}.`}
          abbrechen="Weitermachen"
          primaer={{
            label: 'Block beenden',
            onClick: () => {
              blockHinweisGezeigt(block)
              setZweiStunden(false)
              navigate(`${PFADE.telefon}?block=ende`)
            },
          }}
          kinder={<ScopeFormular />}
        />
      ) : null}
    </div>
  )
}
