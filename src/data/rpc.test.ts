// BAUPLAN § 4.3: jeder Wrapper sendet exakt die PostgREST-Parameternamen (eingefrorene Liste), ohne undefined, stable-RPCs per GET.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { supabase } from '@/data/supabase'
import { rpc, RPC_GET, RPC_PARAMS, type RpcName } from './rpc'

/** Eingefrorene Parameterliste (unabhängig von rpc.ts, aus § 4.3 + Migration 1/3/4). */
const EINGEFROREN: Record<RpcName, readonly string[]> = {
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
}

const ID = '00000000-0000-4000-8000-000000000001'
const T = '2026-10-14T09:00:00.000Z'

/** Vollständiger Aufruf je Wrapper (alle Parameter gesetzt) → erwarteter RPC-Name. */
const VOLL: Record<RpcName, () => Promise<unknown>> = {
  complete_step: () =>
    rpc.completeStep({ enrollmentId: ID, outcome: 'gesendet', note: 'n', occurredAt: T, templateId: ID }),
  snooze_step: () => rpc.snoozeStep({ enrollmentId: ID, until: T, days: 2, note: 'n' }),
  snooze_task: () => rpc.snoozeTask({ taskId: ID, until: T, days: 1 }),
  complete_task: () => rpc.completeTask({ taskId: ID, note: 'n' }),
  log_reply: () => rpc.logReply({ leadId: ID, channel: 'linkedin', label: 'interessiert', note: 'n', occurredAt: T }),
  log_call: () =>
    rpc.logCall({
      leadId: ID,
      outcome: 'no_answer',
      note: 'n',
      reachedPerson: 'niemand',
      reachedName: 'x',
      startedAt: T,
      endedAt: T,
      durationSec: 10,
      callbackAt: T,
      meetingAt: T,
      enrollmentId: ID,
      taskId: ID,
      templateId: ID,
      fromNumber: '+4940',
      toNumber: '+4940',
      direction: 'out',
      endedReason: 'kein_bedarf',
    }),
  log_request: () => rpc.logRequest({ leadId: ID, memberId: ID, date: '2026-10-14', noteVariant: 'ohne' }),
  mark_accepted: () => rpc.markAccepted({ leadId: ID, memberId: ID, date: '2026-10-14' }),
  transfer_lead: () => rpc.transferLead({ leadId: ID, toMember: ID, note: 'n' }),
  release_lead: () => rpc.releaseLead({ leadId: ID, reason: 'r' }),
  set_counter: () => rpc.setCounter({ metric: 'anrufe', value: 1, date: '2026-10-14', memberId: ID, delta: true }),
  enroll: () =>
    rpc.enroll({ leadId: ID, sequenceKey: 'k', memberId: ID, startAt: T, startPosition: 1, firstDue: T, note: 'n' }),
  import_leads: () => rpc.importLeads({ rows: [], owner: ID, source: 'schnellimport', label: 'l', dryRun: true }),
  undo_import: () => rpc.undoImport({ batchId: ID }),
  import_sheet_kpis: () => rpc.importSheetKpis({}),
  import_sheet_leads: () => rpc.importSheetLeads({}, true),
  undo_activity: () => rpc.undoActivity({ activityId: 7 }),
  set_wiedervorlage: () => rpc.setWiedervorlage({ leadId: ID, due: '2026-11-01', note: 'n', templateId: ID }),
  export_backup: () => rpc.exportBackup(),
  import_templates: () => rpc.importTemplates({ rows: [] }),
  ping: () => rpc.ping(),
  log_outbound: () =>
    rpc.logOutbound({ leadId: ID, channel: 'linkedin', templateId: ID, kind: 'pitch', note: 'n', occurredAt: T }),
}

describe('rpc.ts – Parameternamen', () => {
  it('RPC_PARAMS entspricht der eingefrorenen Liste', () => {
    expect(RPC_PARAMS).toEqual(EINGEFROREN)
  })

  for (const name of Object.keys(EINGEFROREN) as RpcName[]) {
    it(`${name}: sendet genau ${EINGEFROREN[name].length} Parameter`, async () => {
      vi.mocked(supabase.rpc).mockClear()
      await VOLL[name]()
      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      const [fn, args, opts] = vi.mocked(supabase.rpc).mock.calls[0] as unknown as [
        string,
        Record<string, unknown>,
        { get?: boolean } | undefined,
      ]
      expect(fn).toBe(name)
      expect(Object.keys(args).sort()).toEqual([...EINGEFROREN[name]].sort())
      expect(Object.values(args).some((v) => v === undefined)).toBe(false)
      if (RPC_GET.includes(name)) expect(opts).toEqual({ get: true })
      else expect(opts).toBeUndefined()
    })
  }

  it('entfernt undefined-Werte (SQL-Defaults greifen)', async () => {
    vi.mocked(supabase.rpc).mockClear()
    await rpc.completeStep({ enrollmentId: ID })
    const [, args] = vi.mocked(supabase.rpc).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(args).toEqual({ p_enrollment_id: ID })
  })

  it('wirft den PostgREST-Fehler', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Lead hat widersprochen' },
    } as never)
    await expect(rpc.ping()).rejects.toMatchObject({ code: 'P0001' })
  })
})

describe('Bindung an den Client', () => {
  it('ruft supabase.rpc mit this = Client auf (live brach ein abgetrenntes rpc mit „reading rest“)', async () => {
    const original = supabase.rpc
    let gesehenesThis: unknown = null
    // supabase-js liest this.rest – ein Aufruf ohne Bindung hätte hier this = undefined
    ;(supabase as unknown as { rpc: unknown }).rpc = function (this: unknown) {
      gesehenesThis = this
      return Promise.resolve({ data: 1, error: null })
    }
    try {
      await rpc.setCounter({ metric: 'vernetzungen_versendet', value: 1 })
      expect(gesehenesThis).toBe(supabase)
    } finally {
      ;(supabase as unknown as { rpc: unknown }).rpc = original
    }
  })
})
