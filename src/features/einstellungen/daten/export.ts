// CSV-Exporte (BAUPLAN § 3.9 Export.tsx, § 3.1.9 csv.ts). Neustart 25.11.2026: nur noch Leads und Einzelmails – Ereignisse,
// Anrufe und KPI-Tageswerte gehören zu Bereichen, die es nicht mehr gibt (alles davon steckt weiter im Voll-Backup).
// Lader (Seiten à 500, E18) kommen aus der Daten-Schicht (`src/data/export.ts`).
import { ladeEmailsAlle, ladeLeadsAlle } from '@/data/export'
import { BOARD_LISTEN } from '@/features/board/listen'
import { csvExport, download, type CsvSpalte } from '@/lib/csv'
import { heuteBerlin } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { ERLAUBNIS_LABEL } from '@/texte/de'
import type { Email, Lead, Member } from '@/types/domain'

export type ExportTabelle = 'leads' | 'emails'

export const EXPORT_TABELLEN: readonly { key: ExportTabelle; label: string; hinweis: string }[] = [
  { key: 'leads', label: 'Leads', hinweis: 'Board und alte Leads' },
  { key: 'emails', label: 'Einzelmails', hinweis: 'Entwürfe, gesendet, erhalten' },
]

export const ACTIONS_URL = 'https://github.com/vincentsteiner01/steinerundco-crm/actions'
/** Ab so vielen Tagen steht der Abstand zum letzten Backup in Amber. */
export const BACKUP_ALT_AB_TAGE = 7

/** „heute“ · „gestern“ · „vor 9 Tagen“. */
export function backupAbstand(lastAt: string, heute = heuteBerlin()): string {
  const tage = tageDifferenz(berlinTag(lastAt), heute)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}

/** `crm-<tabelle>-<YYYY-MM-DD>.csv` (§ 3.9 Regeln). */
export const csvDateiname = (tabelle: ExportTabelle, tag = heuteBerlin()): string => `crm-${tabelle}-${tag}.csv`
/** `steinerundco-crm-backup-<YYYY-MM-DD>.json` (ux § 3.10 Nr. 9). */
export const backupDateiname = (tag = heuteBerlin()): string => `steinerundco-crm-backup-${tag}.json`

export type ExportKontext = { members: Member[] }

const mitglied = (ctx: ExportKontext, id: string | null | undefined): string =>
  ctx.members.find((m) => m.id === id)?.display_name ?? (id ? 'unbekannt' : '')

/** Titel der Board-Liste („Gespräch vereinbart“); leer, wenn der Lead nicht auf dem Board liegt. */
const listeTitel = (liste: string | null | undefined): string => BOARD_LISTEN.find((l) => l.key === liste)?.titel ?? ''

// Die alte Spalte „Stufe“ (16 Stufen aus leads.stage) ist entfallen: `stage` wird im neuen CRM nicht mehr gelesen.
// An ihrer Stelle steht „Liste“ aus leads.board_liste.
export function leadSpalten(ctx: ExportKontext): CsvSpalte<Lead>[] {
  return [
    { key: 'full_name', label: 'Name' },
    { key: 'company_name', label: 'Unternehmen' },
    { key: 'role_title', label: 'Rolle' },
    { key: 'city', label: 'Stadt' },
    { key: 'linkedin_url', label: 'LinkedIn-URL' },
    { key: 'email', label: 'E-Mail' },
    { key: 'phone_e164', label: 'Telefon' },
    { key: 'board_liste', label: 'Liste', wert: (l) => listeTitel(l.board_liste) },
    { key: 'owner_id', label: 'Zuständig', wert: (l) => mitglied(ctx, l.owner_id) },
    { key: 'sales_owner_id', label: 'Sales-Verantwortlich', wert: (l) => mitglied(ctx, l.sales_owner_id) },
    { key: 'next_action_at', label: 'Nächste Aktion' },
    { key: 'next_action_label', label: 'Nächster Schritt' },
    { key: 'last_activity_at', label: 'Letzte Aktivität' },
    { key: 'email_consent_basis', label: 'E-Mail-Erlaubnis', wert: (l) => ERLAUBNIS_LABEL[l.email_consent_basis] },
    { key: 'do_not_contact', label: 'Widerspruch' },
    { key: 'source', label: 'Quelle' },
    { key: 'created_at', label: 'Angelegt' },
    { key: 'id', label: 'ID' },
  ]
}

export function emailSpalten(ctx: ExportKontext): CsvSpalte<Email>[] {
  return [
    { key: 'sent_at', label: 'Gesendet' },
    { key: 'lead_id', label: 'Lead-ID' },
    { key: 'member_id', label: 'Person', wert: (e) => mitglied(ctx, e.member_id) },
    { key: 'direction', label: 'Richtung', wert: (e) => (e.direction === 'out' ? 'ausgehend' : 'eingehend') },
    { key: 'to_address', label: 'An' },
    { key: 'subject', label: 'Betreff' },
    { key: 'status', label: 'Status' },
    {
      key: 'consent_basis_snapshot',
      label: 'Erlaubnis',
      wert: (e) => (e.consent_basis_snapshot ? ERLAUBNIS_LABEL[e.consent_basis_snapshot] : ''),
    },
    { key: 'id', label: 'ID' },
  ]
}

/** Lädt die Tabelle, baut das CSV und löst den Download aus. Rückgabe: Zeilenzahl. */
export async function exportiereCsv(tabelle: ExportTabelle, ctx: ExportKontext, tag = heuteBerlin()): Promise<number> {
  const name = csvDateiname(tabelle, tag)
  switch (tabelle) {
    case 'leads': {
      const zeilen = await ladeLeadsAlle()
      download(csvExport(zeilen, leadSpalten(ctx)), name)
      return zeilen.length
    }
    case 'emails': {
      const zeilen = await ladeEmailsAlle()
      download(csvExport(zeilen, emailSpalten(ctx)), name)
      return zeilen.length
    }
  }
}
