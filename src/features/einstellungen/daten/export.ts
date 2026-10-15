// CSV-Exporte je Tabelle (BAUPLAN § 3.9 Export.tsx, § 3.1.9 csv.ts): Leads der Ansicht „Alle“, Ereignisse, Anrufe, E-Mails,
// KPI-Tageswerte. Lader (Seiten à 500, E18) kommen aus der Daten-Schicht (`src/data/export.ts`).
import { ladeAktivitaetenAlle, ladeCallsAlle, ladeEmailsAlle, ladeLeadsAlle, ladeTageswerteAlle } from '@/data/export'
import { csvExport, download, type CsvSpalte } from '@/lib/csv'
import { fmtDauer, heuteBerlin } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { ERLAUBNIS_LABEL, ERGEBNIS_LABEL, KANAL_LABEL, REAKTION_LABEL, STUFEN_LABEL } from '@/texte/de'
import type { Activity, Call, DailyActivity, Email, Lead, Member, Settings } from '@/types/domain'

export type ExportTabelle = 'leads' | 'ereignisse' | 'anrufe' | 'emails' | 'kpi-tageswerte'

export const EXPORT_TABELLEN: readonly { key: ExportTabelle; label: string; hinweis: string }[] = [
  { key: 'leads', label: 'Leads', hinweis: 'Ansicht „Alle“ – ohne Papierkorb' },
  { key: 'ereignisse', label: 'Ereignisse', hinweis: 'Timeline aller Leads' },
  { key: 'anrufe', label: 'Anrufe', hinweis: 'Ein- und ausgehend, mit Ergebnis' },
  { key: 'emails', label: 'E-Mails', hinweis: 'Entwürfe, gesendet, erhalten' },
  { key: 'kpi-tageswerte', label: 'KPI-Tageswerte', hinweis: 'Zählwerte je Tag und Person' },
]

export const ACTIONS_URL = 'https://github.com/vincentsteiner01/steinerundco-crm/actions'
/** Heute erinnert ab 7 Tagen (E23) – dieselbe Schwelle für die Amber-Zahl der Backup-Karte. */
export const BACKUP_ERINNERUNG_TAGE = 7

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

export type ExportKontext = { members: Member[]; settings: Settings | undefined }

const mitglied = (ctx: ExportKontext, id: string | null | undefined): string =>
  ctx.members.find((m) => m.id === id)?.display_name ?? (id ? 'unbekannt' : '')

export function leadSpalten(ctx: ExportKontext): CsvSpalte<Lead>[] {
  return [
    { key: 'full_name', label: 'Name' },
    { key: 'company_name', label: 'Unternehmen' },
    { key: 'role_title', label: 'Rolle' },
    { key: 'city', label: 'Stadt' },
    { key: 'linkedin_url', label: 'LinkedIn-URL' },
    { key: 'email', label: 'E-Mail' },
    { key: 'phone_e164', label: 'Telefon' },
    {
      key: 'stage',
      label: 'Stufe',
      wert: (l) => ctx.settings?.stage_labels?.[l.stage]?.label ?? STUFEN_LABEL[l.stage]?.label ?? l.stage,
    },
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

export function ereignisSpalten(ctx: ExportKontext): CsvSpalte<Activity>[] {
  return [
    { key: 'occurred_at', label: 'Zeitpunkt' },
    { key: 'lead_id', label: 'Lead-ID' },
    { key: 'member_id', label: 'Person', wert: (a) => mitglied(ctx, a.member_id) },
    { key: 'channel', label: 'Kanal', wert: (a) => KANAL_LABEL[a.channel] },
    { key: 'type', label: 'Typ' },
    { key: 'outcome', label: 'Ergebnis' },
    { key: 'reply_label', label: 'Reaktion', wert: (a) => (a.reply_label ? REAKTION_LABEL[a.reply_label] : '') },
    { key: 'note', label: 'Notiz' },
    { key: 'kpi_relevant', label: 'KPI-relevant' },
    { key: 'id', label: 'ID' },
  ]
}

export function anrufSpalten(ctx: ExportKontext): CsvSpalte<Call>[] {
  return [
    { key: 'started_at', label: 'Begonnen' },
    { key: 'lead_id', label: 'Lead-ID' },
    { key: 'member_id', label: 'Person', wert: (c) => mitglied(ctx, c.member_id) },
    { key: 'direction', label: 'Richtung', wert: (c) => (c.direction === 'out' ? 'ausgehend' : 'eingehend') },
    { key: 'outcome', label: 'Ergebnis', wert: (c) => (c.outcome ? ERGEBNIS_LABEL[c.outcome] : '') },
    { key: 'reached_person', label: 'Erreicht' },
    { key: 'duration_sec', label: 'Dauer', wert: (c) => (c.duration_sec == null ? '' : fmtDauer(c.duration_sec)) },
    { key: 'attempt_no', label: 'Versuch' },
    { key: 'note', label: 'Notiz' },
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

/** View-Zeilen ohne festes Schema: alle Spalten der ersten Zeile, `member_id` als Name. */
export function tageswertSpalten(ctx: ExportKontext, zeilen: DailyActivity[]): CsvSpalte<DailyActivity>[] {
  const erste = zeilen[0]
  if (!erste) return [{ key: 'day', label: 'Tag' }]
  return Object.keys(erste).map((k) =>
    k === 'member_id'
      ? { key: k, label: 'Person', wert: (z: DailyActivity) => mitglied(ctx, z.member_id) }
      : { key: k, label: k === 'day' ? 'Tag' : k },
  )
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
    case 'ereignisse': {
      const zeilen = await ladeAktivitaetenAlle()
      download(csvExport(zeilen, ereignisSpalten(ctx)), name)
      return zeilen.length
    }
    case 'anrufe': {
      const zeilen = await ladeCallsAlle()
      download(csvExport(zeilen, anrufSpalten(ctx)), name)
      return zeilen.length
    }
    case 'emails': {
      const zeilen = await ladeEmailsAlle()
      download(csvExport(zeilen, emailSpalten(ctx)), name)
      return zeilen.length
    }
    case 'kpi-tageswerte': {
      const zeilen = await ladeTageswerteAlle()
      download(csvExport(zeilen, tageswertSpalten(ctx, zeilen)), name)
      return zeilen.length
    }
  }
}
