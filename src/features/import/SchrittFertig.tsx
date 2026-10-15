// BAUPLAN § 3.8 SchrittFertig: Zusammenfassung display-sm, „Zu den Leads (Filter: dieser Import)“ → /leads?quelle=<batchId>, „Rückgängig“.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUndoImport } from '@/data'
import { toast } from '@/components/toast'
import { Button, Dialog } from '@/components/ui'
import { fmtDatum, fmtZahl, heuteBerlin, monatLabel } from '@/lib/format'
import { DIALOG } from '@/texte/de'
import type { ImportApi } from './useImport'

function Zahl({ wert, label }: { wert: number; label: string }) {
  return (
    <div>
      <span className="text-display-sm text-ink-bright tnum block font-mono">{fmtZahl(wert)}</span>
      <span className="text-small text-ink-3 mt-1 block">{label}</span>
    </div>
  )
}

export function SchrittFertig({ api }: { api: ImportApi }) {
  const navigate = useNavigate()
  const undo = useUndoImport()
  const [dialog, setDialog] = useState(false)
  const [rueckgaengig, setRueckgaengig] = useState<number | null>(null)
  const f = api.state.fertig
  if (!f) return null

  const batchId = f.art === 'leads' || f.art === 'sheet' ? f.ergebnis.batch_id : null
  const zeilen =
    f.art === 'leads'
      ? f.ergebnis.rows.length
      : f.art === 'sheet'
        ? (f.ergebnis.leads_neu ?? 0) + (f.ergebnis.leads_aktualisiert ?? 0) + (f.ergebnis.uebersprungen ?? 0)
        : 0
  const undoDialog = DIALOG.importRueckgaengig(
    fmtDatum(heuteBerlin()),
    fmtZahl(zeilen),
    fmtZahl(f.art === 'leads' ? f.ergebnis.inserted : 0),
  )

  const ausfuehrenUndo = async () => {
    if (!batchId) return
    const r = await undo.mutateAsync({ batchId })
    setRueckgaengig(r.deleted_leads)
    setDialog(false)
    toast(`${fmtZahl(r.deleted_leads)} Leads gelöscht.`)
  }

  return (
    <div className="grid max-w-[720px] gap-7">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {f.art === 'leads' ? (
          <>
            <Zahl wert={f.ergebnis.inserted} label="neu angelegt" />
            <Zahl wert={f.ergebnis.updated} label="Dubletten ergänzt" />
            <Zahl wert={f.ergebnis.skipped + f.ergebnis.invalid} label="übersprungen" />
            <Zahl wert={f.ergebnis.blocked} label="gesperrt" />
          </>
        ) : f.art === 'sheet' ? (
          <>
            <Zahl wert={f.ergebnis.leads_neu ?? 0} label="Leads neu" />
            <Zahl wert={f.ergebnis.leads_aktualisiert ?? 0} label="aktualisiert" />
            <Zahl wert={f.ergebnis.sequenzen ?? 0} label="Sequenzen" />
            <Zahl wert={f.ergebnis.aufgaben ?? 0} label="Wiedervorlagen" />
          </>
        ) : f.art === 'kpi' ? (
          <>
            <Zahl wert={f.ergebnis.monatswerte} label="Monatswerte" />
            <Zahl wert={f.ergebnis.tageswerte} label="Tageswerte" />
            <div className="col-span-2">
              <span className="text-display-sm text-ink-bright block font-mono">{f.ergebnis.monate.length}</span>
              <span className="text-small text-ink-3 mt-1 block">
                {f.ergebnis.monate.map(monatLabel).join(' · ') || 'Monate'}
              </span>
            </div>
          </>
        ) : (
          <>
            <Zahl wert={f.ergebnis.inserted} label="Leitfäden neu" />
            <Zahl wert={f.ergebnis.updated} label="aktualisiert" />
          </>
        )}
      </div>
      {rueckgaengig !== null ? (
        <p className="text-ui text-ink-2" role="status">
          Rückgängig gemacht – {fmtZahl(rueckgaengig)} Leads gelöscht.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {batchId && (f.art === 'leads' || f.art === 'sheet') ? (
          <Button variante="primary" onClick={() => navigate(`${PFADE.leads}?quelle=${encodeURIComponent(batchId)}`)}>
            Zu den Leads (Filter: dieser Import)
          </Button>
        ) : f.art === 'kpi' ? (
          <Button variante="primary" onClick={() => navigate(PFADE.kpis)}>
            Zu den KPIs
          </Button>
        ) : (
          <Button variante="primary" onClick={() => navigate(PFADE.leitfaeden)}>
            Zu den Leitfäden
          </Button>
        )}
        {batchId && api.info?.undo && rueckgaengig === null ? (
          <Button variante="danger" onClick={() => setDialog(true)}>
            Rückgängig
          </Button>
        ) : null}
        {batchId ? (
          <Button variante="quiet" onClick={() => navigate(PFADE.importErgebnis(batchId))}>
            Import-Details
          </Button>
        ) : null}
        <Button variante="quiet" onClick={api.neu}>
          Weiterer Import
        </Button>
      </div>
      {f.art === 'sheet' ? (
        <p className="text-small text-ink-3">
          Sheet-Import ist idempotent: ein zweiter Lauf derselben Datei legt nichts doppelt an, sondern korrigiert –
          deshalb kein Rückgängig.
        </p>
      ) : null}
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
    </div>
  )
}
