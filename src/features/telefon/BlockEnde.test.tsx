// Block-Ende (T-12): Dials · Erreicht · Entscheider · Termine · Rückrufe · Ø Dauer stimmen mit den Anruf-Datensätzen der Session
// überein; „Zu Heute“ beendet die Session. Dazu die reine Auswertung `blockZusammenfassung`.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_M } from '@/test/fixtures/leads'
import type { CallOutcomeDef } from '@/types/domain'

const stand = vi.hoisted(() => ({ calls: [] as unknown[] }))

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => (tabelle === 'calls' ? { data: stand.calls, error: null } : h.antworten()(tabelle)))
})

import { supabase } from '@/data/supabase'
import { BlockEnde } from './BlockEnde'
import { BLOCK_KEY, blockLesen, blockStarten, _blockCacheZuruecksetzen } from './CallBlock'
import { blockZusammenfassung } from './zusammenfassung'
import { call, LEAD_A, LEAD_B, LEAD_C, rendern } from './_testHilfe'

const SESSION_CALLS = [
  call(LEAD_A.id, 'no_answer', { duration_sec: 30 }),
  call(LEAD_B.id, 'busy', { duration_sec: 10 }),
  call(LEAD_C.id, 'gatekeeper', { duration_sec: 60 }),
  call(LEAD_A.id, 'meeting_booked', { duration_sec: 240 }),
  call(LEAD_B.id, 'callback_scheduled', { duration_sec: 90 }),
  call(LEAD_C.id, 'dm_interest', { duration_sec: 120 }),
]

describe('blockZusammenfassung', () => {
  it('zählt Dials, Erreicht (Connect), Entscheider, Termine, Rückrufe; Ø Dauer über erreichte Anrufe', () => {
    expect(blockZusammenfassung(SESSION_CALLS)).toEqual({
      dials: 6,
      erreicht: 4,
      entscheider: 2,
      termine: 1,
      rueckrufe: 1,
      dauerSec: Math.round((60 + 240 + 90 + 120) / 4),
    })
    expect(blockZusammenfassung([])).toEqual({
      dials: 0,
      erreicht: 0,
      entscheider: 0,
      termine: 0,
      rueckrufe: 0,
      dauerSec: 0,
    })
  })

  it('nimmt is_connect/is_dm aus call_outcome_defs, wenn vorhanden', () => {
    const defs = [
      { outcome: 'gatekeeper', is_connect: false, is_dm: false },
      { outcome: 'meeting_booked', is_connect: true, is_dm: true },
    ] as unknown as CallOutcomeDef[]
    const z = blockZusammenfassung(SESSION_CALLS, defs)
    expect(z.erreicht).toBe(1)
    expect(z.entscheider).toBe(1)
    expect(z.dauerSec).toBe(240)
  })
})

describe('BlockEnde', () => {
  beforeEach(() => {
    localStorage.clear()
    _blockCacheZuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    stand.calls = SESSION_CALLS
    vi.mocked(supabase.from).mockClear()
  })

  it('T-12: zeigt die Werte der Session-Anrufe (eigene Anrufe seit Block-Start); „Zu Heute“ beendet den Block', async () => {
    const session = blockStarten([LEAD_A.id, LEAD_B.id, LEAD_C.id], new Date('2026-10-14T07:30:00.000Z'))
    const onSchliessen = vi.fn()
    const { router } = rendern(
      <BlockEnde session={session} me={MEMBER_M} onSchliessen={onSchliessen} />,
      '/telefon?block=ende',
      '/telefon',
    )
    const tabelle = await screen.findByTestId('block-zusammenfassung')
    await waitFor(() => expect(tabelle).toHaveTextContent('Dials6'))
    const wert = (label: string) => within(tabelle).getByText(label).nextElementSibling?.textContent
    expect(wert('Erreicht')).toBe('4')
    expect(wert('Entscheider')).toBe('2')
    expect(wert('Termine')).toBe('1')
    expect(wert('Rückrufe vereinbart')).toBe('1')
    expect(wert('Ø Dauer')).toBe('02:08')
    // Abfrage: member_id = ich, started_at ≥ Block-Start
    const kette = vi.mocked(supabase.from).mock.results.find((_r, i) => supabase.from.mock.calls[i]?.[0] === 'calls')
      ?.value as { eq: ReturnType<typeof vi.fn>; gte: ReturnType<typeof vi.fn> }
    expect(kette.eq).toHaveBeenCalledWith('member_id', MEMBER_M)
    expect(kette.gte).toHaveBeenCalledWith('started_at', session.start)

    fireEvent.click(screen.getByRole('button', { name: 'Zu Heute' }))
    expect(onSchliessen).toHaveBeenCalled()
    expect(localStorage.getItem(BLOCK_KEY)).toBeNull()
    expect(blockLesen()).toBeNull()
    await waitFor(() => expect(router.state.location.pathname).toBe('/heute'))
  })
})
