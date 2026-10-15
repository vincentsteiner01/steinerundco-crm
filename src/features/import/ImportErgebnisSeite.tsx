// oxlint-disable react/only-export-components -- Seite exportiert `Component` (Router-Vertrag) plus `undoMoeglich` für den Test
// BAUPLAN § 3.8 ImportErgebnisSeite: Batch-Detail (import_batches + summary.rows), „Rückgängig“ (Dialog ux § 4.8 → rpc.undoImport;
// nur wenn undone_at null und created_at ≤ 30 T, nur Quellen schnellimport/import_csv – Sheet-Importe sind idempotent, § 6.4).
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useImportBatch, useMembers, useUndoImport } from '@/data'
import { toast } from '@/components/toast'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import { Button, Chip, Dialog, EmptyState, KopfStats, SeitenKopf, Skeleton } from '@/components/ui'
import { fmtDatum, fmtDatumZeit, fmtZahl } from '@/lib/format'
import { phaseVon } from '@/lib/stufen'
import { DIALOG, PHASE_LABEL } from '@/texte/de'
import type { ImportErgebnis, LeadStage } from '@/types/domain'
import { StatusChipImport, Zaehler } from './components/Assistent'
import type { SheetDryRunZeile } from './presets/crmTabelle'

type BatchZeile = ImportErgebnis['rows'][number] & { i: number }
const UNDO_TAGE = 30

export function undoMoeglich(
  b: { undone_at: string | null; created_at: string; source: string },
  jetzt = Date.now(),
): boolean {
  if (b.undone_at) return false
  if (b.source !== 'schnellimport' && b.source !== 'import_csv') return false
  return jetzt - Date.parse(b.created_at) <= UNDO_TAGE * 86400 * 1000
}

export function Component() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const batch = useImportBatch(batchId)
  const members = useMembers()
  const undo = useUndoImport()
  const [dialog, setDialog] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)

  const b = batch.data
  const summary = (b?.summary ?? null) as {
    rows?: ImportErgebnis['rows']
    hinweise?: SheetDryRunZeile[]
    undone_leads?: number
  } | null
  const rows = useMemo<BatchZeile[]>(() => (summary?.rows ?? []).map((r, i) => ({ ...r, i })), [summary])
  const hinweise = summary?.hinweise ?? []

  const spalten = useMemo<DataTableSpalte<BatchZeile>[]>(() => {
    const s = spaltenHelper<BatchZeile>()
    return s.columns([
      s.accessor('name', { header: 'Name', meta: { breite: '24%' } }),
      s.accessor('company', {
        header: 'Unternehmen',
        meta: { breite: '22%', ausblenden: 'lg' },
        cell: (c) => c.getValue() ?? <span className="text-ink-3">–</span>,
      }),
      s.accessor('linkedin_url_norm', {
        header: 'LinkedIn',
        meta: { mono: true, breite: '26%', ausblenden: 'xl' },
        cell: (c) => c.getValue() ?? <span className="text-ink-3">–</span>,
      }),
      s.accessor('status', {
        header: 'Status',
        cell: (c) => {
          const r = c.row.original
          return (
            <span className="flex items-center gap-1.5">
              <StatusChipImport status={r.status} />
              {r.status === 'duplikat' && r.existing_stage ? (
                <span className="text-small text-ink-3">
                  {PHASE_LABEL[phaseVon(r.existing_stage as LeadStage).key]} ·{' '}
                  {members.data?.find((m) => m.id === r.existing_owner)?.short_name ?? '–'}
                </span>
              ) : null}
            </span>
          )
        },
      }),
    ])
  }, [members.data])

  if (batch.isPending) {
    return (
      <>
        <SeitenKopf titel="Import-Ergebnis" />
        <Skeleton zeilen={4} />
      </>
    )
  }
  if (!b) {
    return (
      <>
        <SeitenKopf titel="Import-Ergebnis" />
        <EmptyState
          titel="Import nicht gefunden."
          satz="Den Stapel kennt das CRM nicht – vielleicht ist der Link alt."
          primaer={{ label: 'Zum Import', onClick: () => navigate(PFADE.import) }}
        />
      </>
    )
  }

  const kannUndo = undoMoeglich(b)
  const undoDialog = DIALOG.importRueckgaengig(
    fmtDatum(b.created_at),
    fmtZahl(b.row_count ?? 0),
    fmtZahl(b.inserted ?? 0),
  )
  const ausfuehrenUndo = async () => {
    const r = await undo.mutateAsync({ batchId: b.id })
    setDialog(false)
    toast(`${fmtZahl(r.deleted_leads)} Leads gelöscht.`)
  }
  const sheet = b.source === 'import_sheet'
  const geloescht = typeof summary?.undone_leads === 'number' ? summary.undone_leads : null

  return (
    <>
      <SeitenKopf
        titel={b.label ?? 'Import-Ergebnis'}
        dateline={`${fmtDatumZeit(b.created_at)} · ${b.preset ?? b.source}${b.file_name ? ` · ${b.file_name}` : ''} · ${members.data?.find((m) => m.id === b.member_id)?.short_name ?? '–'}`}
        rechts={
          <KopfStats
            eintraege={[
              { wert: fmtZahl(b.row_count ?? 0), label: 'Zeilen' },
              { wert: fmtZahl(b.inserted ?? 0), label: 'neu', ton: 'signal' },
              { wert: fmtZahl(b.updated ?? 0), label: 'aktualisiert' },
              { wert: fmtZahl(b.skipped ?? 0), label: 'übersprungen' },
              { wert: fmtZahl(b.blocked ?? 0), label: 'gesperrt', ton: b.blocked ? 'overdue' : undefined },
            ]}
          />
        }
      />
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {b.undone_at ? (
            <Chip ton="ended">
              rückgängig gemacht am {fmtDatum(b.undone_at)}
              {geloescht !== null ? ` · ${fmtZahl(geloescht)} Leads gelöscht` : ''}
            </Chip>
          ) : null}
          {!sheet ? (
            <Button variante="primary" onClick={() => navigate(`${PFADE.leads}?quelle=${encodeURIComponent(b.id)}`)}>
              Zu den Leads (Filter: dieser Import)
            </Button>
          ) : null}
          {kannUndo ? (
            <Button variante="danger" onClick={() => setDialog(true)}>
              Rückgängig
            </Button>
          ) : null}
          <Button variante="quiet" onClick={() => navigate(PFADE.import)}>
            Zum Import
          </Button>
        </div>
        {!kannUndo && !b.undone_at ? (
          <p className="text-small text-ink-3">
            {sheet
              ? 'Sheet-Import ist idempotent und wird durch einen erneuten Lauf korrigiert, nicht per Rückgängig (§ 6.4).'
              : 'Rückgängig ist nur bis 30 Tage nach dem Import möglich.'}
          </p>
        ) : null}
        {rows.length > 0 ? (
          <>
            <Zaehler
              eintraege={[
                { wert: fmtZahl(rows.filter((r) => r.status === 'neu').length), label: 'neu' },
                { wert: fmtZahl(rows.filter((r) => r.status === 'duplikat').length), label: 'Dubletten' },
                { wert: fmtZahl(rows.filter((r) => r.status === 'archiv').length), label: 'Archiv' },
                { wert: fmtZahl(rows.filter((r) => r.status === 'gesperrt').length), label: 'Sperrliste' },
                { wert: fmtZahl(rows.filter((r) => r.status === 'ungueltig').length), label: 'ungültig' },
              ]}
            />
            <DataTable<BatchZeile>
              daten={rows}
              spalten={spalten}
              rowId={(r) => String(r.i)}
              cursorId={cursor}
              onCursor={setCursor}
              ariaLabel="Zeilen des Imports"
            />
          </>
        ) : hinweise.length > 0 ? (
          <ul className="border-line-strong rounded-md border" aria-label="Hinweise">
            {hinweise.slice(0, 200).map((h, i) => (
              <li
                key={i}
                className="hairline text-small text-ink-2 flex min-h-8 items-center gap-3 px-3 py-1 last:border-b-0"
              >
                <span className="text-ink-3 tnum w-10 font-mono">{h.id ?? '–'}</span>
                <span className="text-ink min-w-0 flex-1 truncate">{h.name ?? '–'}</span>
                <span>{h.hinweis ?? h.warnung ?? ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-ink-2">Keine Zeilen gespeichert.</p>
        )}
      </div>
      <Dialog
        offen={dialog}
        onOpenChange={setDialog}
        titel="Import rückgängig machen?"
        text={undoDialog.text}
        primaer={{
          label: undoDialog.primaer,
          onClick: () => void ausfuehrenUndo(),
          danger: true,
          busy: undo.isPending,
        }}
      />
    </>
  )
}
