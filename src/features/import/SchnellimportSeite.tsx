// oxlint-disable react/only-export-components -- Seite exportiert `Component` (Router-Vertrag) plus reine Helfer für Schnellimport.test.tsx
// BAUPLAN § 3.8 SchnellimportSeite: Sheet 720 px – Textarea Mono links, Live-Mini-Tabelle rechts (Name · Unternehmen · Chip),
// Anrede-Segment H F – je Zeile (Vorschlag aus Vornamenliste, nie stillschweigend), Ziel-Modus (?modus=anfrage|vernetzt),
// Quelle „ChatGPT · 14.10.2026“, Prompt-Vorlage als Kopierfeld (research/linkedin § 6.5), „Übernehmen ⌘↵“; Entwurf in
// localStorage['crm.schnellimport.entwurf']. Ablauf: Parser lokal → Dry-Run (500 ms nach Tippen-Ende) → Chips vom Server → Übernehmen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { ladeLeadSeite, qk, rpc, useCompanies, useMeId, useUndoImport, zeigeFehler } from '@/data'
import { useQueryClient } from '@tanstack/react-query'
import { toast, toastUndo } from '@/components/toast'
import { Button, Chip, cn, FormField, Kbd, Segment, SeitenKopf, Sheet, Textarea } from '@/components/ui'
import { fmtDatum, fmtZahl, heuteBerlin } from '@/lib/format'
import { useHotkeys, useHotkeyScope } from '@/lib/keyboard'
import { phaseVon } from '@/lib/stufen'
import { kopieren } from '@/lib/zwischenablage'
import { LEER, PHASE_LABEL } from '@/texte/de'
import type { Json } from '@/types/database'
import type { ImportErgebnis, Salutation, SchnellimportZeile } from '@/types/domain'
import { internesZiel } from '@/lib/url'
import { firmaGesperrt, StatusChipImport, type ImportStatus } from './components/Assistent'
import { importZusammenfassung } from './components/zusammenfassung'
import { anredeVorschlag } from './components/vornamen'
import { parseSchnellimport } from './parser/schnellimport'
import type { ImportLeadRow } from './presets/allgemein'

export const ENTWURF_KEY = 'crm.schnellimport.entwurf'
export const DRY_RUN_MS = 500
export type Modus = 'anfrage' | 'vernetzt'

/** research/linkedin.md § 6.5 – Prompt-Zusatz für ChatGPT. */
export const PROMPT_VORLAGE =
  'Gib die Liste ausschließlich als Markdown-Tabelle mit genau diesen Spalten aus: Vorname | Nachname | Anrede (Herr/Frau) | Position | Unternehmen | Ort | LinkedIn-URL. Nur öffentliche Profil-URLs der Form https://www.linkedin.com/in/… ohne Parameter. Wenn du keine URL sicher kennst, schreibe ‚unbekannt‘.'

type Entwurf = { text: string; anreden: Record<string, Salutation>; modus: Modus; entfernt: number[] }

function liesEntwurf(): Entwurf | null {
  try {
    const raw = localStorage.getItem(ENTWURF_KEY)
    if (!raw) return null
    const e = JSON.parse(raw) as Partial<Entwurf>
    return {
      text: e.text ?? '',
      anreden: e.anreden ?? {},
      modus: e.modus === 'vernetzt' ? 'vernetzt' : 'anfrage',
      entfernt: e.entfernt ?? [],
    }
  } catch {
    return null
  }
}
function schreibeEntwurf(e: Entwurf | null): void {
  try {
    if (!e || e.text.trim() === '') localStorage.removeItem(ENTWURF_KEY)
    else localStorage.setItem(ENTWURF_KEY, JSON.stringify(e))
  } catch {
    /* Storage voll oder gesperrt – Entwurf ist Komfort */
  }
}

type Server = {
  status: ImportErgebnis['rows'][number]['status']
  existing_stage: string | null
  existing_owner: string | null
  existing_id: string | null
}

/** Zeile → import_leads-Row (Anrede explizit, Rolle aus role_title macht der Server). */
export function zeileZuRow(z: SchnellimportZeile, anrede: Salutation | null): ImportLeadRow {
  const r: ImportLeadRow = {}
  if (z.first_name) r.first_name = z.first_name
  if (z.last_name) r.last_name = z.last_name
  if (!z.first_name && !z.last_name && z.name) r.name = z.name
  if (anrede) r.salutation = anrede
  if (z.company) r.company = z.company
  if (z.role_title) r.role_title = z.role_title
  if (z.linkedin_url) r.linkedin_url = z.linkedin_url
  if (z.city) r.city = z.city
  if (z.title) r.title = z.title // vorher ein No-op – „Dr. Anna Beispiel“ verlor den Titel (§ 6.3 Beispiel 1, Review)
  return r
}

/** Zeilen, die zum Server gehen: keine Listen-Dubletten, mindestens Name oder Person-URL. */
export function sendbar(z: SchnellimportZeile): boolean {
  if (z.status_lokal === 'dublette_liste') return false
  return !!(z.first_name || z.last_name || z.url_art === 'person')
}

export function Component() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useMeId()
  const qc = useQueryClient()
  const firmen = useCompanies()
  const undo = useUndoImport()
  useHotkeyScope('formular')

  const zurueck = params.get('zurueck')
  const ziel = internesZiel(zurueck, PFADE.import)
  const modusParam: Modus = params.get('modus') === 'vernetzt' ? 'vernetzt' : 'anfrage'

  const entwurf = useRef<Entwurf | null>(liesEntwurf())
  const [text, setText] = useState(entwurf.current?.text ?? '')
  const [anreden, setAnreden] = useState<Record<string, Salutation>>(entwurf.current?.anreden ?? {})
  const [entfernt, setEntfernt] = useState<Set<number>>(() => new Set(entwurf.current?.entfernt ?? []))
  const [modus, setModus] = useState<Modus>(params.has('modus') ? modusParam : (entwurf.current?.modus ?? 'anfrage'))
  const [cursor, setCursor] = useState(0)
  const [server, setServer] = useState<Record<string, Server>>({})
  const [pruefend, setPruefend] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [offen, setOffen] = useState(true)
  const heute = heuteBerlin()
  const label = `ChatGPT · ${fmtDatum(heute)}`

  const geparst = useMemo(() => parseSchnellimport(text), [text])
  const zeilen = useMemo(() => geparst.zeilen.filter((z) => !entfernt.has(z.zeile)), [geparst, entfernt])
  const schluessel = (z: SchnellimportZeile) => z.linkedin_url_norm ?? `${z.zeile}:${z.name ?? ''}`

  // Entwurf sichern
  useEffect(() => {
    schreibeEntwurf({ text, anreden, modus, entfernt: [...entfernt] })
  }, [text, anreden, modus, entfernt])

  // Dry-Run 500 ms nach Tippen-Ende (BAUPLAN § 3.8 Schnellimport-Ablauf)
  const sendZeilen = useMemo(() => zeilen.filter(sendbar), [zeilen])
  const signatur = useMemo(
    () =>
      sendZeilen
        .map((z) => `${z.linkedin_url_norm ?? ''}|${z.first_name ?? ''}|${z.last_name ?? ''}|${z.company ?? ''}`)
        .join('\n'),
    [sendZeilen],
  )
  useEffect(() => {
    if (sendZeilen.length === 0) {
      setServer({})
      return
    }
    let aktiv = true
    const t = window.setTimeout(async () => {
      setPruefend(true)
      try {
        const rows = sendZeilen.map((z) => zeileZuRow(z, null))
        const e = await rpc.importLeads({
          rows: rows as unknown as Json,
          owner: me,
          source: 'schnellimport',
          label,
          dryRun: true,
        })
        if (!aktiv || !e || !Array.isArray(e.rows)) return
        const next: Record<string, Server> = {}
        sendZeilen.forEach((z, i) => {
          const r = e.rows[i]
          if (r)
            next[schluessel(z)] = {
              status: r.status,
              existing_stage: r.existing_stage,
              existing_owner: r.existing_owner,
              existing_id: r.existing_id,
            }
        })
        setServer(next)
      } catch (err) {
        if (aktiv) zeigeFehler(err)
      } finally {
        if (aktiv) setPruefend(false)
      }
    }, DRY_RUN_MS)
    return () => {
      aktiv = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatur, me])

  // Status je Zeile: Server überschreibt lokal
  const statusVon = useCallback(
    (z: SchnellimportZeile): { status: ImportStatus; server: Server | null } => {
      const s = server[schluessel(z)] ?? null
      if (z.status_lokal === 'dublette_liste') return { status: 'dublette_liste', server: null }
      if (s) return { status: s.status, server: s }
      return { status: z.status_lokal, server: null }
    },
    [server],
  )

  const brauchtAnrede = useCallback(
    (z: SchnellimportZeile) => {
      const { status } = statusVon(z)
      return (
        (status === 'neu' || status === 'sales_nav' || status === 'firmenseite' || status === 'unvollstaendig') &&
        sendbar(z)
      )
    },
    [statusVon],
  )
  const anredeVon = (z: SchnellimportZeile): Salutation | null => anreden[schluessel(z)] ?? z.salutation
  const offeneAnreden = zeilen.filter((z) => brauchtAnrede(z) && !anredeVon(z))
  const ungueltig = zeilen.filter((z) => statusVon(z).status === 'ungueltig')
  const vorschlaege = zeilen.filter((z) => brauchtAnrede(z) && !anredeVon(z) && anredeVorschlag(z.first_name))
  const neu = zeilen.filter((z) => statusVon(z).status === 'neu')
  const uebernehmenMoeglich = !laeuft && sendZeilen.length > 0 && offeneAnreden.length === 0 && ungueltig.length === 0
  const uebernehmenGrund =
    sendZeilen.length === 0
      ? 'Erst eine Liste einfügen'
      : offeneAnreden.length > 0
        ? `${offeneAnreden.length} Zeilen ohne Anrede`
        : ungueltig.length > 0
          ? `${ungueltig.length} ungültige Zeilen entfernen`
          : undefined

  const setzeAnrede = useCallback((z: SchnellimportZeile | undefined, a: Salutation) => {
    if (!z) return
    setAnreden((s) => ({ ...s, [schluessel(z)]: a }))
  }, [])
  const entferneZeile = useCallback((z: SchnellimportZeile | undefined) => {
    if (!z) return
    setEntfernt((s) => new Set([...s, z.zeile]))
  }, [])

  const schliessen = useCallback(() => {
    setOffen(false)
    navigate(ziel)
  }, [navigate, ziel])

  const uebernehmen = useCallback(async () => {
    if (!uebernehmenMoeglich) return
    setLaeuft(true)
    try {
      const rows = sendZeilen.map((z) => zeileZuRow(z, anredeVon(z)))
      const e = await rpc.importLeads({
        rows: rows as unknown as Json,
        owner: me,
        source: 'schnellimport',
        label,
        dryRun: false,
      })
      let vernetzt = 0
      if (modus === 'vernetzt' && e.batch_id) {
        const seite = await ladeLeadSeite({ quelle: e.batch_id }, 0, me)
        for (const lead of seite.zeilen) {
          try {
            await rpc.markAccepted({ leadId: lead.id, memberId: me, date: heute })
            vernetzt += 1
          } catch (err) {
            zeigeFehler(err)
          }
        }
      }
      for (const key of [
        qk.leads.all,
        qk.queue.all,
        qk.kpis.all,
        qk.imports.all,
        qk.nav,
        qk.companies,
        qk.connections.offen(me ?? ''),
      ])
        void qc.invalidateQueries({ queryKey: key })
      const batchId = e.batch_id
      const text = `${importZusammenfassung(e)}${modus === 'vernetzt' ? ` · ${fmtZahl(vernetzt)} vernetzt` : ''}`
      if (batchId) toastUndo(text, () => undo.mutate({ batchId }))
      else toast(text)
      schreibeEntwurf(null)
      setOffen(false)
      navigate(zurueck && ziel !== PFADE.import ? ziel : batchId ? PFADE.importErgebnis(batchId) : PFADE.import)
    } catch (err) {
      zeigeFehler(err)
    } finally {
      setLaeuft(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uebernehmenMoeglich, sendZeilen, anreden, me, label, modus, heute, qc, undo, navigate, ziel, zurueck])

  // Tastatur (Scope formular): ↑↓ Zeile · H/F/– Anrede · ⌫ entfernen · ⌘Enter übernehmen
  const cursorZeile = zeilen[Math.min(cursor, Math.max(0, zeilen.length - 1))]
  useHotkeys(
    'formular',
    {
      arrowdown: (e) => {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, Math.max(0, zeilen.length - 1)))
      },
      arrowup: (e) => {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      },
      h: () => setzeAnrede(cursorZeile, 'herr'),
      f: () => setzeAnrede(cursorZeile, 'frau'),
      '-': () => setzeAnrede(cursorZeile, 'neutral'),
      backspace: (e) => {
        e.preventDefault()
        entferneZeile(cursorZeile)
      },
      'mod+enter': (e) => {
        e.preventDefault()
        void uebernehmen()
      },
    },
    [cursorZeile, zeilen.length, setzeAnrede, entferneZeile, uebernehmen],
  )

  const promptKopieren = async () => {
    await kopieren(PROMPT_VORLAGE)
    setKopiert(true)
    window.setTimeout(() => setKopiert(false), 2000)
  }

  return (
    <>
      <SeitenKopf titel="Schnellimport" kontext={label} />
      <Sheet
        offen={offen}
        onOpenChange={(o) => {
          if (!o) schliessen()
        }}
        titel="Schnellimport"
        breite={720}
        kopfRechts={
          <span className="text-ink-3 tnum font-mono text-[12px]">
            {zeilen.length} erkannt{pruefend ? ' · prüfe …' : ''}
          </span>
        }
      >
        {/* Gleich breite Spalten: das Ziel-Modus-Segment braucht 311 px, bei 1 : 1,25 blieben 288 („Als Leads (bereits vernetz“) */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid content-start gap-4">
            <FormField
              label="Liste"
              hinweis="Markdown-Tabelle, nummerierte Liste, CSV oder JSON aus ChatGPT."
              htmlFor="schnellimport-text"
            >
              <Textarea
                id="schnellimport-text"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onSubmit={() => void uebernehmen()}
                placeholder="⌘V – Liste hier einfügen"
                spellCheck={false}
                className="tnum min-h-[260px] font-mono text-[13px]"
              />
            </FormField>
            <FormField label="Ziel-Modus">
              <Segment<Modus>
                ariaLabel="Ziel-Modus"
                wert={modus}
                onChange={setModus}
                optionen={[
                  { key: 'anfrage', label: 'Als Anfrageliste' },
                  { key: 'vernetzt', label: 'Als Leads (bereits vernetzt)' },
                ]}
              />
              <p className="text-small text-ink-3">
                {modus === 'anfrage'
                  ? 'Leads landen in Heute → Neue Anfragen.'
                  : 'Vernetzung „angenommen“ heute, Sequenz A startet, Opener heute fällig.'}
              </p>
            </FormField>
            <FormField label="Quelle">
              <p className="text-ui text-ink tnum font-mono">{label}</p>
            </FormField>
            <FormField label="Prompt-Vorlage" hinweis="An den ChatGPT-Prompt anhängen – dann ist das Parsen trivial.">
              <div className="border-line-strong bg-surface-hover text-small text-ink-2 grid gap-2 rounded-sm border p-3">
                <p className="whitespace-pre-wrap">{PROMPT_VORLAGE}</p>
                <div>
                  <Button groesse="S" copied={kopiert} onClick={() => void promptKopieren()}>
                    Kopieren
                  </Button>
                </div>
              </div>
            </FormField>
          </div>

          <div className="grid content-start gap-3">
            {zeilen.length === 0 ? (
              <div className="py-6">
                <h3 className="text-h3 text-ink mb-1.5">{LEER.importVorschau.titel}</h3>
                <p className="text-ui text-ink-2 mb-3">{LEER.importVorschau.satz}</p>
                <Button groesse="S" copied={kopiert} onClick={() => void promptKopieren()}>
                  {LEER.importVorschau.aktion}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-ink-2 tnum flex flex-wrap gap-x-2 font-mono text-[12.5px]">
                  <span>
                    <b className="text-ink-bright">{zeilen.length}</b> Zeilen
                  </span>
                  <span className="text-ink-3">·</span>
                  <span>
                    <b className="text-ink-bright">{neu.length}</b> neu
                  </span>
                  <span className="text-ink-3">·</span>
                  <span>
                    <b className="text-ink-bright">{zeilen.length - sendZeilen.length}</b> übersprungen
                  </span>
                  {offeneAnreden.length > 0 ? (
                    <>
                      <span className="text-ink-3">·</span>
                      <span className="text-overdue">
                        <b>{offeneAnreden.length}</b> ohne Anrede
                      </span>
                    </>
                  ) : null}
                </p>
                {vorschlaege.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-small text-ink-3">{vorschlaege.length} Anrede-Vorschläge aus Vornamen</span>
                    <Button
                      groesse="S"
                      variante="quiet"
                      onClick={() =>
                        setAnreden((s) => {
                          const n = { ...s }
                          for (const z of vorschlaege) {
                            const v = anredeVorschlag(z.first_name)
                            if (v) n[schluessel(z)] = v
                          }
                          return n
                        })
                      }
                    >
                      Vorschläge übernehmen
                    </Button>
                  </div>
                ) : null}
                <div role="grid" aria-label="Erkannte Zeilen" className="border-line-strong rounded-md border">
                  {/* Zwei Zeilen je Eintrag: in der 326-px-Spalte blieben bei vier Spalten 50 px für Name + Unternehmen
                      („Maximil…“, „Elektr…“) und die Kopfzeile lief ineinander. */}
                  <div
                    role="row"
                    className="label hairline grid h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3"
                  >
                    <span role="columnheader">Name · Unternehmen</span>
                    <span role="columnheader" className="text-right">
                      Status · Anrede
                    </span>
                  </div>
                  {zeilen.map((z, i) => {
                    const { status, server: s } = statusVon(z)
                    const anrede = anredeVon(z)
                    const pflicht = brauchtAnrede(z) && !anrede
                    const vorschlag = pflicht ? anredeVorschlag(z.first_name) : null
                    const istCursor = i === Math.min(cursor, zeilen.length - 1)
                    const gesperrt = firmaGesperrt(z.company, firmen.data)
                    return (
                      <div
                        key={`${z.zeile}-${schluessel(z)}`}
                        role="row"
                        aria-selected={istCursor || undefined}
                        data-cursor={istCursor || undefined}
                        onClick={() => setCursor(i)}
                        className={cn(
                          'hairline grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-1.5 last:border-b-0',
                          istCursor && 'cursor-bar',
                          pflicht && 'bg-overdue-tint',
                        )}
                      >
                        <span role="gridcell" className="text-ui text-ink min-w-0 truncate" title={z.name ?? undefined}>
                          {z.name ?? z.linkedin_url ?? '–'}
                        </span>
                        <span role="gridcell" className="flex flex-wrap items-center justify-end gap-1">
                          <StatusChipImport
                            status={status}
                            title={
                              status === 'sales_nav'
                                ? 'Sales-Navigator-Link, bitte öffentliche URL ergänzen'
                                : undefined
                            }
                          />
                          {status === 'duplikat' && s?.existing_stage ? (
                            <span className="text-small text-ink-3">
                              {PHASE_LABEL[phaseVon(s.existing_stage as never).key]}
                            </span>
                          ) : null}
                          {gesperrt ? <StatusChipImport status="firma_gesperrt" /> : null}
                        </span>
                        <span
                          role="gridcell"
                          className="text-small text-ink-2 min-w-0 truncate"
                          title={[z.company, z.role_title, z.city].filter(Boolean).join(' · ') || undefined}
                        >
                          {z.company ?? <span className="text-ink-3">–</span>}
                          {z.role_title || z.city ? (
                            <span className="text-ink-3">
                              {' · '}
                              {[z.role_title, z.city].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </span>
                        <span role="gridcell" className="flex items-center justify-end gap-1.5">
                          {brauchtAnrede(z) ? (
                            <Segment<Salutation>
                              klein
                              ariaLabel={`Anrede ${z.name ?? z.zeile}`}
                              wert={anrede ?? null}
                              onChange={(a) => setzeAnrede(z, a)}
                              optionen={[
                                { key: 'herr', label: 'H' },
                                { key: 'frau', label: 'F' },
                                { key: 'neutral', label: '–' },
                              ]}
                            />
                          ) : null}
                          {vorschlag ? (
                            <Chip ton="later" title="Vorschlag aus der Vornamenliste – bitte bestätigen">
                              {vorschlag === 'herr' ? 'H?' : 'F?'}
                            </Chip>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Zeile ${z.zeile} entfernen`}
                            onClick={(e) => {
                              e.stopPropagation()
                              entferneZeile(z)
                            }}
                            className="text-ink-3 hover:text-ink inline-flex h-6 w-6 items-center justify-center rounded-xs"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-small text-ink-3 flex flex-wrap items-center gap-x-2">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> Zeile · <Kbd>H</Kbd>
                  <Kbd>F</Kbd>
                  <Kbd>–</Kbd> Anrede · <Kbd>⌫</Kbd> entfernen
                </p>
              </>
            )}
          </div>
        </div>
        {/* Aktionsleiste klebt am Sheet-Boden – bei 900 px Fensterhöhe lag „Übernehmen“ sonst unter dem Rand */}
        <div className="hairline-t bg-surface-raised sticky -bottom-5 z-10 -mx-6 mt-6 -mb-5 flex flex-wrap items-center gap-2 px-6 pt-4 pb-5">
          <Button variante="quiet" kbd="Esc" onClick={schliessen}>
            Abbrechen
          </Button>
          <span className="text-small text-ink-3">Entwurf bleibt erhalten.</span>
          <span className="flex-1" />
          <Button
            variante="primary"
            kbd="⌘↵"
            busy={laeuft}
            disabled={!uebernehmenMoeglich}
            disabledGrund={uebernehmenGrund}
            onClick={() => void uebernehmen()}
          >
            Übernehmen
          </Button>
        </div>
      </Sheet>
    </>
  )
}
