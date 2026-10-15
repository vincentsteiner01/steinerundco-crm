// BAUPLAN § 3.8 useImport.ts – Assistent-State (Schritt, Datei, Preset, Mapping, Dry-Run-Ergebnis, Entscheidungen je Zeile), Ausführung.
// Daten nur über rpc (§ 3.0 Nr. 4); Dry-Run ist Pflicht vor der Ausführung bei Presets mit DB-Dry-Run (useImport.test.ts).
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useReducer } from 'react'
import { qk, rpc, zeigeFehler, type ImportTemplatesErgebnis } from '@/data'
import type { Json } from '@/types/database'
import type { ImportErgebnis } from '@/types/domain'
import { dekodiere, parseCsv, type Tabelle } from './parser/csv'
import { dateiArt, liesXlsx, MAX_BYTES, MAX_ZEILEN, type DateiArt, type Tab, type Zelle } from './parser/xlsx'
import { allgemeinZeilen, erkenneMapping, mappingVollstaendig, rowsJson, type Mapping } from './presets/allgemein'
import { crmHinweise, crmTabelleDokument, type CrmDokument, type SheetErgebnis } from './presets/crmTabelle'
import { kpiMonatDokument, type KpiDokument } from './presets/kpiMonat'
import { leitfaedenDokument, leitfaedenRowsJson, type LeitfaedenDokument } from './presets/leitfaeden'
import { presetInfo, type PresetKey } from './presets'

export type Schritt = 1 | 2 | 3 | 4
export type Quelle = { name: string; groesse: number; art: DateiArt; tabs: Tab[] | null; csv: Tabelle | null }
export type KpiErgebnis = { monatswerte: number; tageswerte: number; monate: string[] }
export type DryRun =
  { art: 'leads'; ergebnis: ImportErgebnis } | { art: 'sheet'; ergebnis: SheetErgebnis } | { art: 'lokal' }
export type Fertig =
  | { art: 'leads'; ergebnis: ImportErgebnis }
  | { art: 'sheet'; ergebnis: SheetErgebnis }
  | { art: 'kpi'; ergebnis: KpiErgebnis }
  | { art: 'templates'; ergebnis: ImportTemplatesErgebnis }
export type Entscheidung = 'aktualisieren' | 'ueberspringen'

export type ImportState = {
  schritt: Schritt
  preset: PresetKey | null
  quelle: Quelle | null
  fehler: string | null
  laeuft: boolean
  mapping: Mapping
  /** Zuständig-Fallback (Member-ID) für Preset Allgemein */
  zustaendigFallback: string | null
  /** KPI-Monat: short_name der Person (Standard Vincent) */
  person: string
  /** CRM-Tabelle: Zuständig je Zeile (_row → „Vincent“/„Mike“) für Zeilen ohne Zuständigen */
  zustaendigJeZeile: Record<number, string>
  /** Allgemein: Entscheidung je Dublette (Zeilenindex im Dry-Run) */
  entscheidungen: Record<number, Entscheidung>
  dryRun: DryRun | null
  fertig: Fertig | null
}

type Aktion =
  | { typ: 'preset'; preset: PresetKey | null }
  | { typ: 'laeuft'; laeuft: boolean }
  | { typ: 'fehler'; fehler: string | null }
  | { typ: 'quelle'; quelle: Quelle; mapping: Mapping }
  | { typ: 'schritt'; schritt: Schritt }
  | { typ: 'mapping'; index: number; feld: Mapping[number] }
  | { typ: 'zustaendigFallback'; id: string | null }
  | { typ: 'person'; person: string }
  | { typ: 'zustaendigZeile'; row: number; name: string | null }
  | { typ: 'alleOhneZustaendig'; name: string; rows: number[] }
  | { typ: 'entscheidung'; index: number; e: Entscheidung }
  | { typ: 'dryRun'; dryRun: DryRun | null }
  | { typ: 'fertig'; fertig: Fertig }
  | { typ: 'neu' }

export const START: ImportState = {
  schritt: 1,
  preset: null,
  quelle: null,
  fehler: null,
  laeuft: false,
  mapping: [],
  zustaendigFallback: null,
  person: 'Vincent',
  zustaendigJeZeile: {},
  entscheidungen: {},
  dryRun: null,
  fertig: null,
}

export function reducer(s: ImportState, a: Aktion): ImportState {
  switch (a.typ) {
    case 'preset':
      return {
        ...s,
        preset: a.preset,
        quelle: null,
        dryRun: null,
        fehler: null,
        mapping: [],
        zustaendigJeZeile: {},
        entscheidungen: {},
      }
    case 'laeuft':
      return { ...s, laeuft: a.laeuft }
    case 'fehler':
      return { ...s, fehler: a.fehler, laeuft: false }
    case 'quelle':
      return {
        ...s,
        quelle: a.quelle,
        mapping: a.mapping,
        dryRun: null,
        fehler: null,
        zustaendigJeZeile: {},
        entscheidungen: {},
      }
    case 'schritt':
      return { ...s, schritt: a.schritt, fehler: null }
    case 'mapping': {
      const mapping = s.mapping.map((m, i) => (i === a.index ? a.feld : m === a.feld && a.feld !== null ? null : m))
      return { ...s, mapping, dryRun: null }
    }
    case 'zustaendigFallback':
      return { ...s, zustaendigFallback: a.id }
    case 'person':
      return { ...s, person: a.person }
    case 'zustaendigZeile': {
      const z = { ...s.zustaendigJeZeile }
      if (a.name) z[a.row] = a.name
      else delete z[a.row]
      return { ...s, zustaendigJeZeile: z }
    }
    case 'alleOhneZustaendig': {
      const z = { ...s.zustaendigJeZeile }
      for (const r of a.rows) z[r] ??= a.name
      return { ...s, zustaendigJeZeile: z }
    }
    case 'entscheidung':
      return { ...s, entscheidungen: { ...s.entscheidungen, [a.index]: a.e } }
    case 'dryRun':
      return { ...s, dryRun: a.dryRun, laeuft: false }
    case 'fertig':
      return { ...s, fertig: a.fertig, schritt: 4, laeuft: false }
    case 'neu':
      return START
  }
}

const KEINE_SPALTEN: readonly Zelle[] = []

export function useImport(me: string | null) {
  const [state, dispatch] = useReducer(reducer, START)
  const qc = useQueryClient()
  const info = presetInfo(state.preset)

  // ── Abgeleitete Dokumente je Preset ──
  const tabs = state.quelle?.tabs ?? null
  const crm: CrmDokument | null = useMemo(
    () => (state.preset === 'crm_tabelle' && tabs ? crmTabelleDokument(tabs, state.quelle?.name ?? 'crm.xlsx') : null),
    [state.preset, tabs, state.quelle?.name],
  )
  const kpi: KpiDokument | null = useMemo(
    () => (state.preset === 'kpi_monat' && tabs ? kpiMonatDokument(tabs, state.person) : null),
    [state.preset, tabs, state.person],
  )
  const leitfaeden: LeitfaedenDokument | null = useMemo(
    () => (state.preset === 'leitfaeden' && tabs ? leitfaedenDokument(tabs) : null),
    [state.preset, tabs],
  )
  const allgemein = useMemo(() => {
    if (state.preset !== 'allgemein' || !state.quelle) return null
    const kopf: readonly Zelle[] = state.quelle.csv
      ? state.quelle.csv.kopf
      : (state.quelle.tabs?.[0]?.zeilen[0] ?? KEINE_SPALTEN)
    const zeilen: readonly (readonly Zelle[])[] = state.quelle.csv
      ? state.quelle.csv.zeilen
      : (state.quelle.tabs?.[0]?.zeilen.slice(1) ?? [])
    return { kopf, zeilen, rows: allgemeinZeilen(zeilen, state.mapping) }
  }, [state.preset, state.quelle, state.mapping])

  const crmRowsMitZustaendig = useCallback(() => {
    if (!crm) return null
    const rows = crm.rows.map((r) => {
      const wahl = state.zustaendigJeZeile[r._row]
      return wahl ? { ...r, dm_zustaendigkeit_resolved: wahl } : r
    })
    const doc = { ...(crm.doc as Record<string, unknown>), crm: { rows } } as unknown as Json
    return { rows, doc }
  }, [crm, state.zustaendigJeZeile])

  const crmOhneZustaendig = useMemo(
    () =>
      crm
        ? crm.rows.filter((r) => !r.dm_zustaendigkeit_resolved && !state.zustaendigJeZeile[r._row]).map((r) => r._row)
        : [],
    [crm, state.zustaendigJeZeile],
  )

  // ── Aktionen ──
  const waehlePreset = useCallback((preset: PresetKey | null) => dispatch({ typ: 'preset', preset }), [])

  const setzeDatei = useCallback(
    async (datei: File) => {
      const art = dateiArt(datei.name)
      if (!art) return dispatch({ typ: 'fehler', fehler: 'Nur XLSX oder CSV – die Datei hat eine andere Endung.' })
      if (datei.size > MAX_BYTES) return dispatch({ typ: 'fehler', fehler: 'Die Datei ist größer als 10 MB.' })
      if (info && !info.dateiarten.includes(art))
        return dispatch({
          typ: 'fehler',
          fehler: `Das Preset ‚${info.name}‘ erwartet ${info.dateiarten.join('/').toUpperCase()}.`,
        })
      dispatch({ typ: 'laeuft', laeuft: true })
      try {
        const puffer = await datei.arrayBuffer()
        let quelle: Quelle
        if (art === 'xlsx') {
          const tabs = await liesXlsx(puffer)
          quelle = { name: datei.name, groesse: datei.size, art, tabs, csv: null }
        } else {
          const csv = parseCsv(dekodiere(puffer))
          quelle = { name: datei.name, groesse: datei.size, art, tabs: null, csv }
        }
        const zeilen = quelle.csv
          ? quelle.csv.zeilen.length
          : Math.max(0, ...(quelle.tabs ?? []).map((t) => t.zeilen.length - 1))
        if (zeilen > MAX_ZEILEN) {
          dispatch({
            typ: 'fehler',
            fehler: `${zeilen} Zeilen – bitte in Teilen importieren (maximal ${MAX_ZEILEN} je Lauf).`,
          })
          return
        }
        const kopf = quelle.csv ? quelle.csv.kopf : (quelle.tabs?.[0]?.zeilen[0] ?? [])
        dispatch({ typ: 'quelle', quelle, mapping: erkenneMapping(kopf) })
        dispatch({ typ: 'laeuft', laeuft: false })
        dispatch({ typ: 'schritt', schritt: 2 })
      } catch (e) {
        zeigeFehler(e)
        dispatch({ typ: 'fehler', fehler: 'Die Datei konnte nicht gelesen werden.' })
      }
    },
    [info],
  )

  const invalidieren = useCallback(() => {
    for (const key of [
      qk.leads.all,
      qk.queue.all,
      qk.kpis.all,
      qk.templates.all,
      qk.imports.all,
      qk.nav,
      qk.companies,
      ['counters'],
    ])
      void qc.invalidateQueries({ queryKey: key })
  }, [qc])

  /** Schritt 2 → 3: Dry-Run (CRM-Tabelle: import_sheet_leads, Allgemein: import_leads), sonst lokale Vorschau. */
  const pruefen = useCallback(async () => {
    if (!state.preset || !state.quelle) return
    dispatch({ typ: 'laeuft', laeuft: true })
    try {
      if (state.preset === 'crm_tabelle') {
        const d = crmRowsMitZustaendig()
        if (!d) throw new Error('kein Dokument')
        const ergebnis = (await rpc.importSheetLeads(d.doc, true)) as unknown as SheetErgebnis
        dispatch({ typ: 'dryRun', dryRun: { art: 'sheet', ergebnis } })
      } else if (state.preset === 'allgemein') {
        if (!allgemein || !mappingVollstaendig(state.mapping)) {
          dispatch({ typ: 'fehler', fehler: 'Ordne mindestens Name oder LinkedIn-URL zu.' })
          return
        }
        const ergebnis = await rpc.importLeads({
          rows: rowsJson(allgemein.rows),
          owner: state.zustaendigFallback ?? me,
          source: 'import_csv',
          label: state.quelle.name,
          dryRun: true,
        })
        dispatch({ typ: 'dryRun', dryRun: { art: 'leads', ergebnis } })
      } else {
        dispatch({ typ: 'dryRun', dryRun: { art: 'lokal' } })
      }
      dispatch({ typ: 'schritt', schritt: 3 })
    } catch (e) {
      zeigeFehler(e)
      dispatch({ typ: 'laeuft', laeuft: false })
    }
  }, [state.preset, state.quelle, state.mapping, state.zustaendigFallback, me, allgemein, crmRowsMitZustaendig])

  /** Schritt 3 → 4: Ausführung; verlangt einen Dry-Run bei Presets mit DB-Dry-Run. */
  const ausfuehren = useCallback(async () => {
    if (!state.preset || !state.quelle) return
    if (info?.dryRun && !state.dryRun) {
      dispatch({ typ: 'fehler', fehler: 'Erst prüfen (Dry-Run), dann importieren.' })
      return
    }
    dispatch({ typ: 'laeuft', laeuft: true })
    try {
      let fertig: Fertig
      if (state.preset === 'crm_tabelle') {
        const d = crmRowsMitZustaendig()
        if (!d) throw new Error('kein Dokument')
        if (crmOhneZustaendig.length > 0) {
          dispatch({ typ: 'fehler', fehler: `${crmOhneZustaendig.length} Zeilen ohne Zuständigen – bitte zuordnen.` })
          return
        }
        fertig = { art: 'sheet', ergebnis: (await rpc.importSheetLeads(d.doc, false)) as unknown as SheetErgebnis }
      } else if (state.preset === 'allgemein') {
        if (!allgemein) throw new Error('keine Zeilen')
        const rows = allgemein.rows.filter((_, i) => state.entscheidungen[i] !== 'ueberspringen')
        fertig = {
          art: 'leads',
          ergebnis: await rpc.importLeads({
            rows: rowsJson(rows),
            owner: state.zustaendigFallback ?? me,
            source: 'import_csv',
            label: state.quelle.name,
            dryRun: false,
          }),
        }
      } else if (state.preset === 'kpi_monat') {
        if (!kpi || kpi.months.length === 0) throw new Error('keine Monate')
        fertig = { art: 'kpi', ergebnis: (await rpc.importSheetKpis(kpi.doc)) as unknown as KpiErgebnis }
      } else if (state.preset === 'leitfaeden') {
        if (!leitfaeden || leitfaeden.rows.length === 0) throw new Error('keine Leitfäden')
        fertig = {
          art: 'templates',
          ergebnis: await rpc.importTemplates({ rows: leitfaedenRowsJson(leitfaeden.rows) }),
        }
      } else {
        dispatch({ typ: 'fehler', fehler: 'Dieses Preset kommt mit v1.1.' })
        return
      }
      invalidieren()
      dispatch({ typ: 'fertig', fertig })
    } catch (e) {
      zeigeFehler(e)
      dispatch({ typ: 'laeuft', laeuft: false })
    }
  }, [
    state.preset,
    state.quelle,
    state.dryRun,
    state.entscheidungen,
    state.zustaendigFallback,
    info,
    me,
    allgemein,
    kpi,
    leitfaeden,
    crmRowsMitZustaendig,
    crmOhneZustaendig,
    invalidieren,
  ])

  const weiter = useCallback(() => {
    if (state.laeuft) return
    if (state.schritt === 1) {
      if (state.quelle) dispatch({ typ: 'schritt', schritt: 2 })
      return
    }
    if (state.schritt === 2) {
      void pruefen()
      return
    }
    if (state.schritt === 3) void ausfuehren()
  }, [state.laeuft, state.schritt, state.quelle, pruefen, ausfuehren])

  const zurueck = useCallback(() => {
    if (state.laeuft || state.schritt === 1 || state.schritt === 4) return
    dispatch({ typ: 'schritt', schritt: (state.schritt - 1) as Schritt })
  }, [state.laeuft, state.schritt])

  return {
    state,
    info,
    crm,
    crmHinweise: crm ? crmHinweise(crm.rows) : null,
    crmOhneZustaendig,
    kpi,
    leitfaeden,
    allgemein,
    waehlePreset,
    setzeDatei,
    setzeMapping: (index: number, feld: Mapping[number]) => dispatch({ typ: 'mapping', index, feld }),
    setzeZustaendigFallback: (id: string | null) => dispatch({ typ: 'zustaendigFallback', id }),
    setzePerson: (person: string) => dispatch({ typ: 'person', person }),
    setzeZustaendigZeile: (row: number, name: string | null) => dispatch({ typ: 'zustaendigZeile', row, name }),
    alleOhneZustaendig: (name: string) => dispatch({ typ: 'alleOhneZustaendig', name, rows: crmOhneZustaendig }),
    setzeEntscheidung: (index: number, e: Entscheidung) => dispatch({ typ: 'entscheidung', index, e }),
    geheZu: (schritt: Schritt) => dispatch({ typ: 'schritt', schritt }),
    weiter,
    zurueck,
    pruefen,
    ausfuehren,
    neu: () => dispatch({ typ: 'neu' }),
  }
}

export type ImportApi = ReturnType<typeof useImport>
