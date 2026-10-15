// RPC-Wrapper (BAUPLAN § 4.3 wörtlich; Parameternamen = PostgREST-Keys aus Migration 1/3/4).
// Muster: supabase.rpc('complete_step', { p_enrollment_id, … }) mit entfernten undefined-Werten; stable-Funktionen mit { get: true }.
// Fehler werden geworfen (PostgrestError) – die Hooks übersetzen sie über errors.ts in einen Toast.
import type { Json } from '@/types/database'
import type {
  Call,
  CallOutcome,
  Channel,
  DailyCounter,
  EndedReason,
  Enrollment,
  ImportErgebnis,
  Lead,
  LinkedinConnection,
  Metric,
  NoteVariant,
  ReachedPerson,
  RecordSource,
  ReplyLabel,
  StepOutcome,
  Task,
} from '@/types/domain'
import { ohneUndefined, pruefe } from './_helfer'
import { supabase } from './supabase'

export type BackupDokument = { exported_at: string; version: number; tables: Record<string, unknown[]> }
export type UndoErgebnis = { activity_id: number; type: string; restored: string[] }
export type UndoImportErgebnis = { batch_id: string; deleted_leads: number }
export type ImportTemplatesErgebnis = { inserted: number; updated: number }

/** Eingefrorene Parameterliste je RPC (Test rpc.test.ts prüft die Wrapper dagegen). */
export const RPC_PARAMS = {
  complete_step: ['p_enrollment_id', 'p_outcome', 'p_note', 'p_occurred_at', 'p_template_id'],
  snooze_step: ['p_enrollment_id', 'p_until', 'p_days', 'p_note'],
  snooze_task: ['p_task_id', 'p_until', 'p_days'],
  complete_task: ['p_task_id', 'p_note'],
  log_reply: ['p_lead_id', 'p_channel', 'p_label', 'p_note', 'p_occurred_at'],
  log_call: [
    'p_lead_id',
    'p_outcome',
    'p_note',
    'p_reached_person',
    'p_reached_name',
    'p_started_at',
    'p_ended_at',
    'p_duration_sec',
    'p_callback_at',
    'p_meeting_at',
    'p_enrollment_id',
    'p_task_id',
    'p_template_id',
    'p_from_number',
    'p_to_number',
    'p_direction',
    'p_ended_reason',
  ],
  log_request: ['p_lead_id', 'p_member_id', 'p_date', 'p_note_variant'],
  mark_accepted: ['p_lead_id', 'p_member_id', 'p_date'],
  transfer_lead: ['p_lead_id', 'p_to_member', 'p_note'],
  release_lead: ['p_lead_id', 'p_reason'],
  set_counter: ['p_metric', 'p_value', 'p_date', 'p_member_id', 'p_delta'],
  enroll: ['p_lead_id', 'p_sequence_key', 'p_member_id', 'p_start_at', 'p_start_position', 'p_first_due', 'p_note'],
  import_leads: ['p_rows', 'p_owner', 'p_source', 'p_label', 'p_dry_run'],
  undo_import: ['p_batch_id'],
  import_sheet_kpis: ['p_doc'],
  import_sheet_leads: ['p_doc', 'p_dry_run'],
  undo_activity: ['p_activity_id'],
  set_wiedervorlage: ['p_lead_id', 'p_due', 'p_note', 'p_template_id'],
  export_backup: [],
  import_templates: ['p_rows'],
  ping: [],
  log_outbound: ['p_lead_id', 'p_channel', 'p_template_id', 'p_kind', 'p_note', 'p_occurred_at'],
} as const
export type RpcName = keyof typeof RPC_PARAMS

/** `stable`-Funktionen (§ 4.3): GET statt POST. */
export const RPC_GET: readonly RpcName[] = ['ping', 'export_backup']

// Interner, lose typisierter Aufruf: die Wrapper unten geben die exakten Typen.
type RpcRoh = (
  name: string,
  args?: Record<string, unknown>,
  opts?: { get?: boolean },
) => PromiseLike<{ data: unknown; error: unknown }>
async function aufruf<R>(name: RpcName, args: Record<string, unknown> = {}, opts?: { get?: boolean }): Promise<R> {
  // bind: supabase.rpc nutzt this.rest – abgetrennt warf es live „Cannot read properties of undefined (reading rest)“
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcRoh
  const r = await rpc(name, ohneUndefined(args), opts)
  return pruefe(r as { data: R; error: null } | { data: null; error: Error })
}

export const rpc = {
  completeStep: (p: {
    enrollmentId: string
    outcome?: StepOutcome
    note?: string | null
    occurredAt?: string
    templateId?: string | null
  }) =>
    aufruf<Enrollment>('complete_step', {
      p_enrollment_id: p.enrollmentId,
      p_outcome: p.outcome,
      p_note: p.note,
      p_occurred_at: p.occurredAt,
      p_template_id: p.templateId,
    }),

  snoozeStep: (p: { enrollmentId: string; until?: string | null; days?: number | null; note?: string | null }) =>
    aufruf<Enrollment>('snooze_step', {
      p_enrollment_id: p.enrollmentId,
      p_until: p.until,
      p_days: p.days,
      p_note: p.note,
    }),

  snoozeTask: (p: { taskId: string; until?: string | null; days?: number | null }) =>
    aufruf<Task>('snooze_task', { p_task_id: p.taskId, p_until: p.until, p_days: p.days }),

  completeTask: (p: { taskId: string; note?: string | null }) =>
    aufruf<Task>('complete_task', { p_task_id: p.taskId, p_note: p.note }),

  logReply: (p: {
    leadId: string
    channel?: Channel
    label?: ReplyLabel | null
    note?: string | null
    occurredAt?: string
  }) =>
    aufruf<number>('log_reply', {
      p_lead_id: p.leadId,
      p_channel: p.channel,
      p_label: p.label,
      p_note: p.note,
      p_occurred_at: p.occurredAt,
    }),

  logCall: (p: {
    leadId: string
    outcome: CallOutcome
    note?: string | null
    reachedPerson?: ReachedPerson | null
    reachedName?: string | null
    startedAt?: string
    endedAt?: string | null
    durationSec?: number | null
    callbackAt?: string | null
    meetingAt?: string | null
    enrollmentId?: string | null
    taskId?: string | null
    templateId?: string | null
    fromNumber?: string | null
    toNumber?: string | null
    direction?: 'out' | 'in'
    endedReason?: EndedReason | null
  }) =>
    aufruf<Call>('log_call', {
      p_lead_id: p.leadId,
      p_outcome: p.outcome,
      p_note: p.note,
      p_reached_person: p.reachedPerson,
      p_reached_name: p.reachedName,
      p_started_at: p.startedAt,
      p_ended_at: p.endedAt,
      p_duration_sec: p.durationSec,
      p_callback_at: p.callbackAt,
      p_meeting_at: p.meetingAt,
      p_enrollment_id: p.enrollmentId,
      p_task_id: p.taskId,
      p_template_id: p.templateId,
      p_from_number: p.fromNumber,
      p_to_number: p.toNumber,
      p_direction: p.direction,
      p_ended_reason: p.endedReason,
    }),

  logRequest: (p: { leadId: string; memberId?: string | null; date?: string | null; noteVariant?: NoteVariant }) =>
    aufruf<LinkedinConnection>('log_request', {
      p_lead_id: p.leadId,
      p_member_id: p.memberId,
      p_date: p.date,
      p_note_variant: p.noteVariant,
    }),

  markAccepted: (p: { leadId: string; memberId?: string | null; date?: string | null }) =>
    aufruf<LinkedinConnection>('mark_accepted', { p_lead_id: p.leadId, p_member_id: p.memberId, p_date: p.date }),

  transferLead: (p: { leadId: string; toMember: string; note: string }) =>
    aufruf<Lead>('transfer_lead', { p_lead_id: p.leadId, p_to_member: p.toMember, p_note: p.note }),

  releaseLead: (p: { leadId: string; reason: string }) =>
    aufruf<Lead>('release_lead', { p_lead_id: p.leadId, p_reason: p.reason }),

  setCounter: (p: { metric: Metric; value: number; date?: string | null; memberId?: string | null; delta?: boolean }) =>
    aufruf<DailyCounter>('set_counter', {
      p_metric: p.metric,
      p_value: p.value,
      p_date: p.date,
      p_member_id: p.memberId,
      p_delta: p.delta,
    }),

  enroll: (p: {
    leadId: string
    sequenceKey: string
    memberId?: string | null
    startAt?: string
    startPosition?: number
    firstDue?: string | null
    note?: string | null
  }) =>
    aufruf<string>('enroll', {
      p_lead_id: p.leadId,
      p_sequence_key: p.sequenceKey,
      p_member_id: p.memberId,
      p_start_at: p.startAt,
      p_start_position: p.startPosition,
      p_first_due: p.firstDue,
      p_note: p.note,
    }),

  importLeads: (p: {
    rows: Json
    owner?: string | null
    source?: RecordSource
    label?: string | null
    dryRun?: boolean
  }) =>
    aufruf<ImportErgebnis>('import_leads', {
      p_rows: p.rows,
      p_owner: p.owner,
      p_source: p.source,
      p_label: p.label,
      p_dry_run: p.dryRun,
    }),

  undoImport: (p: { batchId: string }) => aufruf<UndoImportErgebnis>('undo_import', { p_batch_id: p.batchId }),

  importSheetKpis: (doc: Json) => aufruf<Json>('import_sheet_kpis', { p_doc: doc }),

  importSheetLeads: (doc: Json, dryRun?: boolean) =>
    aufruf<Json>('import_sheet_leads', { p_doc: doc, p_dry_run: dryRun }),

  undoActivity: (p: { activityId: number }) => aufruf<UndoErgebnis>('undo_activity', { p_activity_id: p.activityId }),

  setWiedervorlage: (p: { leadId: string; due: string; note?: string | null; templateId?: string | null }) =>
    aufruf<Task>('set_wiedervorlage', {
      p_lead_id: p.leadId,
      p_due: p.due,
      p_note: p.note,
      p_template_id: p.templateId,
    }),

  exportBackup: () => aufruf<BackupDokument>('export_backup', {}, { get: true }),

  importTemplates: (p: { rows: Json }) => aufruf<ImportTemplatesErgebnis>('import_templates', { p_rows: p.rows }),

  ping: () => aufruf<'pong'>('ping', {}, { get: true }),

  logOutbound: (p: {
    leadId: string
    channel?: Channel
    templateId?: string | null
    kind?: 'nachricht' | 'pitch'
    note?: string | null
    occurredAt?: string
  }) =>
    aufruf<number>('log_outbound', {
      p_lead_id: p.leadId,
      p_channel: p.channel,
      p_template_id: p.templateId,
      p_kind: p.kind,
      p_note: p.note,
      p_occurred_at: p.occurredAt,
    }),
}

export type Rpc = typeof rpc
