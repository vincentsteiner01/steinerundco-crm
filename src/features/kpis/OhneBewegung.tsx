// BAUPLAN § 3.6 / § 7.4 Nr. 8 „Ohne Bewegung“: v_leads_ohne_bewegung (Beantwortet/Gepitcht, ≥ 5 Werktage ohne Ereignis, keine
// aktive Sequenz) als DataTable mit Aktionen „Sequenz starten“ (sequenzen/public), „Wiedervorlage“ `W`, „Beenden“ `B`
// (aktionen/*, Taste gilt für die Zeile unter dem Cursor); Enter → Peek (`?lead=`).
import { useMemo } from 'react'
import { Beenden, Wiedervorlage } from '@/components/aktionen'
import { StatusChip } from '@/components/ui/Chip'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import { SequenzStartenMenue } from '@/features/sequenzen/public'
import { fmtZahl } from '@/lib/format'
import type { LeadOhneBewegung, Settings } from '@/types/domain'
import { BlockKopf } from './_Teile'

export type OhneBewegungProps = {
  leads: readonly LeadOhneBewegung[]
  settings: Settings | undefined
  cursorId: string | null
  onCursor: (id: string) => void
  onOeffnen: (leadId: string) => void
}

type Zeile = LeadOhneBewegung & { id: string }
const h = spaltenHelper<Zeile>()

export function OhneBewegung({ leads, settings, cursorId, onCursor, onOeffnen }: OhneBewegungProps) {
  const zeilen = useMemo<Zeile[]>(
    () =>
      leads
        .filter((l): l is LeadOhneBewegung & { lead_id: string } => !!l.lead_id)
        .map((l) => ({ ...l, id: l.lead_id })),
    [leads],
  )
  const spalten = useMemo<DataTableSpalte<Zeile>[]>(
    () => [
      h.accessor('full_name', {
        header: 'Name',
        meta: { oeffnet: true, breite: '24%' },
        cell: ({ getValue }) => <span className="text-ink-bright">{getValue() ?? '–'}</span>,
      }),
      h.accessor('company_name', { header: 'Unternehmen', meta: { breite: '22%', ausblenden: 'xl' } }),
      h.accessor('stage', {
        header: 'Phase',
        meta: { breite: '14%' },
        cell: ({ getValue }) => {
          const s = getValue()
          return s ? <StatusChip stage={s} settings={settings} /> : null
        },
      }),
      h.accessor('tage_ohne_bewegung', {
        header: 'Ohne Bewegung',
        meta: { rechts: true, mono: true, breite: '12%' },
        cell: ({ getValue }) => `${fmtZahl(getValue() ?? 0)} Werktage`,
      }),
      h.display({
        id: 'aktionen',
        header: 'Aktionen',
        meta: { klasse: 'overflow-visible' },
        cell: ({ row }) => {
          const aktiv = cursorId === row.original.id
          return (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <SequenzStartenMenue leadId={row.original.id} kanal="linkedin" />
              <Wiedervorlage leadId={row.original.id} aktiv={aktiv} />
              <Beenden leadId={row.original.id} aktiv={aktiv} />
            </span>
          )
        },
      }),
    ],
    [settings, cursorId],
  )
  return (
    <section aria-label="Ohne Bewegung">
      <BlockKopf
        titel="Ohne Bewegung"
        hinweis="Beantwortet oder gepitcht, seit 5 Werktagen nichts passiert, keine Sequenz aktiv"
      />
      <DataTable<Zeile>
        daten={zeilen}
        spalten={spalten}
        rowId={(r) => r.id}
        cursorId={cursorId}
        onCursor={onCursor}
        onEnter={(r) => onOeffnen(r.id)}
        sticky={false}
        ariaLabel="Leads ohne Bewegung"
        leer={<p className="text-small text-ink-3">Alle Gespräche in Bewegung.</p>}
        className="max-xl:[&>table]:min-w-0 max-md:[&>table]:min-w-[600px]"
      />
    </section>
  )
}
