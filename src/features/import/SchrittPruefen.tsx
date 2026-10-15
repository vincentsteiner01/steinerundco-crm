// BAUPLAN § 3.8 SchrittPruefen: Dry-Run-Zähler, Tabelle mit Chip je Zeile (Neu · Dublette · Archiv · Sperrliste · Firma gesperrt ·
// Unvollständig · Sales-Nav · Firmenseite), Pflichtauswahl Zuständig bei Frei/#ERROR! (Bulk „Alle ohne Zuständigen → Vincent“),
// Dubletten „Aktualisieren / Überspringen“ (nur Allgemein; Sheet-Preset aktualisiert leere Felder).
import { useMemo, useState } from 'react'
import { useCompanies, useMembers, useSettings } from '@/data'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import { Button, Chip, Segment, Select, StatusChip } from '@/components/ui'
import { linkedinAnzeige } from '@/lib/url'
import { fmtDatum, fmtZahl } from '@/lib/format'
import { GRUND_LABEL, PHASE_LABEL } from '@/texte/de'
import { phaseVon } from '@/lib/stufen'
import type { EndedReason, LeadStage, Member } from '@/types/domain'
import { firmaGesperrt, StatusChipImport, Zaehler, type ImportStatus } from './components/Assistent'
import type { CrmZeile, SheetDryRunZeile } from './presets/crmTabelle'
import { tagesSumme } from './presets/kpiMonat'
import type { Entscheidung, ImportApi } from './useImport'
import { anzeigeName } from '@/lib/mitglied'

const NAMEN = ['Vincent', 'Mike'] as const

function memberName(members: Member[] | undefined, id: string | null | undefined): string {
  if (!id) return '–'
  const m = members?.find((x) => x.id === id)
  return anzeigeName(m, '–')
}

// ── CRM-Tabelle ──────────────────────────────────────────────────────────────
type CrmAnzeige = { z: CrmZeile; _row: number; _dry: SheetDryRunZeile | null; _chips: ImportStatus[] }

function CrmPruefen({ api }: { api: ImportApi }) {
  const { crm, crmHinweise: h, state, crmOhneZustaendig } = api
  const firmen = useCompanies()
  const members = useMembers()
  const settings = useSettings()
  const [cursor, setCursor] = useState<string | null>(null)
  const dry = state.dryRun?.art === 'sheet' ? state.dryRun.ergebnis : null

  const zeilen = useMemo<CrmAnzeige[]>(() => {
    if (!crm) return []
    const dryById = new Map<number, SheetDryRunZeile>()
    for (const z of dry?.hinweise ?? []) if (typeof z.id === 'number' && z.stufe) dryById.set(z.id, z)
    return crm.rows.map((r) => {
      const chips: ImportStatus[] = []
      const id = typeof r['id'] === 'number' ? r['id'] : null
      const _dry = id !== null ? (dryById.get(id) ?? null) : null
      const zust = state.zustaendigJeZeile[r._row] ?? r.dm_zustaendigkeit_resolved
      if (!zust) chips.push('ohne_zustaendig')
      else if (r._errors?.includes('dm_zustaendigkeit')) chips.push('error')
      if (!r['unternehmen']) chips.push('unvollstaendig')
      if (typeof r['notizen'] === 'string' && /nicht anschreiben/i.test(r['notizen'])) chips.push('nicht_anschreiben')
      if (firmaGesperrt(typeof r['unternehmen'] === 'string' ? r['unternehmen'] : null, firmen.data))
        chips.push('firma_gesperrt')
      if (r['mike_akzeptiert'] === 'Ja' && r['vincent_akzeptiert'] === 'Ja') chips.push('beide_angefragt')
      return { z: r, _row: r._row, _dry, _chips: chips }
    })
  }, [crm, dry, firmen.data, state.zustaendigJeZeile])

  const hinweisZaehler = useMemo(() => {
    const m = new Map<string, number>()
    for (const z of dry?.hinweise ?? []) {
      const t = z.hinweis ?? z.warnung
      if (t) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [dry])

  const spalten = useMemo<DataTableSpalte<CrmAnzeige>[]>(() => {
    const s = spaltenHelper<CrmAnzeige>()
    return s.columns([
      s.accessor((r) => (typeof r.z['id'] === 'number' ? r.z['id'] : r._row), {
        id: 'id',
        header: 'ID',
        meta: { mono: true, rechts: true, breite: '56px' },
      }),
      s.accessor((r) => (typeof r.z['vor_und_nachname'] === 'string' ? r.z['vor_und_nachname'] : '–'), {
        id: 'name',
        header: 'Name',
        meta: { breite: '18%' },
      }),
      s.accessor((r) => (typeof r.z['unternehmen'] === 'string' ? r.z['unternehmen'] : ''), {
        id: 'firma',
        header: 'Unternehmen',
        meta: { breite: '16%', ausblenden: 'lg' },
        cell: (c) => c.getValue() || <span className="text-ink-3">–</span>,
      }),
      s.accessor((r) => (typeof r.z['status'] === 'string' ? r.z['status'] : ''), {
        id: 'status',
        header: 'Sheet-Status',
        meta: { breite: '11%', ausblenden: 'xl' },
        cell: (c) => c.getValue() || <span className="text-ink-3">–</span>,
      }),
      s.display({
        id: 'stufe',
        header: 'Stufe',
        meta: { breite: '12%' },
        cell: (c) => {
          const d = c.row.original._dry
          if (!d?.stufe) return <span className="text-ink-3">–</span>
          return (
            <span className="flex items-center gap-1.5">
              <StatusChip stage={d.stufe as LeadStage} settings={settings.data} />
              {d.grund ? (
                <span className="text-small text-ink-3">{GRUND_LABEL[d.grund as EndedReason] ?? d.grund}</span>
              ) : null}
            </span>
          )
        },
      }),
      s.display({
        id: 'zustaendig',
        header: 'Zuständig',
        meta: { breite: '12%' },
        cell: (c) => {
          const r = c.row.original.z
          const wahl = state.zustaendigJeZeile[r._row] ?? r.dm_zustaendigkeit_resolved
          if (wahl && !r._errors?.includes('dm_zustaendigkeit')) return <span>{wahl}</span>
          return (
            <Select
              aria-label={`Zuständig für Zeile ${r._row}`}
              value={wahl ?? ''}
              platzhalter="Wählen"
              className="h-7 text-[12.5px]"
              onChange={(e) => api.setzeZustaendigZeile(r._row, e.target.value || null)}
              optionen={NAMEN.map((n) => ({ value: n, label: n }))}
            />
          )
        },
      }),
      s.display({
        id: 'naechster',
        header: 'Nächster',
        meta: { mono: true, rechts: true, breite: '9%', ausblenden: 'lg' },
        cell: (c) => {
          const n = c.row.original._dry?.naechster
          return n ? fmtDatum(n) : <span className="text-ink-3">–</span>
        },
      }),
      s.display({
        id: 'chips',
        header: 'Hinweis',
        cell: (c) => (
          <span className="flex flex-wrap gap-1">
            {c.row.original._chips.map((ch) => (
              <StatusChipImport key={ch} status={ch} />
            ))}
          </span>
        ),
      }),
    ])
  }, [state.zustaendigJeZeile, settings.data, api])

  if (!crm || !h) return null
  return (
    <div className="grid gap-4">
      <Zaehler
        eintraege={[
          { wert: fmtZahl(h.zeilen), label: 'Zeilen' },
          { wert: fmtZahl(dry?.vorschau ?? 0), label: 'geprüft' },
          { wert: fmtZahl(h.ohneUnternehmen), label: 'ohne Unternehmen' },
          { wert: fmtZahl(h.ohneStatus), label: 'ohne Status' },
          { wert: fmtZahl(h.mitError), label: 'mit #ERROR!', ton: h.mitError ? 'overdue' : undefined },
          {
            wert: fmtZahl(crmOhneZustaendig.length),
            label: 'ohne Zuständigen',
            ton: crmOhneZustaendig.length ? 'overdue' : undefined,
          },
          { wert: fmtZahl(h.beideAngefragt), label: 'beide angefragt' },
          {
            wert: fmtZahl(h.nichtAnschreiben),
            label: 'Nicht anschreiben',
            ton: h.nichtAnschreiben ? 'danger' : undefined,
          },
        ]}
      />
      {hinweisZaehler.length > 0 ? (
        <p className="text-small text-ink-2 flex flex-wrap gap-x-3 gap-y-1">
          {hinweisZaehler.map(([text, n]) => (
            <span key={text}>
              <span className="tnum text-ink font-mono">{n} ×</span> {text}
            </span>
          ))}
        </p>
      ) : null}
      {crmOhneZustaendig.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui text-overdue">
            {crmOhneZustaendig.length} Zeilen ohne Zuständigen – Pflichtauswahl.
          </span>
          {NAMEN.map((n) => (
            <Button key={n} groesse="S" onClick={() => api.alleOhneZustaendig(n)}>
              Alle ohne Zuständigen → {n}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-small text-ink-3">
        Sheet-Preset: vorhandene Leads werden nur in leeren Feldern ergänzt (idempotent) – kein „Sheet / CRM“-Konflikt.
      </p>
      <DataTable<CrmAnzeige>
        daten={zeilen}
        spalten={spalten}
        rowId={(r) => String(r._row)}
        cursorId={cursor}
        onCursor={setCursor}
        ariaLabel="Vorschau CRM-Tabelle"
        leer={<p className="text-ui text-ink-2 py-6">Keine Zeilen.</p>}
      />
      <span className="sr-only">{memberName(members.data, null)}</span>
    </div>
  )
}

// ── Allgemein (import_leads) ─────────────────────────────────────────────────
type LeadAnzeige = {
  index: number
  name: string
  company: string | null
  url: string | null
  status: ImportStatus
  existing_stage: LeadStage | null
  existing_owner: string | null
  firma_gesperrt: boolean
}

function AllgemeinPruefen({ api }: { api: ImportApi }) {
  const { state, allgemein } = api
  const firmen = useCompanies()
  const members = useMembers()
  const [cursor, setCursor] = useState<string | null>(null)
  const e = state.dryRun?.art === 'leads' ? state.dryRun.ergebnis : null

  const zeilen = useMemo<LeadAnzeige[]>(() => {
    if (!allgemein) return []
    return allgemein.rows.map((r, i) => {
      const s = e?.rows[i]
      const company = s?.company ?? r.company ?? null
      return {
        index: i,
        name: s?.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.name || '–',
        company,
        url: s?.linkedin_url_norm ?? r.linkedin_url ?? null,
        status: s?.status ?? 'neu',
        existing_stage: s?.existing_stage ?? null,
        existing_owner: s?.existing_owner ?? null,
        firma_gesperrt: firmaGesperrt(company, firmen.data),
      }
    })
  }, [allgemein, e, firmen.data])

  const spalten = useMemo<DataTableSpalte<LeadAnzeige>[]>(() => {
    const s = spaltenHelper<LeadAnzeige>()
    return s.columns([
      s.accessor('name', { header: 'Name', meta: { breite: '20%' } }),
      s.accessor('company', {
        header: 'Unternehmen',
        meta: { breite: '18%', ausblenden: 'lg' },
        cell: (c) => c.getValue() ?? <span className="text-ink-3">–</span>,
      }),
      s.accessor('url', {
        header: 'LinkedIn',
        meta: { mono: true, breite: '18%', ausblenden: 'xl' },
        cell: (c) => (c.getValue() ? linkedinAnzeige(c.getValue()) : <span className="text-ink-3">–</span>),
      }),
      s.display({
        id: 'status',
        header: 'Status',
        cell: (c) => {
          const r = c.row.original
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusChipImport status={r.status} />
              {r.status === 'duplikat' && r.existing_stage ? (
                <span className="text-small text-ink-3">
                  {PHASE_LABEL[phaseVon(r.existing_stage).key]} · {memberName(members.data, r.existing_owner)}
                </span>
              ) : null}
              {r.firma_gesperrt ? <StatusChipImport status="firma_gesperrt" /> : null}
            </span>
          )
        },
      }),
      s.display({
        id: 'entscheidung',
        header: 'Konflikt',
        meta: { breite: '220px' },
        cell: (c) => {
          const r = c.row.original
          if (r.status !== 'duplikat') return null
          const wert: Entscheidung = state.entscheidungen[r.index] ?? 'aktualisieren'
          return (
            <Segment<Entscheidung>
              klein
              ariaLabel={`Dublette ${r.name}`}
              wert={wert}
              onChange={(k) => api.setzeEntscheidung(r.index, k)}
              optionen={[
                { key: 'aktualisieren', label: 'Aktualisieren' },
                { key: 'ueberspringen', label: 'Überspringen' },
              ]}
            />
          )
        },
      }),
    ])
  }, [state.entscheidungen, members.data, api])

  if (!allgemein) return null
  const ueberspringen = Object.values(state.entscheidungen).filter((x) => x === 'ueberspringen').length
  return (
    <div className="grid gap-4">
      <Zaehler
        eintraege={[
          { wert: fmtZahl(allgemein.rows.length), label: 'Zeilen' },
          { wert: fmtZahl(e?.inserted ?? 0), label: 'neu' },
          {
            wert: fmtZahl(e?.updated ?? 0),
            label: 'Dubletten (werden ergänzt)',
            ton: e?.updated ? 'overdue' : undefined,
          },
          { wert: fmtZahl(e?.skipped ?? 0), label: 'Archiv' },
          { wert: fmtZahl(e?.blocked ?? 0), label: 'Sperrlisten-Treffer', ton: e?.blocked ? 'danger' : undefined },
          { wert: fmtZahl(e?.invalid ?? 0), label: 'ungültig', ton: e?.invalid ? 'danger' : undefined },
          { wert: fmtZahl(ueberspringen), label: 'übersprungen (Wahl)' },
        ]}
      />
      <p className="text-small text-ink-3">
        Dubletten werden nur in leeren Feldern ergänzt, nie doppelt angelegt. „Als neuen Lead“ ist bei gleicher URL
        nicht möglich (Unique-Index).
      </p>
      <DataTable<LeadAnzeige>
        daten={zeilen}
        spalten={spalten}
        rowId={(r) => String(r.index)}
        cursorId={cursor}
        onCursor={setCursor}
        ariaLabel="Vorschau Import"
        leer={<p className="text-ui text-ink-2 py-6">Keine Zeilen.</p>}
      />
    </div>
  )
}

// ── KPI-Monat (lokale Vorschau) ──────────────────────────────────────────────
function KpiPruefen({ api }: { api: ImportApi }) {
  const { kpi, state } = api
  if (!kpi) return null
  const werte = kpi.months.reduce(
    (n, m) =>
      n +
      m.sections
        .filter((s) => s.key !== 'sales_calls')
        .reduce((k, s) => k + s.metrics.filter((x) => x.value !== null).length, 0),
    0,
  )
  const tage = kpi.months.reduce((n, m) => n + m.daily.filter((d) => d.gespraeche_eroeffnet > 0).length, 0)
  return (
    <div className="grid gap-5">
      <Zaehler
        eintraege={[
          { wert: fmtZahl(kpi.months.length), label: 'Monate' },
          { wert: fmtZahl(werte), label: 'Monatswerte' },
          { wert: fmtZahl(tage), label: 'Tageswerte' },
          { wert: state.person, label: 'Person' },
        ]}
      />
      {kpi.months.map((m) => (
        <section key={m.tab} className="border-line-strong rounded-md border px-4 py-3">
          <h3 className="text-h3 text-ink mb-2 flex items-center gap-3">
            {m.tab}
            <span className="text-ink-3 tnum font-mono text-[12.5px]">
              Σ Tageswerte {fmtZahl(tagesSumme(m))} (gilt als Monatssumme)
            </span>
          </h3>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {m.sections
              .filter((s) => s.key !== 'sales_calls')
              .flatMap((s) => s.metrics)
              .map((x) => (
                <div key={x.key} className="hairline flex h-8 items-center justify-between gap-4">
                  <span className="text-ui text-ink-2 truncate">{x.label}</span>
                  <span className="text-ink tnum font-mono text-[13px]">
                    {x.value === null ? <span className="text-ink-3">–</span> : fmtZahl(x.value)}
                    <span className="text-ink-3 ml-2 text-[11px]">{x.cell}</span>
                  </span>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── DM-Leitfäden (lokale Vorschau) ──────────────────────────────────────────
function LeitfaedenPruefen({ api }: { api: ImportApi }) {
  const { leitfaeden } = api
  if (!leitfaeden) return null
  return (
    <div className="grid gap-4">
      <Zaehler
        eintraege={[
          { wert: fmtZahl(leitfaeden.rows.length), label: 'Leitfäden' },
          { wert: fmtZahl(leitfaeden.tabs.length), label: 'Tabs' },
          {
            wert: fmtZahl(leitfaeden.ohneText),
            label: 'ohne Text (inaktiv)',
            ton: leitfaeden.ohneText ? 'overdue' : undefined,
          },
        ]}
      />
      <table className="w-full border-collapse" aria-label="Vorschau Leitfäden">
        <thead>
          <tr className="hairline">
            <th className="label h-8 text-left">Phase</th>
            <th className="label h-8 text-left">Leitfaden</th>
            <th className="label h-8 text-left max-md:hidden">Wann verwenden?</th>
            <th className="label h-8 text-left">Nachricht</th>
          </tr>
        </thead>
        <tbody>
          {leitfaeden.rows.map((r) => (
            <tr key={`${r.legacy_phase}-${r.legacy_order}`} className="hairline h-10 align-top">
              <td className="text-ink-2 tnum py-2 pr-3 font-mono text-[12.5px]">
                {r.legacy_phase}.{r.legacy_order}
              </td>
              <td className="text-ui text-ink py-2 pr-3">{r.name}</td>
              <td className="text-small text-ink-2 py-2 pr-3 max-md:hidden">{r.when_to_use ?? '–'}</td>
              <td className="text-small text-ink-2 max-w-[360px] py-2">
                {r.body ? <span className="line-clamp-2">{r.body}</span> : <Chip ton="ended">ohne Text</Chip>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SchrittPruefen({ api }: { api: ImportApi }) {
  switch (api.state.preset) {
    case 'crm_tabelle':
      return <CrmPruefen api={api} />
    case 'allgemein':
      return <AllgemeinPruefen api={api} />
    case 'kpi_monat':
      return <KpiPruefen api={api} />
    case 'leitfaeden':
      return <LeitfaedenPruefen api={api} />
    default:
      return <p className="text-ui text-ink-2">Erst Preset und Datei wählen.</p>
  }
}
