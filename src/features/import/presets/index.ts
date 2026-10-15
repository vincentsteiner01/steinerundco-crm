// Preset-Registry (ux § 3.9.1, BAUPLAN § 3.8): Name, Erwartungstext, erlaubte Dateiarten. LinkedIn-Export = v1.1 (disabled-Zeile).
import type { DateiArt } from '../parser/xlsx'

export type PresetKey = 'crm_tabelle' | 'kpi_monat' | 'leitfaeden' | 'linkedin_export' | 'allgemein'

export type PresetInfo = {
  key: PresetKey
  name: string
  erwartung: string
  dateiarten: DateiArt[]
  /** v1.1 – nicht wählbar */
  deaktiviert?: string
  /** Dry-Run über die DB (import_sheet_leads / import_leads) */
  dryRun: boolean
  /** Rückgängig über undo_import möglich (Sheet-Importe sind idempotent, § 6.4) */
  undo: boolean
}

export const PRESETS: readonly PresetInfo[] = [
  {
    key: 'crm_tabelle',
    name: 'CRM-Tabelle',
    erwartung:
      'Erkennt ‚Vor- und Nachname‘, ‚LinkedIn URL‘, ‚Status‘, ‚Nächster Follow-Up am‘ … – Tab „CRM“ des Sheets.',
    dateiarten: ['xlsx'],
    dryRun: true,
    undo: false,
  },
  {
    key: 'kpi_monat',
    name: 'KPI-Monat',
    erwartung: 'Ein Tab je Monat; liest Monatswerte und Tageswerte ‚Gespräche eröffnet‘ – Person wählbar.',
    dateiarten: ['xlsx'],
    dryRun: false,
    undo: false,
  },
  {
    key: 'leitfaeden',
    name: 'DM-Leitfäden',
    erwartung: 'Tabs 1–4; Spalten Leitfaden · Wann verwenden? · Nachricht · Notizen.',
    dateiarten: ['xlsx'],
    dryRun: false,
    undo: false,
  },
  {
    key: 'linkedin_export',
    name: 'LinkedIn-Export',
    erwartung: 'Connections.csv / Invitations.csv aus ‚Kopie deiner Daten‘.',
    dateiarten: ['csv'],
    deaktiviert: 'v1.1',
    dryRun: true,
    undo: true,
  },
  {
    key: 'allgemein',
    name: 'Allgemein',
    erwartung: 'Freies Mapping: Name, Unternehmen, Position, LinkedIn-URL, Ort, Telefon, E-Mail, Notizen, Tags.',
    dateiarten: ['xlsx', 'csv'],
    dryRun: true,
    undo: true,
  },
]

export function presetInfo(key: PresetKey | null | undefined): PresetInfo | null {
  return PRESETS.find((p) => p.key === key) ?? null
}

export function istPresetKey(s: string | null | undefined): s is PresetKey {
  return PRESETS.some((p) => p.key === s)
}
