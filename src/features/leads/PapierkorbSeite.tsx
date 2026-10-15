// BAUPLAN § 3.3 `PapierkorbSeite.tsx` (ux § 3.2.3 Ansicht papierkorb, § 4.1, § 4.8, LE-13): Liste deleted_at (30 Tage), Wiederherstellen,
// Endgültig löschen nur nach Dialog DIALOG.endgueltigLoeschen (delete from leads, Cascade).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { DataTable } from '@/components/tabelle'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLeadEndgueltigLoeschen, useLeadsUnendlich, useLeadWiederherstellen } from '@/data/leads'
import { useMembers } from '@/data/members'
import { useSettings } from '@/data/settings'
import { heuteBerlin } from '@/lib/format'
import { DIALOG, LEER } from '@/texte/de'
import { ansichtNachKey } from './ansichten'
import { useStabileListe } from './hilfen'
import { leadSpalten, mitFirmensperre, type LeadZeile } from './spalten'

export function Component() {
  const navigate = useNavigate()
  const ansicht = ansichtNachKey('papierkorb')
  const geladen = useLeadsUnendlich({ ...ansicht.filter, sort: ansicht.sort })
  const leads = useStabileListe(geladen.data)
  const istLaden = geladen.istLaden
  const { data: settings } = useSettings()
  const { data: members } = useMembers()
  const wiederherstellen = useLeadWiederherstellen()
  const endgueltig = useLeadEndgueltigLoeschen()
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [loeschen, setLoeschen] = useState<LeadZeile | null>(null)
  const heute = heuteBerlin()
  const rows = useMemo<LeadZeile[]>(() => leads.map((l) => mitFirmensperre(l, false, false)), [leads])
  const spalten = useMemo(
    () =>
      leadSpalten(ansicht.spalten, {
        heute,
        settings,
        members: members ?? [],
        bearbeitung: null,
        onSave: () => undefined,
        onCancel: () => undefined,
        onTab: () => undefined,
      }),
    [ansicht.spalten, heute, settings, members],
  )
  const cursor = rows.find((r) => r.id === cursorId) ?? null

  const zurueck = async (l: LeadZeile) => {
    try {
      await wiederherstellen.mutateAsync(l.id)
      toast(`${l.full_name ?? 'Lead'} wiederhergestellt.`)
    } catch {
      /* Toast aus der Mutation */
    }
  }
  const weg = async () => {
    if (!loeschen) return
    try {
      await endgueltig.mutateAsync(loeschen.id)
      toast(`${loeschen.full_name ?? 'Lead'} endgültig gelöscht.`)
      setLoeschen(null)
    } catch {
      /* Toast aus der Mutation */
    }
  }

  return (
    <>
      <SeitenKopf
        titel="Papierkorb"
        kontext={`${rows.length} ${rows.length === 1 ? 'Lead' : 'Leads'}`}
        rechts={
          <Button variante="quiet" onClick={() => navigate(PFADE.leads)}>
            Zurück zu Leads
          </Button>
        }
      />
      {istLaden && rows.length === 0 ? (
        <Skeleton zeilen={4} />
      ) : (
        <DataTable<LeadZeile>
          ariaLabel="Papierkorb"
          daten={rows}
          spalten={spalten}
          rowId={(r) => r.id}
          cursorId={cursorId}
          onCursor={setCursorId}
          onEnter={(r) => setCursorId(r.id)}
          leer={<EmptyState titel={LEER.papierkorb.titel} satz={LEER.papierkorb.satz} />}
        />
      )}
      {cursor ? (
        <div
          className="bg-surface-raised shadow-float fixed bottom-6 left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-1.5 rounded-md pr-2.5 pl-4 text-[13.5px]"
          role="toolbar"
          aria-label="Papierkorb-Aktionen"
        >
          <span className="mr-2 truncate">{cursor.full_name}</span>
          <Button
            variante="secondary"
            groesse="S"
            busy={wiederherstellen.isPending}
            onClick={() => void zurueck(cursor)}
          >
            Wiederherstellen
          </Button>
          <Button variante="danger" groesse="S" onClick={() => setLoeschen(cursor)}>
            Endgültig löschen …
          </Button>
        </div>
      ) : null}
      <Dialog
        offen={!!loeschen}
        onOpenChange={(o) => !o && setLoeschen(null)}
        titel={loeschen?.full_name ?? 'Lead'}
        text={DIALOG.endgueltigLoeschen.text}
        primaer={{
          label: DIALOG.endgueltigLoeschen.primaer,
          danger: true,
          busy: endgueltig.isPending,
          onClick: () => void weg(),
        }}
      />
    </>
  )
}
