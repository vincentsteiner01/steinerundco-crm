// Antwort erhalten (Runde 3): Kam die Antwort schon über die LinkedIn-Mail (jüngste nachricht_erhalten ohne Reaktion, danach kein
// eigener Kontakt – src/data/antworten.ts), trägt `A` nur die Reaktion nach (set_reply_label) – keine zweite Antwort, kein
// Undo-Toast. Sonst bleibt es bei log_reply.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const zustand: { activities: unknown[]; eigeneDanach: unknown[]; inbound: string | null; stage: string } = {
  activities: [],
  eigeneDanach: [],
  inbound: null,
  stage: 'dm_beantwortet',
}

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const { vollerLead, MEMBER_V } = await import('@/test/fixtures/leads')
  const mock = supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'leads':
        return {
          data: vollerLead(3, {
            owner_id: MEMBER_V,
            inbound_unanswered_since: zustand.inbound,
            stage: zustand.stage as never,
          }),
          error: null,
        }
      case 'activities':
        return { data: zustand.activities, error: null }
      case 'templates':
        return {
          data: [{ id: 't1', key: 'li_bedarf_ja_v1', name: 'Ja (V1)', channel: 'linkedin', phase: 'x', body: 'x' }],
          error: null,
        }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
  // activities: die Frage „eigener Kontakt nach der Antwort?“ (…gt('occurred_at', …)) bekommt eine eigene Antwort
  const basis = mock.supabase.from.getMockImplementation()!
  mock.supabase.from.mockImplementation((tabelle: string) => {
    const k = basis(tabelle) as Record<string, unknown>
    if (tabelle !== 'activities') return k
    let danach = false
    k['gt'] = vi.fn(() => {
      danach = true
      return k
    })
    k['then'] = (res: (a: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: danach ? zustand.eigeneDanach : zustand.activities, error: null }).then(res, rej)
    return k
  })
  return mock
})
vi.mock('@/components/toast', () => ({
  toastFehler: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { useUiStore } from '@/app/uiStore'
import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { rendern, taste } from './_testHilfe'
import { AntwortErhalten } from './AntwortErhalten'

const LEAD_ID = vollerLead(3).id
const MAIL_ANTWORT = {
  id: 501,
  lead_id: LEAD_ID,
  type: 'nachricht_erhalten',
  channel: 'linkedin',
  reply_label: null,
  note: 'Klingt interessant, erzählen Sie mehr.',
  occurred_at: '2026-10-15T09:41:00Z',
  created_at: '2026-10-15T09:45:00Z',
}
const rpc = () => vi.mocked(supabase.rpc)

describe('AntwortErhalten – Reaktion nachtragen', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    rpc().mockReset()
    rpc().mockResolvedValue({ data: 501, error: null } as never)
    vi.mocked(toast).mockClear()
    vi.mocked(toastUndo).mockClear()
    zustand.inbound = '2026-10-15T09:41:00Z'
    zustand.stage = 'dm_beantwortet'
    zustand.activities = [MAIL_ANTWORT]
    zustand.eigeneDanach = []
  })

  it('Antwort aus der Mail ohne Reaktion: A setzt nur das Label (set_reply_label), kein log_reply, kein Undo', async () => {
    const onVorschlag = vi.fn()
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv onVorschlag={onVorschlag} />)
    // warten, bis der Lead geladen ist (sonst ist die offene Antwort noch unbekannt)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    taste('a')
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    expect(await screen.findByText(/kam schon über die LinkedIn-Mail ins CRM/)).toBeInTheDocument()
    // vorhandenes Zitat wird angezeigt statt eines Eingabefelds, Datum entfällt
    expect(screen.getByText('‚Klingt interessant, erzählen Sie mehr.‘')).toBeInTheDocument()
    expect(screen.queryByLabelText('Zitat')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Datum')).not.toBeInTheDocument()
    taste('1')
    expect(screen.getByRole('button', { name: /^Reaktion speichern/ })).toBeEnabled()
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    // über antwortErfassen → rpc.setReplyLabel (src/data) – p_note null: die Antwort behält ihren Text aus der Mail
    expect(rpc().mock.calls[0]?.slice(0, 2)).toEqual([
      'set_reply_label',
      { p_activity_id: 501, p_label: 'interessiert', p_note: null },
    ])
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Reaktion erfasst – Vorlage ‚Ja (V1)‘ vorgeschlagen.'))
    expect(toastUndo).not.toHaveBeenCalled()
    expect(onVorschlag).toHaveBeenCalledWith('li_bedarf_ja_v1')
  })

  it('Chip 4 „Nein (mit Grund)“ gilt mit dem Zitat aus der Mail als begründet', async () => {
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv />)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    taste('a')
    await screen.findByText(/kam schon über die LinkedIn-Mail ins CRM/)
    taste('4')
    expect(screen.getByRole('button', { name: /^Reaktion speichern/ })).toBeEnabled()
  })

  it('Antwort ohne Text aus der Mail: das eingetippte Zitat geht als p_note mit', async () => {
    zustand.activities = [{ ...MAIL_ANTWORT, note: null }]
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv />)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    taste('a')
    await screen.findByText(/kam schon über die LinkedIn-Mail ins CRM/)
    const zitat = screen.getByLabelText('Zitat')
    fireEvent.change(zitat, { target: { value: 'Später gern' } })
    taste('7')
    taste('Enter', { metaKey: true }, zitat)
    await waitFor(() =>
      expect(rpc().mock.calls[0]?.slice(0, 2)).toEqual([
        'set_reply_label',
        { p_activity_id: 501, p_label: 'spaeter', p_note: 'Später gern' },
      ]),
    )
  })

  it('jüngste Antwort hat schon eine Reaktion → neue Antwort über log_reply mit Undo-Toast', async () => {
    zustand.activities = [{ ...MAIL_ANTWORT, reply_label: 'frage' }]
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv />)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    taste('a')
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    expect(screen.getByLabelText('Zitat')).toBeInTheDocument()
    taste('1')
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    expect(rpc().mock.calls[0]?.[0]).toBe('log_reply')
    await waitFor(() => expect(toastUndo).toHaveBeenCalled())
    expect(screen.queryByText(/kam schon über die LinkedIn-Mail/)).not.toBeInTheDocument()
  })

  it('eigener Kontakt nach der Antwort (schon beantwortet) → neue Antwort über log_reply', async () => {
    zustand.eigeneDanach = [{ id: 777 }]
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv />)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    taste('a')
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    taste('3')
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    expect(rpc().mock.calls[0]?.[0]).toBe('log_reply')
    expect(screen.queryByText(/kam schon über die LinkedIn-Mail/)).not.toBeInTheDocument()
  })

  it('geschlossen fragt der Block die Timeline nicht ab', async () => {
    rendern(<AntwortErhalten leadId={LEAD_ID} aktiv />)
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('leads'))
    expect(vi.mocked(supabase.from).mock.calls.some((c) => c[0] === 'activities')).toBe(false)
  })
})
