// BAUPLAN § 3.3 `LeadsSeite.tsx` (ux § 3.2, DESIGN-SYSTEM § 5.10): Kopf (Zähler, Ansicht-Dropdown + Favoriten, Suche /, Filter-Chips,
// Gruppieren, Lead anlegen ⌥N, Schnellimport ⌘⇧O, Spaltenwähler, Export), DataTable (M0) mit exaktem Spaltensatz, Inline-Edit,
// Bulk-Leiste, Fuß „n von m · sortiert nach …“. Zustand: Filter vollständig in der URL (LE-04), Cursor/Auswahl/Bearbeitung lokal,
// Spalten je Ansicht in localStorage, uiStore.peekListe = IDs der gerenderten Liste (←/→ und J/K im Peek).
import { Download, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { FREIGABE_PER_TABELLE } from '@/components/aktionen'
import { DataTable, type SortingState } from '@/components/tabelle'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCompanies } from '@/data/companies'
import { mutationFehler } from '@/data/errors'
import { useImportBatches } from '@/data/imports'
import { useLeadsUnendlich, useLeadSuche, useLeadUpdate, type LeadListenZeile } from '@/data/leads'
import { useMeId, useMembers } from '@/data/members'
import { rpc } from '@/data/rpc'
import { useSettings } from '@/data/settings'
import { useSperrliste } from '@/data/sperrliste'
import { useTags } from '@/data/tags'
import { useUndo } from '@/data/undo'
import { csvExport, download } from '@/lib/csv'
import { heuteBerlin } from '@/lib/format'
import { emailGate, telefonGate } from '@/lib/gates'
import { phaseNachKey, phaseVon } from '@/lib/stufen'
import { linkedinHref } from '@/lib/url'
import { GATE_GRUND_LABEL, LEER } from '@/texte/de'
import type { Lead, LeadRole, LeadStage, PhaseKey, Salutation } from '@/types/domain'
import { nachleseAktivitaet } from '@/data/activities'
import { leadAktionAnfordern, type LeadAktion } from './aktionsBus'
import { AnsichtWahl, SpaltenWahl } from './AnsichtWahl'
import { liesFavoriten, liesSpalten, schreibeFavoriten, schreibeSpalten } from './ansichtSpeicher'
import { sperrlistenTreffer, type AnsichtKontext } from './ansichten'
import { EVENT_LEADS_BEFEHL } from './befehle'
import { BulkLeiste } from './BulkLeiste'
import { ansichtAusUrl, effektiverFilter, filterAusUrl, filterInUrl, type UrlFilter } from './filter'
import { FilterLeiste } from './FilterLeiste'
import { useStabileListe } from './hilfen'
import { firmaPatch, useNaechsteAktionSetzen } from './leadFelder'
import { phasenAktion } from './detailLogik'
import {
  csvSpalten,
  faelligkeitsGruppe,
  GRUPPE_LABEL,
  leadSpalten,
  mitFirmensperre,
  mobilZeile,
  sortFeld,
  zeitBalken,
  type Bearbeitung,
  type LeadZeile,
} from './spalten'
import { SPALTEN_LABEL, spalteNachFeld, type SpaltenKey } from './spaltenKeys'
import { useLeadsHotkeys } from './useLeadsHotkeys'
import { ZeilenAktion, type ZeilenAktionArt } from './ZeilenAktion'

export function Component() {
  return <LeadsSeite />
}

type Aktion = { leadId: string; art: ZeilenAktionArt; terminTyp?: 'erstgespraech' | 'strategiegespraech' }

export function LeadsSeite({ kinder }: { kinder?: ReactNode }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const me = useMeId()
  const heute = heuteBerlin()

  // ── Filterzustand aus der URL (LE-04) ──
  const ansicht = ansichtAusUrl(params)
  const overrides = useMemo(() => filterAusUrl(params), [params])
  const filter = useMemo(() => effektiverFilter(ansicht, overrides), [ansicht, overrides])
  const setOverrides = useCallback(
    (next: UrlFilter) => setParams(filterInUrl(next, params), { replace: true }),
    [params, setParams],
  )
  const setAnsicht = (key: string) => {
    const p = new URLSearchParams()
    p.set('ansicht', key)
    const lead = params.get('lead')
    if (lead) p.set('lead', lead)
    setParams(p)
  }

  // ── Daten ──
  const geladen = useLeadsUnendlich(filter)
  const leads = useStabileListe(geladen.data)
  const { hatMehr, istLaden, fehler, nachladen } = geladen
  const { data: companies } = useCompanies()
  const { data: sperrliste } = useSperrliste()
  const { data: settings } = useSettings()
  const { data: members } = useMembers()
  const { data: tags } = useTags()
  const { data: batches } = useImportBatches()
  const update = useLeadUpdate()
  const naechsteAktion = useNaechsteAktionSetzen()
  const { anbieten } = useUndo()

  const gesperrteFirmen = useMemo(
    () => new Set((companies ?? []).filter((c) => c.do_not_contact).map((c) => c.id)),
    [companies],
  )
  const ctx = useMemo<AnsichtKontext>(
    () => ({
      heute,
      me,
      // Embed `companies(do_not_contact)` aus der Liste (M0), sonst über useCompanies (Zeilen ohne Embed, z. B. Cache/Tests)
      firmaGesperrt: (l) =>
        (l as LeadListenZeile).companies?.do_not_contact ?? (!!l.company_id && gesperrteFirmen.has(l.company_id)),
      sperrliste: (l) => sperrlistenTreffer(l, sperrliste ?? []),
      zurueckziehenTage: settings?.linkedin.pending_withdraw_days ?? 21,
    }),
    [heute, me, gesperrteFirmen, sperrliste, settings],
  )
  const rows = useMemo<LeadZeile[]>(
    () =>
      leads
        .map((l) => mitFirmensperre(l, ctx.firmaGesperrt(l), ctx.sperrliste(l)))
        .filter((l) => !ansicht.client || ansicht.client(l, ctx)),
    [leads, ctx, ansicht],
  )
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows])

  // ── Lokaler Zustand ──
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set())
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null)
  const [aktion, setAktion] = useState<Aktion | null>(null)
  const [bulkMenu, setBulkMenu] = useState(false)
  const [favoriten, setFavoriten] = useState<string[]>(() => liesFavoriten())
  const [spaltenKeys, setSpaltenKeys] = useState<SpaltenKey[]>(() => liesSpalten(ansicht))
  const [spaltenOffen, setSpaltenOffen] = useState(false)
  const [suche, setSuche] = useState(overrides.q ?? '')
  const sucheRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => setSpaltenKeys(liesSpalten(ansicht)), [ansicht])
  useEffect(() => setSuche(overrides.q ?? ''), [overrides.q])
  // Suche 300 ms entprellt in die URL
  useEffect(() => {
    if ((overrides.q ?? '') === suche.trim()) return
    const t = setTimeout(() => setOverrides({ ...overrides, q: suche.trim() || undefined }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suche])

  // Peek ↔ Cursor: Liste für ←/→, Cursor folgt ?lead=, ?lead= folgt dem Cursor bei offenem Peek
  const setPeekListe = useUiStore((s) => s.setPeekListe)
  const peekLeadId = params.get('lead')
  useEffect(() => setPeekListe(rowIds), [rowIds, setPeekListe])
  useEffect(() => {
    if (peekLeadId && rowIds.includes(peekLeadId)) setCursorId(peekLeadId)
  }, [peekLeadId, rowIds])
  const onCursor = useCallback(
    (id: string) => {
      setCursorId(id)
      if (params.get('lead') && params.get('lead') !== id) {
        const p = new URLSearchParams(params)
        p.set('lead', id)
        setParams(p, { replace: true })
      }
    },
    [params, setParams],
  )
  const oeffnePeek = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params)
      p.set('lead', id)
      setParams(p, { replace: true })
    },
    [params, setParams],
  )

  // ── Inline-Edit speichern ──
  const onSave = async (lead: LeadZeile, spalte: SpaltenKey, wert: string | null) => {
    setBearbeitung(null)
    const patch = (p: Parameters<typeof update.mutateAsync>[0]['patch']) =>
      update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: p }).catch(() => undefined)
    switch (spalte) {
      case 'name': {
        const t = (wert ?? '').trim()
        if (!t) return
        const teile = t.split(/\s+/)
        const last = teile.length > 1 ? (teile.pop() as string) : ''
        // `full_name` ist eine generierte Spalte (Review): nur Vor-/Nachname schreiben, die DB setzt den vollen Namen
        await patch({ first_name: teile.join(' ') || t, last_name: last || null })
        return
      }
      case 'unternehmen': {
        let p: Awaited<ReturnType<typeof firmaPatch>>
        try {
          p = await firmaPatch(wert)
        } catch (e) {
          mutationFehler(e)
          return
        }
        await patch(p)
        return
      }
      case 'rolle':
        if (wert) await patch({ role: wert as LeadRole })
        return
      case 'anrede':
        if (wert) await patch({ salutation: wert as Salutation })
        return
      case 'ort':
        await patch({ city: wert?.trim() || null })
        return
      case 'notiz':
        await patch({ notes: wert?.trim() || null })
        return
      case 'naechsteAktion':
        // nie `next_action_at` direkt: Schritt/Aufgabe verschieben (recompute_lead_next_action rechnet den Wert)
        await naechsteAktion(lead, wert)
        return
      case 'phase': {
        if (!wert || wert === lead.stage) return
        const ziel = phaseVon(wert as LeadStage).key
        const a = phasenAktion(ziel)
        if (a === 'termin')
          setAktion({
            leadId: lead.id,
            art: 'termin',
            terminTyp: ziel === 'strategiegespraech' ? 'strategiegespraech' : 'erstgespraech',
          })
        else if (a === 'beenden')
          setAktion({ leadId: lead.id, art: 'beenden' }) // LE-07: Grund Pflicht, ohne Grund nichts gespeichert
        else if (a === 'wiedervorlage') setAktion({ leadId: lead.id, art: 'wiedervorlage' })
        else await patch({ stage: wert as LeadStage })
        return
      }
      case 'zustaendig': {
        const aktuell = lead.released || !lead.owner_id ? null : lead.owner_id
        if (wert === aktuell) return
        try {
          if (!wert) await rpc.releaseLead({ leadId: lead.id, reason: FREIGABE_PER_TABELLE })
          else await rpc.transferLead({ leadId: lead.id, toMember: wert, note: FREIGABE_PER_TABELLE })
        } catch (e) {
          mutationFehler(e)
          return
        }
        const m = members?.find((x) => x.id === wert)
        const text = wert ? `Übergeben an ${m?.short_name ?? m?.display_name ?? 'die andere Person'}.` : 'Freigegeben.'
        const a = await nachleseAktivitaet(lead.id, wert ? ['uebergabe'] : ['freigabe'])
        if (a) anbieten(a.id, text, lead.id)
        else toast(text)
        return
      }
      default:
        return
    }
  }

  // ── Spalten ──
  const spaltenOpts = useMemo(
    () => ({ heute, settings, members: members ?? [], batches: batches ?? [] }),
    [heute, settings, members, batches],
  )
  const spalten = useMemo(
    () =>
      leadSpalten(spaltenKeys, {
        ...spaltenOpts,
        bearbeitung,
        onSave: (l, s, w) => void onSave(l, s, w),
        onCancel: () => setBearbeitung(null),
        onTab: () => undefined,
        anker: aktion
          ? {
              rowId: aktion.leadId,
              node: (
                <ZeilenAktion
                  lead={{ id: aktion.leadId }}
                  art={aktion.art}
                  terminTyp={aktion.terminTyp}
                  onFertig={() => setAktion(null)}
                />
              ),
            }
          : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaltenKeys, spaltenOpts, bearbeitung, aktion],
  )
  const sortierung = useMemo<SortingState>(
    () =>
      (filter.sort ?? [])
        .map((s) => ({ id: spalteNachFeld(s.feld) ?? '', desc: s.richtung === 'desc' }))
        .filter((s) => s.id && spaltenKeys.includes(s.id as SpaltenKey)),
    [filter.sort, spaltenKeys],
  )
  const onSortierung = (s: SortingState) =>
    setOverrides({
      ...overrides,
      sort: s.length
        ? s.map((x) => ({ feld: sortFeld(x.id) ?? 'next_action_at', richtung: x.desc ? 'desc' : 'asc' }))
        : undefined,
    })
  const sortLabel = (() => {
    const s = filter.sort?.[filter.gruppe && filter.gruppe !== 'faelligkeit' ? 1 : 0] ?? filter.sort?.[0]
    const feld = s?.feld ?? 'next_action_at'
    const key = spalteNachFeld(feld)
    return key ? SPALTEN_LABEL[key] : feld
  })()
  const gruppe = filter.gruppe
  const gruppierung = gruppe
    ? {
        key: (r: LeadZeile) =>
          gruppe === 'faelligkeit'
            ? faelligkeitsGruppe(r, heute)
            : gruppe === 'phase'
              ? phaseVon(r.stage).key
              : gruppe === 'zustaendig'
                ? r.released || !r.owner_id
                  ? 'frei'
                  : r.owner_id
                : (r.company_name ?? '–'),
        label: (k: string) =>
          gruppe === 'faelligkeit'
            ? GRUPPE_LABEL[k as keyof typeof GRUPPE_LABEL]
            : gruppe === 'phase'
              ? // Gruppenschlüssel ist der Phasen-Key (angefragt, eroeffnet …), keine Stufe – phaseVon warf hier
                phaseNachKey(k as PhaseKey).label
              : gruppe === 'zustaendig'
                ? k === 'frei'
                  ? 'Frei'
                  : (members?.find((m) => m.id === k)?.short_name ?? k)
                : k,
      }
    : undefined

  // ── Tasten ──
  const bulkRows = useMemo(() => rows.filter((r) => auswahl.has(r.id)), [rows, auswahl])
  const onAktion = (leadId: string, a: LeadAktion) => {
    if (a === 'antwort' || a === 'notiz') {
      leadAktionAnfordern(leadId, a)
      return
    }
    if (
      a === 'termin' ||
      a === 'beenden' ||
      a === 'wiedervorlage' ||
      a === 'spaeter' ||
      a === 'uebergeben' ||
      a === 'freigeben'
    )
      setAktion({ leadId, art: a })
  }
  const gate = (id: string) => rows.find((r) => r.id === id)
  useLeadsHotkeys({
    cursorId,
    auswahlGroesse: auswahl.size,
    onBulkMenu: () => setBulkMenu(true),
    onAktion,
    onZuruecksetzen: () => setOverrides({}),
    onEmail: (id) => {
      const l = gate(id)
      if (!l) return
      const g = emailGate(l, 0, l.sperrliste)
      if (g.erlaubt) navigate(`${PFADE.emailVerfassen}?lead=${encodeURIComponent(id)}`)
      else toast(g.grund ? GATE_GRUND_LABEL[g.grund] : GATE_GRUND_LABEL.keine_grundlage)
    },
    onAnrufen: (id) => {
      const l = gate(id)
      if (!l) return
      const g = telefonGate(l, l.sperrliste)
      if (g.erlaubt) navigate(PFADE.anruf(id))
      else toast(g.grund ? GATE_GRUND_LABEL[g.grund] : GATE_GRUND_LABEL.keine_nummer)
    },
    onLinkedin: (id) => {
      const href = linkedinHref(gate(id)?.linkedin_url)
      if (href) window.open(href, '_blank', 'noopener')
    },
  })

  // ── Kopfzahlen, Leerzustand, Export ──
  const stats = useMemo(() => {
    let aktiv = 0
    let heuteN = 0
    let ueber = 0
    let beendet = 0
    for (const r of rows) {
      if (r.stage === 'beendet') beendet++
      else aktiv++
      const z = zeitBalken(r, heute)
      if (z === 'today') heuteN++
      if (z === 'overdue') ueber++
    }
    return { gesamt: rows.length, aktiv, heute: heuteN, ueber, beendet }
  }, [rows, heute])
  const q = overrides.q ?? ''
  const { data: vorschlag } = useLeadSuche(q.length >= 3 && rows.length === 0 ? q.slice(0, 3) : '', 1)
  const exportieren = () => {
    download(csvExport(rows, csvSpalten(spaltenKeys, spaltenOpts)), `crm-leads-${ansicht.key}-${heute}.csv`)
    toast(`${rows.length} ${rows.length === 1 ? 'Lead' : 'Leads'} exportiert.`)
  }
  // Palette-Befehle „Spalten wählen“ / „Exportieren (CSV)“ (befehle.ts → Event, damit die Palette keinen Seitenzustand kennt)
  const exportRef = useRef(exportieren)
  useEffect(() => {
    exportRef.current = exportieren
  })
  useEffect(() => {
    const h = (e: Event) => {
      const befehl = (e as CustomEvent<{ befehl?: string }>).detail?.befehl
      if (befehl === 'spalten') setSpaltenOffen(true)
      if (befehl === 'export') exportRef.current()
    }
    window.addEventListener(EVENT_LEADS_BEFEHL, h)
    return () => window.removeEventListener(EVENT_LEADS_BEFEHL, h)
  }, [])
  const leer =
    rows.length === 0 && !istLaden ? (
      q ? (
        <EmptyState
          titel={LEER.leadsSuche(q).titel}
          satz={vorschlag?.[0] ? LEER.leadsSucheVorschlag(vorschlag[0].full_name ?? '') : undefined}
          primaer={{ label: LEER.leadsSuche(q).aktion, kbd: '⌥N', onClick: () => navigate(PFADE.leadNeu) }}
          sekundaer={
            vorschlag?.[0]
              ? { label: `${vorschlag[0].full_name} öffnen`, onClick: () => oeffnePeek(vorschlag[0]?.id as string) }
              : undefined
          }
        />
      ) : (
        <EmptyState
          titel={LEER.leadsFilter.titel}
          primaer={{ label: 'Filter zurücksetzen', kbd: '⌫', onClick: () => setOverrides({}) }}
        />
      )
    ) : null

  return (
    <>
      <SeitenKopf
        titel="Leads"
        kontext={`${filter.kanal?.length === 1 ? (filter.kanal[0] === 'linkedin' ? 'LinkedIn' : filter.kanal[0] === 'telefon' ? 'Telefon' : 'E-Mail') : 'alle Kanäle'} · Ansicht „${ansicht.name}“`}
        rechts={
          <KopfStats
            eintraege={[
              { wert: stats.gesamt, label: 'gesamt' },
              { wert: stats.aktiv, label: 'aktiv' },
              { wert: stats.heute, label: 'heute', ton: 'signal' },
              { wert: stats.ueber, label: 'überfällig', ton: 'overdue' },
              { wert: stats.beendet, label: 'beendet' },
            ]}
          />
        }
      />
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5" data-toolbar>
        <Input
          ref={sucheRef}
          data-suche
          type="search"
          aria-label="Leads durchsuchen"
          placeholder="Name, Unternehmen, URL, Notiz …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') sucheRef.current?.blur()
            if (e.key === 'Enter') setOverrides({ ...overrides, q: suche.trim() || undefined })
          }}
          rechts={<kbd className="kbd">/</kbd>}
          className="h-[34px]"
          rahmenClassName="w-[280px] max-w-full"
        />
        <AnsichtWahl
          ansicht={ansicht}
          favoriten={favoriten}
          onAnsicht={setAnsicht}
          onFavoriten={(l) => {
            setFavoriten(l)
            schreibeFavoriten(l)
          }}
        />
        <FilterLeiste
          ansicht={ansicht}
          overrides={overrides}
          onChange={setOverrides}
          members={members ?? []}
          tags={tags ?? []}
          batches={batches ?? []}
          me={me}
        />
        <span className="flex-1" />
        <SpaltenWahl
          offen={spaltenOffen}
          onOpenChange={setSpaltenOffen}
          keys={spaltenKeys}
          onChange={(k) => {
            setSpaltenKeys(k)
            schreibeSpalten(ansicht, k)
          }}
        />
        <Button
          variante="icon"
          icon={Download}
          aria-label="Exportieren (CSV)"
          title="CSV der aktuellen Ansicht"
          onClick={exportieren}
        />
        <Button
          variante="secondary"
          groesse="M"
          icon={Upload}
          kbd="⌘⇧O"
          onClick={() => navigate(PFADE.schnellimport(`${PFADE.leads}?${params.toString()}`))}
        >
          Schnellimport
        </Button>
        <Button variante="primary" groesse="M" kbd="⌥N" onClick={() => navigate(PFADE.leadNeu)}>
          Lead anlegen
        </Button>
      </div>

      {fehler ? <LadeFehler text="Leads konnten nicht geladen werden" onNochmal={nachladen} /> : null}
      {istLaden && rows.length === 0 && !fehler ? (
        <Skeleton zeilen={6} />
      ) : (
        <DataTable<LeadZeile>
          ariaLabel="Leads"
          daten={rows}
          spalten={spalten}
          rowId={(r) => r.id}
          cursorId={cursorId}
          onCursor={onCursor}
          auswahl={auswahl}
          onAuswahl={setAuswahl}
          onEnter={(r) => oeffnePeek(r.id)}
          onZelleBearbeiten={(r, spalte) => {
            if (spalte === 'schritt') setAktion({ leadId: r.id, art: 'spaeter' })
            else setBearbeitung({ rowId: r.id, spalte: spalte as SpaltenKey })
          }}
          gruppierung={gruppierung}
          sortierung={sortierung}
          onSortierung={onSortierung}
          zeitBalken={(r) => zeitBalken(r, heute)}
          hatMehr={hatMehr}
          leer={leer}
          mobilZeile={(r, z) => mobilZeile(r, spaltenOpts, z)}
        />
      )}

      <div className="text-ink-3 mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px]" data-fuss>
        <span>
          <span className="tnum font-mono">{rows.length}</span> von{' '}
          <span className="tnum font-mono">{hatMehr ? `${leads.length}+` : leads.length}</span> · sortiert nach{' '}
          {sortLabel}
          {' · '}
          <kbd className="kbd">↵</kbd> öffnet, <kbd className="kbd">E</kbd> bearbeitet Zelle,{' '}
          <kbd className="kbd">Space</kbd> wählt aus
        </span>
      </div>

      {auswahl.size > 0 ? (
        <BulkLeiste
          ausgewaehlt={bulkRows}
          csvSpalten={csvSpalten(spaltenKeys, spaltenOpts)}
          ansichtKey={ansicht.key}
          menuOffen={bulkMenu}
          onMenuOffen={setBulkMenu}
          onFertig={() => {
            setAuswahl(new Set())
            setBulkMenu(false)
          }}
        />
      ) : null}
      {kinder}
    </>
  )
}

export type { Lead }
