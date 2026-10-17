// BAUPLAN § 4.1 / § 4.2 wörtlich. Enum-Werte sind exakt die DB-Werte; Labels kommen aus settings / de.ts.
import type { Database } from './database'

// ── § 4.1 Enums ──────────────────────────────────────────────────────────────
export type Channel = 'linkedin' | 'telefon' | 'email' | 'sonstiges'
export type LeadStage =
  | 'neu'
  | 'vernetzung_gesendet'
  | 'vernetzt'
  | 'gespraech_eroeffnet'
  | 'dm_follow_up'
  | 'dm_beantwortet'
  | 'bedarfsermittlung'
  | 'pitch'
  | 'erstgespraech_vereinbart'
  | 'erstgespraech'
  | 'strategiegespraech_vereinbart'
  | 'strategiegespraech'
  | 'sales_follow_up'
  | 'kunde'
  | 'langfristig'
  | 'beendet'
export type PhaseKey =
  | 'angefragt'
  | 'vernetzt'
  | 'eroeffnet'
  | 'beantwortet'
  | 'gepitcht'
  | 'erstgespraech'
  | 'strategiegespraech'
  | 'kunde'
  | 'wiedervorlage'
  | 'beendet'
export type EndedReason =
  | 'kein_bedarf'
  | 'nicht_icp'
  | 'nicht_qualifiziert'
  | 'kein_interesse'
  | 'falsche_nummer'
  | 'duplikat'
  | 'widerspruch'
  | 'sonstiges'
export type Salutation = 'herr' | 'frau' | 'neutral'
export type LeadRole =
  | 'geschaeftsfuehrer'
  | 'inhaber'
  | 'kundenbetreuer'
  | 'innendienst'
  | 'vertrieb'
  | 'projektleiter'
  | 'sonstiges'
  | 'unbekannt'
export type RecordSource =
  'app' | 'import_sheet' | 'import_csv' | 'schnellimport' | 'linkedin_export' | 'telefonie' | 'email_sync'
export type ConnectionStatus = 'ausstehend' | 'angenommen' | 'zurueckgezogen' | 'abgelaufen'
export type NoteVariant = 'ohne' | 'note_v1' | 'note_v2'
export type ActivityType =
  | 'angelegt'
  | 'import'
  | 'vernetzung_gesendet'
  | 'vernetzung_angenommen'
  | 'vernetzung_zurueckgezogen'
  | 'vernetzung_abgelaufen'
  | 'gespraech_eroeffnet'
  | 'nachricht_gesendet'
  | 'nachricht_erhalten'
  | 'pitch_gesendet'
  | 'anruf'
  | 'email_gesendet'
  | 'email_erhalten'
  | 'meeting_geplant'
  | 'meeting_stattgefunden'
  | 'meeting_no_show'
  | 'meeting_abgesagt'
  | 'meeting_verschoben'
  | 'notiz'
  | 'stage_wechsel'
  | 'uebergabe'
  | 'freigabe'
  | 'sequenz_gestartet'
  | 'sequenz_gestoppt'
  | 'sequenz_abgeschlossen'
  | 'sequenz_pausiert'
  | 'schritt_uebersprungen'
  | 'schritt_verschoben'
  | 'aufgabe_erledigt'
  | 'einwilligung'
  | 'widerspruch'
export type ReplyLabel =
  | 'interessiert'
  | 'frage'
  | 'kein_bedarf'
  | 'spaeter'
  | 'nicht_icp'
  | 'hat_partner'
  | 'falsches_problem'
  | 'widerspruch'
  | 'sonstiges'
export type TemplatePhase =
  | 'vernetzung'
  | 'eroeffnung'
  | 'bedarfsermittlung'
  | 'pitch'
  | 'follow_up'
  | 'langfristig'
  | 'gatekeeper'
  | 'einstieg'
  | 'problem'
  | 'qualifizierung'
  | 'einwand'
  | 'abschluss'
  | 'mailbox'
  | 'rueckruf'
  | 'datenschutz'
  | 'zusammenfassung'
  | 'nachfassen'
  | 'infomail'
  | 'transaktional'
  // Sales-Leitfäden (Migration 11, Feedback 9959e426)
  | 'erstgespraech'
  | 'strategiegespraech'
  | 'einwandbehandlung'
  | 'angebot'
export type StepKind = 'nachricht' | 'anruf' | 'email' | 'aufgabe'
export type EnrollmentStatus = 'aktiv' | 'pausiert' | 'abgeschlossen' | 'gestoppt'
export type StopReason =
  | 'antwort_erhalten'
  | 'meeting_gebucht'
  | 'lead_beendet'
  | 'verbindung_entfernt'
  | 'widerspruch'
  | 'manuell'
  | 'ersetzt'
  | 'uebergabe'
export type StepOutcome = 'gesendet' | 'uebersprungen' | 'antwort_erhalten' | 'abgebrochen'
export type MeetingType = 'erstgespraech' | 'strategiegespraech' | 'folgegespraech'
export type MeetingStatus = 'geplant' | 'stattgefunden' | 'no_show' | 'abgesagt' | 'verschoben'
export type CallOutcome =
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'voicemail_left'
  | 'wrong_number'
  | 'gatekeeper'
  | 'gatekeeper_blocked'
  | 'callback_scheduled'
  | 'dm_interest'
  | 'meeting_booked'
  | 'send_info'
  | 'not_now'
  | 'not_interested'
  | 'not_icp'
  | 'do_not_call'
export type ReachedPerson = 'niemand' | 'zentrale' | 'assistenz' | 'entscheider' | 'sonstige'
export type CallBasis =
  | 'linkedin_vernetzt_antwort'
  | 'linkedin_vernetzt'
  | 'email_antwort'
  | 'website_anfrage'
  | 'messe_event'
  | 'empfehlung'
  | 'bestandskontakt'
  | 'stellenanzeige_innendienst'
  | 'oeffentliche_aussage'
  | 'sonstiger_konkreter_anlass'
export type PhoneSource =
  | 'website_kontakt'
  | 'google_profil'
  | 'branchenverzeichnis'
  | 'linkedin'
  | 'visitenkarte'
  | 'mitgeteilt'
  | 'impressum'
  | 'unbekannt'
export type PhoneType = 'zentrale' | 'durchwahl' | 'mobil' | 'unbekannt'
export type EmailConsentBasis =
  | 'none'
  | 'requested_linkedin'
  | 'requested_phone'
  | 'requested_email'
  | 'meeting_held'
  | 'double_opt_in'
  | 'existing_customer'
  | 'revoked'
export type EmailStatus =
  'draft' | 'opened_in_client' | 'sent_confirmed' | 'sent' | 'delivered' | 'bounced' | 'replied' | 'failed' | 'received'
export type EmailChannel = 'gmail_compose' | 'gmail_api' | 'brevo' | 'mailto' | 'manual'
export type TaskKind = 'rueckruf' | 'wiedervorlage' | 'aufgabe'
export type TaskStatus = 'offen' | 'erledigt' | 'abgebrochen'
export type NextActionKind = 'sequenz_schritt' | 'rueckruf' | 'wiedervorlage' | 'aufgabe' | 'meeting' | 'antworten'
export type Metric =
  | 'vernetzungen_versendet'
  | 'vernetzungen_angenommen'
  | 'ausstehend'
  | 'gespraeche_eroeffnet'
  | 'dm_beantwortet'
  | 'erstgespraech_gepitcht'
  | 'erstgespraeche_vereinbart'
  | 'erstgespraeche'
  | 'strategiegespraeche'
  | 'kunden_gewonnen'
  | 'erstgespraech_no_show'
  | 'erstgespraech_abgesagt'
  | 'strategiegespraech_no_show'
  | 'strategiegespraech_abgesagt'
  | 'anrufe'
  | 'anrufe_erreicht'
  | 'entscheider_gespraeche'
  | 'termine_telefon'
  | 'emails_gesendet'
export type CounterPeriod = 'tag' | 'monat'
export type QueueSection =
  'antworten' | 'ueberfaellig' | 'heute' | 'annahme_pruefen' | 'neue_anfragen' | 'zurueckziehen' | 'kommend'
export type QueueItemKind =
  | 'antworten'
  | 'sequenz_schritt'
  | 'rueckruf'
  | 'wiedervorlage'
  | 'aufgabe'
  | 'meeting'
  | 'annahme_pruefen'
  | 'neue_anfrage'
  | 'zurueckziehen'
export type UiSektion =
  | 'rueckrufe'
  | 'antworten'
  | 'ueberfaellig'
  | 'heute'
  | 'annahme_pruefen'
  | 'opener'
  | 'neue_anfragen'
  | 'zurueckziehen'
  | 'spaeter'

// ── § 4.2 Zeilentypen (Aliasse auf database.ts) ─────────────────────────────
type T<N extends keyof Database['crm']['Tables']> = Database['crm']['Tables'][N]['Row']
type I<N extends keyof Database['crm']['Tables']> = Database['crm']['Tables'][N]['Insert']
type U<N extends keyof Database['crm']['Tables']> = Database['crm']['Tables'][N]['Update']
type V<N extends keyof Database['crm']['Views']> = Database['crm']['Views'][N]['Row']

export type Lead = T<'leads'>
export type LeadInsert = I<'leads'>
export type LeadUpdate = U<'leads'>
export type LeadMitBezug = Lead & {
  companies: Company | null
  enrollments: Enrollment[]
  tasks: Task[]
  meetings: Meeting[]
  linkedin_connections: LinkedinConnection[]
  lead_tags: { tag_id: string }[]
}
export type Company = T<'companies'>
export type Tag = T<'tags'>
export type Activity = T<'activities'>
export type Template = T<'templates'>
export type Sequence = T<'sequences'>
export type SequenceStep = T<'sequence_steps'>
export type SequenceMitSchritten = Sequence & { steps: SequenceStep[] }
export type Enrollment = T<'enrollments'>
export type LinkedinConnection = T<'linkedin_connections'>
export type Task = T<'tasks'>
export type Meeting = T<'meetings'>
export type Call = T<'calls'>
export type CallOutcomeDef = T<'call_outcome_defs'>
export type Email = T<'emails'>
export type DailyCounter = T<'daily_counters'>
export type SavedView = T<'saved_views'>
export type ImportBatch = T<'import_batches'>
export type SperrlisteEintrag = T<'sperrliste'>
export type MemberProfile = T<'member_profiles'>
export type Member = V<'members'>
export type QueueItem = V<'v_today_queue'>
export type FunnelMonat = V<'v_funnel_monthly'>
export type MetricEvent = V<'v_metric_events'>
export type DailyActivity = V<'v_daily_activity'>
export type TemplatePerformance = V<'v_template_performance'>
export type PipelineCount = V<'v_pipeline_counts'>
export type Antwortzeit = V<'v_antwortzeit'>
export type LeadOhneBewegung = V<'v_leads_ohne_bewegung'>

export type Settings = {
  zeitzone: string
  linkedin: {
    weekly_budget_default: Record<'basic' | 'premium' | 'sales_navigator', number>
    daily_target_default: number
    warn_at_pct: number
    pending_withdraw_days: number
    pending_expire_days: number
    acceptance_warn_below: number
    auto_enroll_on_accept: boolean
    default_sequence: string
    note_sequence: string
    note_variant_share_max: number
  }
  queue: {
    due_time: string
    weekdays_only: boolean
    snooze_options: string[]
    snooze_warn_after: number
    withdraw_weekday: number
    kommend_days: number
    sections: QueueSection[]
  }
  telefon: {
    max_attempts: number
    auto_enroll_on_no_answer: boolean
    default_sequence: string
    busy_retry_minutes: number
    callback_default_time: string
    slots: Record<'A' | 'B' | 'C' | 'D', string>
    require_call_basis: boolean
  }
  email: {
    sending_enabled: boolean
    provider: 'gmail_api' | 'brevo'
    max_followups_per_consent: number
    consent_max_age_months: number
    auto_enroll_after_erstgespraech: boolean
    auto_enroll_after_strategiegespraech: boolean /* § 4.5, Migration 4 Nr. 16 */
    privacy_notice_version: string
    privacy_url: string
    objection_sentence: string
    send_window: { days: number[]; from: string; to: string }
  }
  langfristig: { default_days: number; hat_partner_days: number; nicht_erreicht_days: number; kein_bedarf_days: number }
  kpi_targets: {
    annahme_quote: number
    antwort_quote: number
    pitch_quote: number
    erstgespraech_quote: number
    connect_rate: number
    entscheider_quote: number
    termine_pro_100_anrufe: number
    antwortzeit_werktage: number
  }
  feiertage: string[]
  retention: { anonymize_no_reaction_months: number; anonymize_contact_months: number; calls_keep_years: number }
  stage_labels: Record<LeadStage, { label: string; short: string; group: 'linkedin' | 'sales' | 'parkend' }>
  ended_reason_labels: Record<EndedReason, string>
  backup?: { last_at: string; by: string } // schreibt M8
}

export type LeadFilter = {
  q?: string
  zustaendig?: ('me' | 'andere' | 'frei' | 'alle') | string[]
  phase?: PhaseKey[]
  stage?: LeadStage[]
  kanal?: Channel[]
  faellig?: 'ueberfaellig' | 'heute' | 'woche' | 'spaeter' | 'ohne'
  tag?: string[]
  quelle?: string /* batch id */
  rolle?: LeadRole[]
  anrede?: Salutation[]
  sequenz?: { key?: string; position?: number }
  erlaubnis?: EmailConsentBasis[]
  ohneUnternehmen?: boolean
  released?: boolean
  papierkorb?: boolean
  sort?: { feld: keyof Lead; richtung: 'asc' | 'desc' }[]
  gruppe?: 'faelligkeit' | 'phase' | 'zustaendig' | 'unternehmen'
  /** BAUPLAN § 7.5 (Klick auf eine Funnel-Zahl, K-05): Leads mit einem Ereignis im Zeitraum (Kalendertage Europe/Berlin) –
   *  `aktivitaet` (activities.type = typ) · `anfrage`/`annahme` (linkedin_connections.requested_at/accepted_at) ·
   *  `termin` (meetings stattgefunden, scheduled_at; typ = meeting_type) · `termin_vereinbart` (Erstgespräch nach booked_at).
   *  `person` = Mitglied des Ereignisses (nicht die Zuständigkeit). Integration M2/M5. */
  ereignis?: {
    art: 'aktivitaet' | 'anfrage' | 'annahme' | 'termin' | 'termin_vereinbart'
    typ?: string
    von: string
    bis: string
    person?: string
  }
}
export type SchnellimportZeile = {
  zeile: number
  name: string | null
  first_name: string | null
  last_name: string | null
  title: string | null
  salutation: Salutation | null
  company: string | null
  role_title: string | null
  role: LeadRole
  linkedin_url: string | null
  linkedin_url_norm: string | null
  url_art: 'person' | 'sales_nav' | 'firmenseite' | 'keine' | 'ungueltig'
  city: string | null
  /** Telefon/E-Mail aus der Liste (17.10.2026: vorher verworfen – Mike trug 15 Nummern von Hand nach) */
  phone?: string | null
  email?: string | null
  status_lokal: 'neu' | 'unvollstaendig' | 'sales_nav' | 'firmenseite' | 'dublette_liste'
  status_server?: 'neu' | 'duplikat' | 'archiv' | 'gesperrt' | 'ungueltig'
  existing?: { id: string; stage: LeadStage; owner_id: string | null }
}
export type ImportErgebnis = {
  batch_id: string | null
  dry_run: boolean
  inserted: number
  updated: number
  skipped: number
  blocked: number
  invalid: number
  rows: {
    status: 'neu' | 'duplikat' | 'archiv' | 'gesperrt' | 'ungueltig'
    name: string
    company: string | null
    linkedin_url_norm: string | null
    existing_id: string | null
    existing_stage: LeadStage | null
    existing_owner: string | null
  }[]
}
