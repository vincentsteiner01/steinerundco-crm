// Smoke-Tests der Hooks mit supabaseMock (BAUPLAN § 3.1.11): richtige Tabelle/View, Filter, Rückgabe, Optimistik, Fehler-Toast.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEADS, MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { QUEUE } from '@/test/fixtures/queue'
import { SETTINGS } from '@/test/fixtures/settings'

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const { LEADS } = await import('@/test/fixtures/leads')
  const { QUEUE } = await import('@/test/fixtures/queue')
  const { SETTINGS } = await import('@/test/fixtures/settings')
  return supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'leads':
        return { data: LEADS, error: null, count: LEADS.length }
      case 'v_today_queue':
        return { data: QUEUE, error: null }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      case 'members':
        return {
          data: [
            { id: MEMBER_IDS[0], display_name: 'Vincent', short_name: 'Vincent', preferences: {} },
            { id: MEMBER_IDS[1], display_name: 'Mike', short_name: 'Mike', preferences: {} },
          ],
          error: null,
        }
      case 'v_pipeline_counts':
        return {
          data: [
            { stage: 'neu', leads: 5 },
            { stage: 'beendet', leads: 9 },
            { stage: 'pitch', leads: 2 },
          ],
          error: null,
        }
      case 'v_funnel_monthly':
        return {
          data: [
            {
              member_id: MEMBER_IDS[0],
              month_key: '2026-09',
              vernetzungen_versendet: 100,
              vernetzungen_angenommen: 20,
              anrufe: 10,
              anrufe_erreicht: 5,
              termine_telefon: 1,
            },
            {
              member_id: MEMBER_IDS[1],
              month_key: '2026-09',
              vernetzungen_versendet: 50,
              vernetzungen_angenommen: 30,
              anrufe: 0,
              anrufe_erreicht: 0,
              termine_telefon: 0,
            },
          ],
          error: null,
        }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
})
const MEMBER_IDS = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
vi.mock('@/components/toast', () => ({
  toastFehler: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
}))

import { toastFehler } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import { supabase } from '@/data/supabase'
import { kette } from '@/test/supabaseMock'

let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)
const vonMock = () => vi.mocked(supabase.from)
const letzteKette = (tabelle: string) => {
  const i = vonMock()
    .mock.calls.map((c) => c[0])
    .lastIndexOf(tabelle)
  return vonMock().mock.results[i]?.value as ReturnType<typeof kette>
}
/** Die Kette dieser Tabelle, auf der `methode` aufgerufen wurde (Mutationen werden von Refetches gefolgt). */
const ketteMit = (tabelle: string, methode: string) => {
  const calls = vonMock().mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i]?.[0] !== tabelle) continue
    const k = vonMock().mock.results[i]?.value as ReturnType<typeof kette>
    if ((k[methode] as { mock: { calls: unknown[] } }).mock.calls.length) return k
  }
  throw new Error(`keine ${tabelle}.${methode}()-Kette`)
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vonMock().mockClear()
  vi.mocked(toastFehler).mockClear()
  useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
})

describe('members / settings', () => {
  it('useMembers liest die View crm.members; useMe/useAndere teilen das Team', async () => {
    const { useAndere, useMe, useMembers } = await import('./members')
    const { result } = renderHook(() => ({ alle: useMembers(), ich: useMe(), andere: useAndere() }), { wrapper })
    await waitFor(() => expect(result.current.alle.data).toHaveLength(2))
    expect(vonMock()).toHaveBeenCalledWith('members')
    expect(result.current.ich?.id).toBe(MEMBER_V)
    expect(result.current.andere?.id).toBe(MEMBER_M)
  })

  it('useSettings baut aus key/value-Zeilen das Settings-Objekt; useSetting liefert einen Key', async () => {
    const { useSetting, useSettings } = await import('./settings')
    const { result } = renderHook(() => ({ s: useSettings(), q: useSetting('queue') }), { wrapper })
    await waitFor(() => expect(result.current.s.data).toBeTruthy())
    expect(result.current.s.data).toEqual(SETTINGS)
    expect(result.current.q?.due_time).toBe(SETTINGS.queue.due_time)
  })

  it('useSettingsUpdate mergt Objekt-Keys optimistisch und upsertet nach key', async () => {
    const { useSettings, useSettingsUpdate } = await import('./settings')
    const { result } = renderHook(() => ({ s: useSettings(), m: useSettingsUpdate() }), { wrapper })
    await waitFor(() => expect(result.current.s.data).toBeTruthy())
    await act(async () => {
      await result.current.m.mutateAsync({ key: 'queue', value: { kommend_days: 9 } })
    })
    const k = ketteMit('settings', 'upsert')
    expect(k['upsert']).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'queue', value: expect.objectContaining({ ...SETTINGS.queue, kommend_days: 9 }) }),
      {
        onConflict: 'key',
      },
    )
  })
})

describe('leads', () => {
  it('useLeads: Filter → PostgREST (deleted_at null, Stufen aus Phase, owner me, range 500, count exact)', async () => {
    const { useLeads } = await import('./leads')
    const { result } = renderHook(() => useLeads({ phase: ['angefragt'], zustaendig: 'me', faellig: 'ohne' }, 0), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    const k = letzteKette('leads')
    expect(k['select']).toHaveBeenCalledWith('*, companies(id, do_not_contact)', { count: 'exact' })
    expect(k['is']).toHaveBeenCalledWith('deleted_at', null)
    expect(k['in']).toHaveBeenCalledWith('stage', ['neu', 'vernetzung_gesendet'])
    expect(k['eq']).toHaveBeenCalledWith('owner_id', MEMBER_V)
    expect(k['is']).toHaveBeenCalledWith('next_action_at', null)
    expect(k['range']).toHaveBeenCalledWith(0, 499)
    expect(result.current.data).toEqual({ zeilen: LEADS, gesamt: LEADS.length, seite: 0, hatMehr: false })
  })

  it('useLeads: Papierkorb, Sequenz-Filter über Embed, Suche mit or(ilike)+fts', async () => {
    const { useLeads } = await import('./leads')
    const { result } = renderHook(
      () => useLeads({ papierkorb: true, sequenz: { key: 'linkedin_a' }, q: 'Müller, (GmbH)' }, 1),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeTruthy())
    const k = letzteKette('leads')
    expect(k['select']).toHaveBeenCalledWith(expect.stringContaining('enrollments!inner('), { count: 'exact' })
    expect(k['not']).toHaveBeenCalledWith('deleted_at', 'is', null)
    expect(k['eq']).toHaveBeenCalledWith('enrollments.sequences.key', 'linkedin_a')
    expect(k['or']).toHaveBeenCalledWith(
      'full_name.ilike.*Müller GmbH*,company_name.ilike.*Müller GmbH*,search.fts(german).Müller GmbH',
    )
    expect(k['range']).toHaveBeenCalledWith(500, 999)
  })

  it('useLead lädt mit Embeds und single()', async () => {
    const { useLead, LEAD_EMBED } = await import('./leads')
    vonMock().mockImplementationOnce(() => kette({ data: LEADS[0], error: null }))
    const { result } = renderHook(() => useLead(LEADS[0]!.id), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    const k = letzteKette('leads')
    expect(k['select']).toHaveBeenCalledWith(LEAD_EMBED)
    expect(k['single']).toHaveBeenCalled()
  })

  it('useLeadUpdate: optimistisch im Detail-Cache, updated_at-Bedingung, Konflikt → Toast + Reload', async () => {
    const { useLeadUpdate } = await import('./leads')
    const { qk } = await import('./queryKeys')
    const lead = LEADS[1]!
    qc.setQueryData(qk.leads.detail(lead.id), { ...lead, companies: null })
    // 0 Zeilen zurück = jemand anders hat zuerst gespeichert
    vonMock().mockImplementationOnce(() => kette({ data: null, error: null }))
    const { result } = renderHook(() => useLeadUpdate(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { city: 'Hamburg' } })
        .catch(() => {})
    })
    const k = ketteMit('leads', 'update')
    expect(k['update']).toHaveBeenCalledWith({ city: 'Hamburg' })
    expect(k['eq']).toHaveBeenCalledWith('updated_at', lead.updated_at)
    expect(toastFehler).toHaveBeenCalledWith(expect.stringMatching(/hat den Lead gerade geändert – neu geladen\.$/))
  })

  it('useLeadLoeschen setzt deleted_at (Soft-Delete)', async () => {
    const { useLeadLoeschen } = await import('./leads')
    vonMock().mockImplementationOnce(() => kette({ data: LEADS[2], error: null }))
    const { result } = renderHook(() => useLeadLoeschen(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(LEADS[2]!.id)
    })
    expect(ketteMit('leads', 'update')['update']).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
  })
})

describe('queue / nav', () => {
  it('useQueue filtert member_id und sortiert nach E15; useQueueZaehler zählt Sektionen', async () => {
    const { useQueue, useQueueZaehler } = await import('./queue')
    const { result } = renderHook(
      () => ({ q: useQueue(MEMBER_V, '2026-10-14'), z: useQueueZaehler(MEMBER_V, '2026-10-14') }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.q.data).toHaveLength(QUEUE.length))
    const k = letzteKette('v_today_queue')
    expect(k['eq']).toHaveBeenCalledWith('member_id', MEMBER_V)
    expect(k['order']).toHaveBeenNthCalledWith(1, 'section_order', { ascending: true })
    expect(k['order']).toHaveBeenNthCalledWith(2, 'rank_score', { ascending: false, nullsFirst: false })
    const z = result.current.z.data!
    expect(z.gesamt).toBe(QUEUE.length)
    expect(z.faellig).toBe(z.je.antworten + z.je.ueberfaellig + z.je.heute)
  })

  it('useQueue(null) nutzt is.null (Neue Anfragen ohne Zuständige)', async () => {
    const { useQueue } = await import('./queue')
    const { result } = renderHook(() => useQueue(null, '2026-10-14'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(letzteKette('v_today_queue')['is']).toHaveBeenCalledWith('member_id', null)
  })

  it('useNavZaehler: heute aus der Queue, leads = aktive Leads ohne beendet', async () => {
    const { useNavZaehler } = await import('./nav')
    const { result } = renderHook(() => useNavZaehler(), { wrapper })
    await waitFor(() => expect(result.current.leads).toBe(7))
    expect(result.current.heute).toBeGreaterThan(0)
  })
})

describe('Zeitraum-Hooks (§ 1.5 Nr. 40)', () => {
  it('useCallsZeitraum: direction out, Berlin-Grenzen in UTC, Seiten à 500, team ohne member-Filter', async () => {
    const { useCallsZeitraum } = await import('./calls')
    const { result } = renderHook(() => useCallsZeitraum('team', '2026-10-01', '2026-10-31'), { wrapper })
    await waitFor(() => expect(result.current.istLaden).toBe(false))
    const k = letzteKette('calls')
    expect(k['eq']).toHaveBeenCalledWith('direction', 'out')
    expect(k['eq']).not.toHaveBeenCalledWith('member_id', expect.anything())
    expect(k['gte']).toHaveBeenCalledWith('started_at', '2026-09-30T22:00:00.000Z')
    expect(k['lt']).toHaveBeenCalledWith('started_at', '2026-10-31T23:00:00.000Z')
    expect(k['range']).toHaveBeenCalledWith(0, 499)
    expect(result.current.hatMehr).toBe(false)
  })

  it('useActivitiesZeitraum: schlanke Spalten, type in (…), member-Filter bei Person', async () => {
    const { useActivitiesZeitraum, ZEITRAUM_SPALTEN } = await import('./activities')
    const { result } = renderHook(
      () => useActivitiesZeitraum(MEMBER_M, '2026-10-14', '2026-10-14', ['nachricht_erhalten', 'anruf']),
      { wrapper },
    )
    await waitFor(() => expect(result.current.istLaden).toBe(false))
    const k = letzteKette('activities')
    expect(k['select']).toHaveBeenCalledWith(ZEITRAUM_SPALTEN)
    expect(k['in']).toHaveBeenCalledWith('type', ['nachricht_erhalten', 'anruf'])
    expect(k['eq']).toHaveBeenCalledWith('member_id', MEMBER_M)
  })

  it('useEmailsZeitraum filtert sent_at', async () => {
    const { useEmailsZeitraum } = await import('./emails')
    const { result } = renderHook(() => useEmailsZeitraum(MEMBER_V, '2026-10-14', '2026-10-14'), { wrapper })
    await waitFor(() => expect(result.current.istLaden).toBe(false))
    expect(letzteKette('emails')['gte']).toHaveBeenCalledWith('sent_at', expect.stringMatching(/T22:00:00\.000Z$/))
  })
})

describe('kpis', () => {
  it('useFunnelMonatlich(team) summiert beide Personen und rechnet Quoten neu', async () => {
    const { useFunnelMonatlich } = await import('./kpis')
    const { result } = renderHook(() => useFunnelMonatlich('team', '2026-09'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(result.current.data).toMatchObject({
      vernetzungen_versendet: 150,
      vernetzungen_angenommen: 50,
      annahme_quote: 0.3333,
      connect_rate: 0.5,
      termine_pro_100_anrufe: 10,
    })
    expect(letzteKette('v_funnel_monthly')['eq']).not.toHaveBeenCalledWith('member_id', expect.anything())
  })
})

describe('Mutationen mit RPC und Optimistik', () => {
  it('useLogOutbound entfernt die Antworten-Karte optimistisch und ruft log_outbound', async () => {
    const { useLogOutbound } = await import('./outbound')
    const { qk } = await import('./queryKeys')
    const antwort = QUEUE.find((i) => i.section === 'antworten')!
    qc.setQueryData(qk.queue.member(MEMBER_V, '2026-10-14'), QUEUE)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 42, error: null } as never)
    const { result } = renderHook(() => useLogOutbound(), { wrapper })
    let id: number | undefined
    await act(async () => {
      id = await result.current.mutateAsync({ leadId: antwort.lead_id!, kind: 'nachricht' })
    })
    expect(id).toBe(42)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'log_outbound',
      { p_lead_id: antwort.lead_id, p_kind: 'nachricht' },
      undefined,
    )
  })

  it('useNotizErstellen: Platzhalter sofort in der Timeline, Insert type notiz', async () => {
    const { useActivities, useNotizErstellen } = await import('./activities')
    const lead = LEADS[0]!
    const { result } = renderHook(() => ({ t: useActivities(lead.id), m: useNotizErstellen() }), { wrapper })
    await waitFor(() => expect(result.current.t.data).toBeTruthy())
    vonMock().mockImplementationOnce(() => kette({ data: { id: 9, lead_id: lead.id, type: 'notiz' }, error: null }))
    await act(async () => {
      await result.current.m.mutateAsync({ leadId: lead.id, note: 'Hallo' })
    })
    const k = ketteMit('activities', 'insert')
    expect(k['insert']).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: lead.id,
        type: 'notiz',
        channel: 'sonstiges',
        note: 'Hallo',
        member_id: MEMBER_V,
      }),
    )
  })

  it('useConnectionAblehnen patcht status/withdrawn_at/note = abgelehnt und liest die Trigger-Aktivität nach', async () => {
    const { useConnectionAblehnen } = await import('./connections')
    vonMock()
      .mockImplementationOnce(() => kette({ data: { id: 'c1', status: 'zurueckgezogen' }, error: null }))
      .mockImplementationOnce(() => kette({ data: { id: 77, type: 'vernetzung_zurueckgezogen' }, error: null }))
    const { result } = renderHook(() => useConnectionAblehnen(), { wrapper })
    let r: unknown
    await act(async () => {
      r = await result.current.mutateAsync({ id: 'c1', leadId: LEADS[0]!.id })
    })
    expect(r).toEqual({
      connection: { id: 'c1', status: 'zurueckgezogen' },
      activity: { id: 77, type: 'vernetzung_zurueckgezogen' },
    })
    const k = vonMock().mock.results[0]?.value as ReturnType<typeof kette>
    expect(k['update']).toHaveBeenCalledWith({
      status: 'zurueckgezogen',
      withdrawn_at: expect.any(String),
      note: 'abgelehnt',
    })
  })

  it('Fehler einer Mutation → toastFehler mit deutscher Meldung', async () => {
    const { useTaskErstellen } = await import('./tasks')
    vonMock().mockImplementationOnce(() => kette({ data: null, error: { code: '23505', message: 'duplicate key' } }))
    const { result } = renderHook(() => useTaskErstellen(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ lead_id: LEADS[0]!.id, kind: 'aufgabe', title: 'x', due_at: '2026-10-15T07:00:00Z' } as never)
        .catch(() => {})
    })
    expect(toastFehler).toHaveBeenCalledWith('Gibt es schon – LinkedIn-URL ist bereits vergeben.', undefined)
  })

  it('useUndo: anbieten zeigt den Undo-Toast, ausführen ruft undo_activity und invalidiert', async () => {
    const { useUndo, undoActivityAusfuehren } = await import('./undo')
    const { toastUndo } = await import('@/components/toast')
    const { queryClient } = await import('./queryClient')
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { activity_id: 5, type: 'notiz', restored: [] },
      error: null,
    } as never)
    const { result } = renderHook(() => useUndo(), { wrapper })
    result.current.anbieten(5, 'Erledigt – Opener.', LEADS[0]!.id)
    expect(toastUndo).toHaveBeenCalledWith('Erledigt – Opener.', 5)
    await undoActivityAusfuehren(5)
    expect(supabase.rpc).toHaveBeenCalledWith('undo_activity', { p_activity_id: 5 }, undefined)
    expect(spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toEqual(
      expect.arrayContaining([
        JSON.stringify(['activities', LEADS[0]!.id]),
        JSON.stringify(['leads']),
        JSON.stringify(['queue']),
      ]),
    )
  })
})
