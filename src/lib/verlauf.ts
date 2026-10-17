// Verlauf eines Leads – reine Regeln, gemeinsam für die Lead-Timeline im CRM und die Chrome-Erweiterung (17.10.2026):
// Filter-Kategorien, welche Einträge Text zum Aufklappen haben, und das Ausblenden technischer Doppel-Einträge.
// Keine Abhängigkeiten außer Typen – die Erweiterung bündelt diese Datei in ihren Service Worker.
import type { Activity, ActivityType } from '@/types/domain'

type SendungsTeile = Pick<Activity, 'type' | 'lead_id' | 'enrollment_id' | 'step_id'> & { email_id?: string | null }

/**
 * Doppelte `email_gesendet` einer Sequenz-Mail ausblenden: „Gesendet? Ja“ (M-06) setzt die Mail auf `sent_confirmed`
 * (`emails_after_write` loggt `email_gesendet` mit `email_id`) und ruft danach `complete_step('gesendet')`, dessen E-Mail-Zweig ein
 * zweites `email_gesendet` ohne `email_id` schreibt. Bis eine Migration den zweiten Eintrag unterdrückt, zählt nur der Eintrag mit
 * `email_id` (gleicher Lead, gleiches Enrollment, gleicher Schritt). Review-Korrektur; Server-View `v_template_performance` bleibt offen.
 */
export function ohneDoppelteEmailSendung<A extends SendungsTeile>(zeilen: readonly A[]): A[] {
  const schluessel = (a: SendungsTeile) => `${a.lead_id}|${a.enrollment_id}|${a.step_id}`
  const mitMail = new Set(
    zeilen.filter((a) => a.type === 'email_gesendet' && a.email_id && a.enrollment_id && a.step_id).map(schluessel),
  )
  if (mitMail.size === 0) return zeilen as A[]
  return zeilen.filter(
    (a) => !(a.type === 'email_gesendet' && !a.email_id && a.enrollment_id && a.step_id && mitMail.has(schluessel(a))),
  )
}

type ImportTeile = Pick<Activity, 'type' | 'lead_id' | 'source'>

/**
 * Doppelten Sheet-Import in der Timeline ausblenden (QA Runde 3: „Importiert aus CRM-Tabelle“ stand je Lead zweimal). Der Import
 * schreibt je neuem Lead „angelegt“ (Trigger `leads_after_insert`, rückdatiert auf das erste Sheet-Datum) und „import“
 * (`import_sheet_leads`, Zeitpunkt des Imports, mit den Sheet-Metadaten). Beide bleiben als Beleg in der DB; angezeigt wird nur die
 * rückdatierte „angelegt“-Zeile, wenn es sie für denselben Lead aus derselben Quelle gibt. Beim Re-Import eines bestehenden Leads
 * (kein neues „angelegt“) bleibt „import“ sichtbar. `alle` = Zeilen, in denen nach „angelegt“ gesucht wird (Timeline: alle geladenen
 * Seiten, damit die Paarung auch seitenübergreifend greift).
 */
export function ohneDoppeltenImport<A extends ImportTeile>(
  zeilen: readonly A[],
  alle: readonly ImportTeile[] = zeilen,
): A[] {
  const angelegt = new Set(
    alle.filter((a) => a.type === 'angelegt' && a.source !== 'app').map((a) => `${a.lead_id}|${a.source}`),
  )
  if (angelegt.size === 0) return zeilen as A[]
  return zeilen.filter((a) => !(a.type === 'import' && angelegt.has(`${a.lead_id}|${a.source}`)))
}

export type TimelineFilterKey = 'alle' | 'nachrichten' | 'anrufe' | 'emails' | 'status' | 'notizen' | 'system'

export const TIMELINE_FILTER: readonly { key: TimelineFilterKey; label: string; types: readonly ActivityType[] }[] = [
  { key: 'alle', label: 'Alle', types: [] },
  {
    key: 'nachrichten',
    label: 'Nachrichten',
    types: [
      'vernetzung_gesendet',
      'vernetzung_angenommen',
      'vernetzung_zurueckgezogen',
      'vernetzung_abgelaufen',
      'gespraech_eroeffnet',
      'nachricht_gesendet',
      'nachricht_erhalten',
      'pitch_gesendet',
    ],
  },
  { key: 'anrufe', label: 'Anrufe', types: ['anruf'] },
  { key: 'emails', label: 'E-Mails', types: ['email_gesendet', 'email_erhalten'] },
  {
    key: 'status',
    label: 'Statuswechsel',
    types: [
      'stage_wechsel',
      'uebergabe',
      'freigabe',
      'meeting_geplant',
      'meeting_stattgefunden',
      'meeting_no_show',
      'meeting_abgesagt',
      'meeting_verschoben',
    ],
  },
  { key: 'notizen', label: 'Notizen', types: ['notiz'] },
  {
    key: 'system',
    label: 'System',
    types: [
      'angelegt',
      'import',
      'sequenz_gestartet',
      'sequenz_gestoppt',
      'sequenz_abgeschlossen',
      'sequenz_pausiert',
      'schritt_uebersprungen',
      'schritt_verschoben',
      'aufgabe_erledigt',
      'einwilligung',
      'widerspruch',
    ],
  },
]

export function timelineKategorie(type: ActivityType): Exclude<TimelineFilterKey, 'alle'> {
  for (const f of TIMELINE_FILTER) if (f.key !== 'alle' && f.types.includes(type)) return f.key
  return 'system'
}

/** Ereignisse mit aufklappbarem Text („anzeigen“): Nachrichten, E-Mails, Anrufe mit Notiz. */
export function hatAufklappText(a: Activity): boolean {
  if (!a.note) return false
  const k = timelineKategorie(a.type)
  if (a.type === 'nachricht_erhalten') return false // Zitat steht schon im Wortlaut
  return k === 'nachrichten' || k === 'emails' || k === 'anrufe'
}
