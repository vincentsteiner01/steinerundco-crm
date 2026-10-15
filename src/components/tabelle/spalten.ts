// tabelle/spalten.ts – Feature-Registry, Spalten-Helfer und Maße der DataTable (BAUPLAN § 3.1.10, DESIGN-SYSTEM § 5.10).
// Keine Komponenten hier (oxlint react/only-export-components), damit DataTable.tsx nur die Komponente exportiert.
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'

/** Registrierte Features (v9: explizit, modulweit stabil). Auswahl und Gruppierung macht die Tabelle selbst (Set / Funktion aus den Props). */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic, datetime: sortFn_datetime },
})
export type DataTableFeatures = typeof dataTableFeatures

/** Spaltendefinition der DataTable (TanStack v9 trägt die Feature-Registry im Typ). */
// oxlint-disable-next-line typescript/no-explicit-any -- TValue je Spalte verschieden, wie helper.columns() es liefert
export type DataTableSpalte<T extends RowData> = ColumnDef<DataTableFeatures, T, any>
export type { RowData, SortingState }

/** Spalten-Helfer für Module: `const h = spaltenHelper<LeadMitBezug>(); h.accessor('full_name', { header: 'Name', meta: { oeffnet: true } })` */
export function spaltenHelper<T extends RowData>() {
  return createColumnHelper<DataTableFeatures, T>()
}

/**
 * `meta` je Spalte (gelesen über `column.columnDef.meta`):
 * - editierbar: `E`/Doppelklick rufen `onZelleBearbeiten(row, spalte)`; `Tab` springt zwischen editierbaren Spalten
 * - oeffnet: Klick auf die Zelle öffnet die Zeile (`onEnter`), ⌥Klick bearbeitet (ux § 3.2.2 Name)
 * - rechts: rechtsbündig (Datumsspalten) · mono: Geist Mono in der Zelle
 * - breite: CSS-Breite für `<col>` (z. B. '16%'); fehlt sie, gilt `size` (px) oder `auto`
 * - ausblenden: 'lg' = unter 1024 px aus (Letzte Bewegung, Notiz), 'xl' = unter 1280 px aus (Unternehmen – wird zweite Zeile)
 * - klasse: zusätzliche Klassen für Kopf und Zelle
 * - kopfTitel: Erklärung im `title` des Spaltenkopfs (statt nur des Kopftexts), z. B. was „Zuletzt“ zählt
 */
export type SpaltenMeta = {
  editierbar?: boolean
  oeffnet?: boolean
  rechts?: boolean
  mono?: boolean
  breite?: string
  ausblenden?: 'lg' | 'xl'
  klasse?: string
  kopfTitel?: string
}

export function spaltenMeta(def: { meta?: unknown }): SpaltenMeta {
  return (def.meta as SpaltenMeta | undefined) ?? {}
}

/** Standardbreiten der Leads-Tabelle (DESIGN-SYSTEM § 5.10, `table-layout: fixed`). Auswahl-Spalte ist fest 28 px. */
export const SPALTEN_BREITE = {
  auswahl: '28px',
  name: '16%',
  unternehmen: '13%',
  rolle: '4.5%',
  kanal: '6%',
  phase: '9.5%',
  schritt: '11%',
  zustaendig: '6%',
  letzteBewegung: '9.5%',
  naechsteAktion: '12%',
  notiz: 'auto',
} as const

/** Nächste editierbare Spalte in Tab-Richtung (zyklisch); null, wenn keine editierbar ist. */
export function naechsteEditierbareSpalte(
  spalten: readonly { id: string; editierbar: boolean }[],
  aktuell: string | null,
  richtung: 1 | -1 = 1,
): string | null {
  const editierbar = spalten.filter((s) => s.editierbar).map((s) => s.id)
  if (editierbar.length === 0) return null
  const i = aktuell ? editierbar.indexOf(aktuell) : -1
  if (i < 0) return richtung === 1 ? (editierbar[0] ?? null) : (editierbar[editierbar.length - 1] ?? null)
  return editierbar[(i + richtung + editierbar.length) % editierbar.length] ?? null
}

/** Ab dieser Zeilenzahl wird virtualisiert (BAUPLAN E18: ab 100; ux § 3.2.2 nennt 200 – BAUPLAN gilt). */
export const VIRTUALISIEREN_AB = 100
