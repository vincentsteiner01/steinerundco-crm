import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { keysetFilter, ladeProtokollSeite, naechsterCursor, PROTOKOLL_SEITE } from './team'

describe('Team-Protokoll: Keyset-Abfrage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('erste Seite: beide Personen, Zeitraum in Berliner Grenzen, neueste zuerst, 50 Zeilen, Lead-Namen eingebettet', async () => {
    const { supabase } = await import('@/data/supabase')
    await ladeProtokollSeite({ memberIds: ['a', 'b'], kanal: null, von: '2026-10-12', bis: '2026-10-18' }, null)
    const k = vi.mocked(supabase.from).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>
    expect(supabase.from).toHaveBeenCalledWith('activities')
    expect(k.select).toHaveBeenCalledWith(expect.stringContaining('lead:leads!activities_lead_id_fkey('))
    expect(k.in).toHaveBeenCalledWith('member_id', ['a', 'b'])
    expect(k.gte).toHaveBeenCalledWith('occurred_at', '2026-10-11T22:00:00.000Z')
    expect(k.lt).toHaveBeenCalledWith('occurred_at', '2026-10-18T22:00:00.000Z')
    expect(k.eq).not.toHaveBeenCalled()
    expect(k.or).not.toHaveBeenCalled()
    expect(k.order).toHaveBeenNthCalledWith(1, 'occurred_at', { ascending: false })
    expect(k.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(k.limit).toHaveBeenCalledWith(PROTOKOLL_SEITE)
  })

  it('Folgeseite: Kanal-Filter und Keyset „älter als (occurred_at, id)“', async () => {
    const { supabase } = await import('@/data/supabase')
    const cursor = { occurredAt: '2026-10-14T15:00:00+00:00', id: 8 }
    await ladeProtokollSeite({ memberIds: ['b'], kanal: 'telefon', von: '2026-10-15', bis: '2026-10-15' }, cursor)
    const k = vi.mocked(supabase.from).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>
    expect(k.eq).toHaveBeenCalledWith('channel', 'telefon')
    expect(k.or).toHaveBeenCalledWith(
      'occurred_at.lt.2026-10-14T15:00:00+00:00,and(occurred_at.eq.2026-10-14T15:00:00+00:00,id.lt.8)',
    )
    expect(keysetFilter(cursor)).toBe(
      'occurred_at.lt.2026-10-14T15:00:00+00:00,and(occurred_at.eq.2026-10-14T15:00:00+00:00,id.lt.8)',
    )
  })

  it('nächster Cursor nur bei voller Seite', () => {
    const voll = Array.from({ length: PROTOKOLL_SEITE }, (_, i) => ({ id: 100 - i, occurred_at: `t${i}` }))
    expect(naechsterCursor(voll)).toEqual({ occurredAt: `t${PROTOKOLL_SEITE - 1}`, id: 100 - PROTOKOLL_SEITE + 1 })
    expect(naechsterCursor(voll.slice(0, 12))).toBeUndefined()
    expect(naechsterCursor([])).toBeUndefined()
  })
})
