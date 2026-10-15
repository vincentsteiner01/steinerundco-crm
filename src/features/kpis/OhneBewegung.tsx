// BAUPLAN § 3.6 / § 7.4 Nr. 8 „Ohne Bewegung“: v_leads_ohne_bewegung (Beantwortet/Gepitcht, ≥ 5 Werktage ohne Ereignis, keine
// aktive Sequenz) als DataTable mit Aktionen „Sequenz starten“ (sequenzen/public), „Wiedervorlage“ `W`, „Beenden“ `B`
// (aktionen/*, Taste gilt für die Zeile unter dem Cursor); Enter → Peek (`?lead=`).
import { useMemo } from 'react'
import { Beenden, Wiedervorlage } from '@/components/aktionen'
import { StatusChip } from '@/components/ui/Chip'
import { DataTable, spaltenHelper, type DataTableSpalte } from '@/components/tabelle'
import { SequenzStartenMenue } from '@/features/sequenzen/public'
import { fmtZahl } from '@/lib/format'
import { phaseVon } from '@/lib/stufen'
import { PHASE_LABEL } from '@/texte/de'
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
        // Name = Rest; Zahl und Aktionen fest (Runde 3: bei 1024 „OHNE BE…“, „10 Werk…“, Aktionen zweizeilig)
        meta: { oeffnet: true, breite: 'auto' },
        cell: ({ row }) => {
          const l = row.original
          // Unter 1280 px stehen Firma und Phase unter dem Namen (Spalten ausgeblendet) – Runde 3: „Beantw…“ bei 1024
          // Phase wie der Chip: die Gruppe („Beantwortet“), nicht die Feinstufe
          const unter = [l.company_name, l.stage ? PHASE_LABEL[phaseVon(l.stage).key] : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <span className="block min-w-0">
              <span className="text-ink-bright block truncate" title={l.full_name ?? undefined}>
                {l.full_name ?? '–'}
              </span>
              {unter ? (
                <span className="text-ink-3 block truncate text-[11.5px] xl:hidden" title={unter}>
                  {unter}
                </span>
              ) : null}
            </span>
          )
        },
      }),
      h.accessor('company_name', {
        header: 'Unternehmen',
        meta: { breite: '16%', ausblenden: 'xl' },
        cell: ({ getValue }) => (
          <span className="block truncate" title={getValue() ?? undefined}>
            {getValue() ?? '–'}
          </span>
        ),
      }),
      h.accessor('stage', {
        header: 'Phase',
        meta: { breite: '12%', ausblenden: 'xl' },
        cell: ({ getValue }) => {
          const s = getValue()
          return s ? <StatusChip stage={s} settings={settings} /> : null
        },
      }),
      h.accessor('tage_ohne_bewegung', {
        header: 'Ohne Bewegung',
        meta: { rechts: true, mono: true, breite: '96px', kopfUmbruch: true },
        cell: ({ getValue }) => {
          const n = fmtZahl(getValue() ?? 0)
          // Unter 1280 px „10 WT“ (Runde 3: „10 Werk…“ ohne title)
          return (
            <span title={`${n} Werktage ohne Bewegung`}>
              <span className="max-xl:hidden">{n} Werktage</span>
              <span className="xl:hidden">{n} WT</span>
            </span>
          )
        },
      }),
      h.display({
        id: 'aktionen',
        header: 'Aktionen',
        meta: { klasse: 'overflow-visible', breite: '412px' },
        cell: ({ row }) => {
          const aktiv = cursorId === row.original.id
          return (
            // Runde 3 (echte Daten, 1440 px): die drei Knöpfe brauchen ≈ 385 px – in 28 % (318 px) schob sich „Wiedervorlage“ über
            // „Sequenz starten“ und „Beenden“ lag rechts außerhalb. Jetzt 412 px fest (Runde 3: Knöpfe 383 px), Knöpfe schrumpfen nie, sonst Umbruch.
            // Unter 1280 px ohne Tastenhinweise in den Knöpfen – dann passen alle drei in eine Zeile (Runde 3, 1024: Umbruch,
            // ungleiche Zeilenhöhen); die Tasten W/B gelten weiter für die Zeile unter dem Cursor
            <span
              data-aktionen
              className="flex flex-wrap items-center gap-1 max-xl:[&_kbd]:hidden [&>*]:shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
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
        className="max-xl:[&>table]:min-w-0 max-md:[&>table]:min-w-[720px]"
      />
    </section>
  )
}
