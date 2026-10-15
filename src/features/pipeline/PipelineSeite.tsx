// BAUPLAN § 3.3 `PipelineSeite.tsx` (ux § 3.4, DESIGN-SYSTEM § 5.12, P-01 … P-07): Kanban mit 10 Spalten (PHASEN aus lib/stufen),
// Angefragt · Wiedervorlage · Beendet eingeklappt (localStorage), Filter (Zuständig · Kanal · Tag · Suche) in der URL, Spaltenkopf
// (Zähler · Konversion zur Vorstufe aus dem Bestand · Ø Tage aus v_pipeline_counts), dnd-kit-Drag mit Drop-Regeln (dropRegeln.ts),
// Pflicht-Popovers (Termin · Grund · Datum · Vertragsabschluss), Tastatur J K H L ⇧→ ⇧← ↵. Ein Drop ändert nie Zuständig.
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { Beenden, TerminEintragen, Wiedervorlage } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNotizErstellen } from '@/data/activities'
import { useCompanies } from '@/data/companies'
import { useLeadsUnendlich, useLeadUpdate, usePipelineCounts, type LeadListenZeile } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useTags } from '@/data/tags'
import { useUndo } from '@/data/undo'
import { ansichtNachKey, sperrlistenTreffer } from '@/features/leads/ansichten'
import { effektiverFilter, filterAusUrl, filterInUrl, type UrlFilter } from '@/features/leads/filter'
import { useStabileListe } from '@/features/leads/hilfen'
import { istFrei, mitFirmensperre, type LeadZeile } from '@/features/leads/spalten'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { PHASEN, phaseNachKey, phaseVon, type Phase } from '@/lib/stufen'
import type { Channel, LeadStage, PhaseKey } from '@/types/domain'
import { stufenwechselAlsPipeline } from './daten/stufenwechsel'
import { brauchtDialog, dropRegel, istGleichePhase, istRueckwaerts, nachbarPhase, type DropAktion } from './dropRegeln'
import { Karte } from './Karte'
import { konversion, liesEingeklappt, schreibeEingeklappt, sortiereSpalte } from './logik'
import { Spalte, type SpaltenKopf } from './Spalte'
import { dragEnde, useDragSensoren } from './useDrag'
import { useBoardHoehe } from './useBoardHoehe'
import { usePipelineHotkeys, type PipelineCursor } from './usePipelineHotkeys'

type Offen = { leadId: string; aktion: DropAktion; von: LeadStage } | null

export function Component() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const me = useMeId()
  const heute = heuteBerlin()
  const overrides = useMemo(() => filterAusUrl(params), [params])
  const filter = useMemo(
    () => effektiverFilter(ansichtNachKey('alle'), { ...overrides, gruppe: undefined, sort: undefined }),
    [overrides],
  )
  const setOverrides = useCallback(
    (n: UrlFilter) => setParams(filterInUrl(n, params), { replace: true }),
    [params, setParams],
  )

  const geladen = useLeadsUnendlich(filter)
  const leads = useStabileListe(geladen.data)
  const { istLaden, fehler } = geladen
  const { data: counts } = usePipelineCounts()
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const { data: tags } = useTags()
  const { data: companies } = useCompanies()
  const { data: sperrliste } = useSperrliste()
  const update = useLeadUpdate()
  const notiz = useNotizErstellen()
  const { anbieten } = useUndo()
  const setPeekListe = useUiStore((s) => s.setPeekListe)

  const gesperrteFirmen = useMemo(
    () => new Set((companies ?? []).filter((c) => c.do_not_contact).map((c) => c.id)),
    [companies],
  )
  const rows = useMemo<LeadZeile[]>(
    () =>
      leads.map((l) =>
        mitFirmensperre(
          l,
          // Embed aus der Liste (M0), sonst über useCompanies
          (l as LeadListenZeile).companies?.do_not_contact ?? (!!l.company_id && gesperrteFirmen.has(l.company_id)),
          sperrlistenTreffer(l, sperrliste ?? []),
        ),
      ),
    [leads, gesperrteFirmen, sperrliste],
  )
  const [suche, setSuche] = useState(overrides.q ?? '')
  useEffect(() => setSuche(overrides.q ?? ''), [overrides.q])
  useEffect(() => {
    if ((overrides.q ?? '') === suche.trim()) return
    const t = setTimeout(() => setOverrides({ ...overrides, q: suche.trim() || undefined }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suche])

  const spalten = useMemo(
    () =>
      PHASEN.map((p) => ({
        phase: p,
        leads: sortiereSpalte(rows.filter((l) => phaseVon(l.stage).key === p.key)),
      })),
    [rows],
  )
  const zaehler = spalten.map((s) => s.leads.length)
  const owner = Array.isArray(filter.zustaendig) ? filter.zustaendig[0] : filter.zustaendig === 'me' ? me : null
  const tage = (p: Phase): number | null => {
    const zeilen = (counts ?? []).filter(
      (c) => c.stage && p.stages.includes(c.stage) && (!owner || c.owner_id === owner),
    )
    const n = zeilen.reduce((a, z) => a + (z.leads ?? 0), 0)
    if (!n) return null
    return zeilen.reduce((a, z) => a + (z.tage_in_stufe ?? 0) * (z.leads ?? 0), 0) / n
  }

  const [eingeklappt, setEingeklappt] = useState<Set<PhaseKey>>(() => liesEingeklappt())
  const toggle = (k: PhaseKey) =>
    setEingeklappt((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      schreibeEingeklappt(n)
      return n
    })

  // ── Cursor ↔ Peek: Liste für ←/→ im Peek, Cursor folgt ?lead=, bei offenem Peek folgt ?lead= dem Cursor (J/K wechseln den Lead) ──
  const [cursor, setCursorState] = useState<PipelineCursor>({ spalte: 'vernetzt', leadId: null })
  useEffect(() => {
    setPeekListe(spalten.flatMap((s) => s.leads.map((l) => l.id)))
  }, [spalten, setPeekListe])
  const peekLeadId = params.get('lead')
  useEffect(() => {
    if (!peekLeadId) return
    const l = rows.find((x) => x.id === peekLeadId)
    if (!l) return
    const spalte = phaseVon(l.stage).key
    setCursorState((c) => (c.leadId === l.id && c.spalte === spalte ? c : { spalte, leadId: l.id }))
  }, [peekLeadId, rows])
  const setCursor = useCallback(
    (c: PipelineCursor) => {
      setCursorState(c)
      if (c.leadId && params.get('lead') && params.get('lead') !== c.leadId) {
        const p = new URLSearchParams(params)
        p.set('lead', c.leadId)
        setParams(p, { replace: true })
      }
    },
    [params, setParams],
  )
  const oeffnePeek = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('lead', id)
    setParams(p, { replace: true })
  }

  // ── Drop ausführen ──
  const [offen, setOffen] = useState<Offen>(null)
  const [kundeDatum, setKundeDatum] = useState<string | null>(null)
  const [aktiv, setAktiv] = useState<LeadZeile | null>(null)
  const sensoren = useDragSensoren()
  const phasenLabel = (k: PhaseKey) => phaseNachKey(k).label
  const verschiebe = async (lead: LeadZeile, ziel: PhaseKey) => {
    if (istGleichePhase(lead.stage, ziel)) return
    const aktion = dropRegel(ziel)
    if (brauchtDialog(aktion)) {
      setKundeDatum(heute)
      setOffen({ leadId: lead.id, aktion, von: lead.stage })
      return
    }
    if (aktion.art !== 'stage') return
    try {
      // Nur `stage` – ein Drop ändert nie `owner_id` (P-06)
      await update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { stage: aktion.stage } })
    } catch {
      return
    }
    const text = `${istRueckwaerts(lead.stage, ziel) ? 'Phase zurückgesetzt' : 'Phase geändert'}: ${phaseVon(lead.stage).label} → ${phasenLabel(ziel)}.`
    const beleg = await stufenwechselAlsPipeline(lead.id).catch(() => null)
    if (beleg) anbieten(beleg.id, text, lead.id)
    else toast(text)
  }
  const onDragStart = (e: DragStartEvent) => setAktiv(rows.find((r) => r.id === String(e.active.id)) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setAktiv(null)
    const d = dragEnde(e)
    if (!d) return
    const lead = rows.find((r) => r.id === d.leadId)
    if (lead) void verschiebe(lead, d.ziel)
  }
  const kundeBestaetigen = async () => {
    if (!offen || !kundeDatum) return
    const lead = rows.find((r) => r.id === offen.leadId)
    if (!lead) return
    try {
      await update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { stage: 'kunde' } })
    } catch {
      return
    }
    await stufenwechselAlsPipeline(lead.id).catch(() => null)
    try {
      await notiz.mutateAsync({ leadId: lead.id, note: `Vertragsabschluss am ${fmtDatum(kundeDatum)}` })
    } catch {
      /* Toast aus der Mutation – die Stufe ist gesetzt */
    }
    toast(`Kunde – Vertragsabschluss am ${fmtDatum(kundeDatum)}.`)
    setOffen(null)
  }

  usePipelineHotkeys({
    spalten: spalten.map((s) => ({
      key: s.phase.key,
      ids: s.leads.map((l) => l.id),
      eingeklappt: eingeklappt.has(s.phase.key),
    })),
    cursor,
    setCursor,
    onEnter: oeffnePeek,
    onVerschieben: (leadId, richtung) => {
      const lead = rows.find((r) => r.id === leadId)
      if (!lead) return
      const ziel = nachbarPhase(lead.stage, richtung)
      if (ziel) void verschiebe(lead, ziel)
    },
    aktiv: !offen,
  })

  // Board bis zum Fensterende, Spalten scrollen einzeln (Runde 2); der Cursor (J/K/H/L) bleibt in seiner Spalte sichtbar
  const board = useRef<HTMLDivElement | null>(null)
  const boardBereit = !(istLaden && rows.length === 0 && !fehler)
  const hoehe = useBoardHoehe(board, boardBereit)
  useEffect(() => {
    if (!cursor.leadId) return
    board.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(cursor.leadId)}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [cursor.leadId])

  const zustaendigWert = Array.isArray(filter.zustaendig) ? 'alle' : (filter.zustaendig ?? 'alle')
  const gesamt = rows.length
  const anker = <span className="absolute bottom-0 left-2 h-px w-px" aria-hidden />
  const schliessen = (o: boolean) => {
    if (!o) setOffen(null)
  }
  const aktionFuer = (lead: LeadZeile) => {
    if (!offen || offen.leadId !== lead.id) return undefined
    const a = offen.aktion
    // Abbrechen = kein Wechsel (P-03, P-04): die Aktionen schreiben erst beim Bestätigen
    if (a.art === 'beenden')
      return (
        <Beenden leadId={lead.id} offen onOpenChange={schliessen} onFertig={() => setOffen(null)} trigger={anker} />
      )
    if (a.art === 'wiedervorlage')
      return (
        <Wiedervorlage
          leadId={lead.id}
          offen
          onOpenChange={schliessen}
          onFertig={() => setOffen(null)}
          trigger={anker}
        />
      )
    if (a.art === 'termin')
      return (
        <TerminEintragen
          leadId={lead.id}
          typ={a.typ}
          offen
          onOpenChange={schliessen}
          onFertig={() => setOffen(null)}
          trigger={anker}
        />
      )
    return undefined
  }

  return (
    <>
      <SeitenKopf
        titel="Pipeline"
        kontext={zustaendigWert === 'me' ? 'ich' : zustaendigWert === 'frei' ? 'frei' : 'alle'}
        rechts={
          <KopfStats
            eintraege={[
              { wert: gesamt, label: 'Leads' },
              {
                wert: spalten
                  .filter((s) => s.phase.key !== 'beendet' && s.phase.key !== 'kunde')
                  .reduce((a, s) => a + s.leads.length, 0),
                label: 'offen',
              },
              { wert: spalten.find((s) => s.phase.key === 'kunde')?.leads.length ?? 0, label: 'Kunden' },
            ]}
          />
        }
      />
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5" data-toolbar>
        <Input
          data-suche
          type="search"
          aria-label="Pipeline durchsuchen"
          placeholder="Name, Unternehmen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          rechts={<kbd className="kbd">/</kbd>}
          className="h-[34px]"
          rahmenClassName="w-[240px] max-w-full"
        />
        <Segment
          klein
          ariaLabel="Zuständig"
          wert={zustaendigWert}
          onChange={(k) =>
            setOverrides({ ...overrides, zustaendig: k === 'alle' ? undefined : (k as 'me' | 'andere' | 'frei') })
          }
          optionen={[
            { key: 'alle', label: 'Alle' },
            { key: 'me', label: 'Ich' },
            { key: 'andere', label: anzeigeName(members?.find((m) => m.id !== me), 'Andere') },
            { key: 'frei', label: 'Frei' },
          ]}
        />
        <Segment
          klein
          ariaLabel="Kanal"
          wert={(filter.kanal?.[0] ?? 'alle') as Channel | 'alle'}
          onChange={(k) => setOverrides({ ...overrides, kanal: k === 'alle' ? undefined : [k as Channel] })}
          optionen={[
            { key: 'alle', label: 'Alle' },
            { key: 'linkedin', label: <span className="glyph">in</span> },
            { key: 'telefon', label: 'Telefon' },
            { key: 'email', label: 'E-Mail' },
          ]}
        />
        {tags?.length ? (
          <Select
            aria-label="Tag"
            className="h-[34px] w-auto"
            value={overrides.tag?.[0] ?? ''}
            platzhalter="Tag"
            onChange={(e) => setOverrides({ ...overrides, tag: e.target.value ? [e.target.value] : undefined })}
            optionen={tags.map((t) => ({ value: t.id, label: t.name }))}
          />
        ) : null}
        <span className="flex-1" />
        <Button variante="quiet" groesse="S" onClick={() => navigate(PFADE.leads)}>
          Als Tabelle
        </Button>
      </div>
      {fehler ? (
        <p className="text-small text-danger mb-3" role="alert">
          Pipeline konnte nicht geladen werden – erneut versuchen.
        </p>
      ) : null}
      {istLaden && rows.length === 0 && !fehler ? (
        <Skeleton zeilen={5} />
      ) : (
        <DndContext
          sensors={sensoren}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setAktiv(null)}
        >
          <div
            ref={board}
            className="flex snap-x gap-3 overflow-x-auto pb-3"
            style={hoehe ? { height: hoehe } : undefined}
            role="list"
            aria-label="Pipeline"
            data-kanban
          >
            {spalten.map((s, i) => {
              const kopf: SpaltenKopf = {
                zaehler: s.leads.length,
                konversion: konversion(zaehler, i),
                tage: tage(s.phase),
              }
              return (
                <Spalte
                  key={s.phase.key}
                  phase={s.phase}
                  kopf={kopf}
                  eingeklappt={eingeklappt.has(s.phase.key)}
                  onToggle={() => toggle(s.phase.key)}
                  pflicht={brauchtDialog(dropRegel(s.phase.key))}
                  leer={s.leads.length === 0}
                >
                  {s.leads.map((l) => (
                    <Karte
                      key={l.id}
                      lead={l}
                      member={istFrei(l) ? null : (members?.find((m) => m.id === l.owner_id) ?? null)}
                      zweiter={
                        l.sales_owner_id && l.sales_owner_id !== l.owner_id
                          ? (members?.find((m) => m.id === l.sales_owner_id) ?? null)
                          : null
                      }
                      cursor={cursor.leadId === l.id}
                      heute={heute}
                      feiertage={settings?.feiertage}
                      aktion={aktionFuer(l)}
                      onClick={() => {
                        setCursorState({ spalte: s.phase.key, leadId: l.id })
                        oeffnePeek(l.id)
                      }}
                    />
                  ))}
                </Spalte>
              )
            })}
          </div>
          <DragOverlay>
            {aktiv ? (
              <div className="bg-surface border-line shadow-float w-[248px] rotate-1 rounded-md border p-3">
                <span className="text-ink block truncate text-[14px] font-medium">{aktiv.full_name}</span>
                <span className="text-small text-ink-3 block truncate">{aktiv.company_name ?? '–'}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <p className="text-ink-3 mt-1 text-[12.5px] max-md:hidden" data-fuss>
        <kbd className="kbd">J</kbd> <kbd className="kbd">K</kbd> Karte · <kbd className="kbd">H</kbd>{' '}
        <kbd className="kbd">L</kbd> Spalte · <kbd className="kbd">⇧→</kbd> <kbd className="kbd">⇧←</kbd> Phase
        vor/zurück · <kbd className="kbd">↵</kbd> öffnet
      </p>
      <Dialog
        offen={offen?.aktion.art === 'kunde'}
        onOpenChange={schliessen}
        titel="Datum Vertragsabschluss"
        text="Der Lead wird Kunde; LinkedIn-Sequenzen enden."
        primaer={{
          label: 'Als Kunde eintragen',
          onClick: () => void kundeBestaetigen(),
          disabled: !kundeDatum,
          busy: update.isPending,
        }}
        kinder={
          <FormField label="Vertragsabschluss" htmlFor="kunde-datum">
            <DatePicker id="kunde-datum" wert={kundeDatum} onChange={setKundeDatum} presets={['heute']} />
          </FormField>
        }
      />
    </>
  )
}
