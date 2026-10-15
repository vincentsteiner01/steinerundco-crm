// Review-Korrekturen der Daten-Schicht: Überfällig-Filter (vor heute 00:00), Sequenz fortsetzen (§ 5.1 max(alt, heute 09:00)),
// doppelte Sequenz-Mail ausblenden, Firma per Name verknüpfen, Widerspruchs-Kanäle im Zeitraum-Select.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'

const stand = vi.hoisted(() => ({ firmen: [] as unknown[], enrollment: null as unknown }))

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const { SETTINGS } = await import('@/test/fixtures/settings')
  return supabaseMock((tabelle) => {
    if (tabelle === 'settings')
      return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
    if (tabelle === 'companies') return { data: stand.firmen, error: null }
    if (tabelle === 'enrollments') return { data: stand.enrollment, error: null }
    return { data: [], error: null, count: 0 }
  })
})
vi.mock('@/components/toast', () => ({
  toastFehler: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
}))

import { useAuth } from '@/features/auth/authStore'
import { supabase } from '@/data/supabase'
import { kette } from '@/test/supabaseMock'
import { berlinMitternachtIso, heuteBerlin } from './_helfer'
import { ohneDoppelteEmailSendung, ZEITRAUM_SPALTEN } from './activities'
import { firmaFuerName, firmaInListe, firmaNorm } from './companies'
import { fortsetzenFaellig, useEnrollmentFortsetzen } from './enrollments'
import { wendeLeadFilterAn } from './leads'

let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)
const vonMock = () => vi.mocked(supabase.from)

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vonMock().mockClear()
  stand.firmen = []
  stand.enrollment = null
  useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
})

describe('Leads-Filter „überfällig“', () => {
  it('ist „vor heute 00:00“ (BAUPLAN § 3.3) – nicht „vor jetzt“', () => {
    const k = kette()
    wendeLeadFilterAn(k, { faellig: 'ueberfaellig' }, null)
    expect(k['lt']).toHaveBeenCalledWith('next_action_at', berlinMitternachtIso(heuteBerlin()))
  })
})

describe('Sequenz fortsetzen (§ 5.1)', () => {
  it('fortsetzenFaellig: max(alt, heute 09:00), heute auf einen Werktag gerollt', () => {
    // Mi 14.10.2026: alter Termin weit zurück → heute 09:00 Berlin (07:00 UTC)
    expect(fortsetzenFaellig('2026-09-01T07:00:00.000Z', { heute: '2026-10-14', feiertage: [] })).toBe(
      '2026-10-14T07:00:00.000Z',
    )
    // künftiger Termin bleibt
    expect(fortsetzenFaellig('2026-10-20T07:00:00.000Z', { heute: '2026-10-14', feiertage: [] })).toBe(
      '2026-10-20T07:00:00.000Z',
    )
    // Samstag → Montag 09:00
    expect(fortsetzenFaellig(null, { heute: '2026-10-17', feiertage: [] })).toBe('2026-10-19T07:00:00.000Z')
  })

  it('useEnrollmentFortsetzen patcht Status UND next_due_at (Review: vorher nur der Status)', async () => {
    stand.enrollment = { id: 'e1', next_due_at: '2026-08-01T07:00:00.000Z', status: 'pausiert' }
    const { result } = renderHook(() => useEnrollmentFortsetzen(), { wrapper })
    await waitFor(() => expect(qc.getQueryData(['settings'])).toBeTruthy())
    await act(async () => {
      await result.current.mutateAsync({ enrollmentId: 'e1', leadId: 'l1' })
    })
    const ketten = vonMock()
      .mock.results.filter((_, i) => vonMock().mock.calls[i]?.[0] === 'enrollments')
      .map((r) => r.value as ReturnType<typeof kette>)
    const update = ketten.find((k) => (k['update'] as { mock: { calls: unknown[] } }).mock.calls.length)
    if (!update) throw new Error('kein Update auf enrollments')
    const patch = (update['update'] as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.status).toBe('aktiv')
    expect(new Date(patch.next_due_at as string).getTime()).toBeGreaterThan(new Date('2026-08-01').getTime())
    expect(patch.next_due_at).toBe(
      fortsetzenFaellig('2026-08-01T07:00:00.000Z', {
        dueTime: SETTINGS.queue.due_time,
        feiertage: SETTINGS.feiertage,
      }),
    )
  })
})

describe('Doppelte Sequenz-Mail (M-06: emails_after_write + complete_step)', () => {
  const basis = { lead_id: 'l1', enrollment_id: 'e1', step_id: 's1' }
  it('blendet das `email_gesendet` ohne email_id aus, wenn es eines mit email_id zum selben Schritt gibt', () => {
    const zeilen = [
      { id: 1, type: 'email_gesendet' as const, email_id: 'm1', ...basis },
      { id: 2, type: 'email_gesendet' as const, email_id: null, ...basis },
      { id: 3, type: 'email_gesendet' as const, email_id: null, ...basis, step_id: 's2' },
      { id: 4, type: 'nachricht_gesendet' as const, email_id: null, ...basis },
    ]
    expect(ohneDoppelteEmailSendung(zeilen).map((z) => z.id)).toEqual([1, 3, 4])
  })
  it('Zeitraum-Select liest email_id und die Widerspruchs-Kanäle (metadata->channels)', () => {
    expect(ZEITRAUM_SPALTEN).toContain('email_id')
    expect(ZEITRAUM_SPALTEN).toContain('kanaele:metadata->channels')
  })
})

describe('Firma per Name (company_id statt nur company_name)', () => {
  it('firmaNorm wie crm.company_norm; firmaInListe findet über name_norm', () => {
    expect(firmaNorm('  Sperrfirma   Energie ')).toBe('sperrfirma energie')
    expect(firmaNorm('   ')).toBeNull()
    const liste = [{ id: 'c1', name: 'Sperrfirma Energie', name_norm: 'sperrfirma energie', do_not_contact: true }]
    expect(firmaInListe(liste as never, 'SPERRFIRMA energie')?.id).toBe('c1')
    expect(firmaInListe(liste as never, 'Andere')).toBeNull()
  })

  it('firmaFuerName nimmt die vorhandene Firma, sonst Insert', async () => {
    stand.firmen = [{ id: 'c1', name: 'Solar Nord GmbH', name_norm: 'solar nord gmbh' }]
    expect((await firmaFuerName('solar  nord gmbh')).id).toBe('c1')
    const k = vonMock().mock.results.at(-1)?.value as ReturnType<typeof kette>
    expect(k['eq']).toHaveBeenCalledWith('name_norm', 'solar nord gmbh')

    stand.firmen = []
    vonMock()
      .mockImplementationOnce(() => kette({ data: [], error: null }))
      .mockImplementationOnce(() => kette({ data: { id: 'c9', name: 'Neu GmbH' }, error: null }))
    expect((await firmaFuerName(' Neu  GmbH ')).id).toBe('c9')
    const ins = vonMock().mock.results.at(-1)?.value as ReturnType<typeof kette>
    expect(ins['insert']).toHaveBeenCalledWith({ name: 'Neu GmbH' })
  })
})
