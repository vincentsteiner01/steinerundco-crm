// Runde 2 (echte Daten): Team zeigte „63 überfällig“, Heute „60“ – Heute zählt überfällige Rückrufe und Opener in eigenen Sektionen.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import type { QueueItem } from '@/types/domain'
import { zaehleQueue } from './queue'

const item = (p: Partial<QueueItem>): QueueItem =>
  ({ section: 'ueberfaellig', item_kind: 'sequenz_schritt', ...p }) as QueueItem

describe('zaehleQueue', () => {
  it('ueberfaelligSektion zählt wie die Heute-Sektion: ohne Rückrufe und ohne Opener', () => {
    const items = [
      item({ step_id: 's-kf2' }),
      item({ step_id: 's-kf2' }),
      item({ step_id: 's-opener' }),
      item({ item_kind: 'rueckruf', step_id: null }),
      item({ section: 'heute', step_id: 's-kf2' }),
    ]
    const z = zaehleQueue(items, (id) => id === 's-opener')
    expect(z.ueberfaellig).toBe(4)
    expect(z.ueberfaelligSektion).toBe(2)
    expect(z.faellig).toBe(5)
  })
})
