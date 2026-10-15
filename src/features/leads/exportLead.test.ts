// exportLead.test.ts (BAUPLAN § 3.3, § 1.5 Nr. 32, LD-12): Dateiname `lead-<kurzId>-<YYYY-MM-DD>.json`, alle zehn Abschnitte,
// Protokoll-Notiz `metadata.kind = 'auskunft_export'` („Auskunft exportiert (JSON)“ in der Timeline).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadJson } from '@/lib/csv'
import { kurzId } from '@/lib/ids'
import {
  DB,
  FIRMA_GESPERRT,
  MEMBER_V,
  aktivitaet,
  erstesArg,
  leadMitBezug,
  zugriffeMit,
  zuruecksetzen,
} from './_testHilfe'
import { AUSKUNFT_ABSCHNITTE, auskunftDateiname, exportLead } from './exportLead'
import { timelineText } from './timelineText'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/lib/csv', async (original) => ({ ...(await original<typeof import('@/lib/csv')>()), downloadJson: vi.fn() }))

const LEAD = leadMitBezug(1, {
  companies: FIRMA_GESPERRT,
  enrollments: [{ id: 'e1', status: 'aktiv' } as never],
  tasks: [{ id: 't1', status: 'offen' } as never],
  meetings: [{ id: 'm1', status: 'geplant' } as never],
  linkedin_connections: [{ id: 'c1', status: 'angenommen' } as never],
  lead_tags: [{ tag_id: 'tag1' }],
})

describe('exportLead', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.details = [LEAD]
    DB.activities = [aktivitaet({ lead_id: LEAD.id, type: 'notiz', note: 'x' })]
    DB.calls = [{ id: 'call1', lead_id: LEAD.id }]
    DB.emails = [{ id: 'mail1', lead_id: LEAD.id }]
    DB.tags = [{ id: 'tag1', name: 'Messe' }]
    vi.mocked(downloadJson).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('Dateiname lead-<kurzId>-<heute>.json', () => {
    expect(auskunftDateiname(LEAD.id, '2026-10-14')).toBe(`lead-${kurzId(LEAD.id)}-2026-10-14.json`)
  })

  it('lädt alle zehn Abschnitte, lädt die Datei herunter und schreibt die Notiz (LD-12)', async () => {
    const { auskunft, dateiname } = await exportLead(LEAD.id, MEMBER_V)
    expect(dateiname).toBe(`lead-${kurzId(LEAD.id)}-2026-10-14.json`)
    for (const k of AUSKUNFT_ABSCHNITTE) expect(auskunft).toHaveProperty(k)
    expect(AUSKUNFT_ABSCHNITTE).toHaveLength(10)
    expect(auskunft.exported_at).toMatch(/^2026-10-14T/)
    expect(auskunft.lead.id).toBe(LEAD.id)
    expect(auskunft.lead).not.toHaveProperty('companies')
    expect(auskunft.company?.name).toBe('Sperrfirma Energie')
    expect(auskunft.activities).toHaveLength(1)
    expect(auskunft.calls).toHaveLength(1)
    expect(auskunft.emails).toHaveLength(1)
    expect(auskunft.meetings).toHaveLength(1)
    expect(auskunft.tasks).toHaveLength(1)
    expect(auskunft.linkedin_connections).toHaveLength(1)
    expect(auskunft.enrollments).toHaveLength(1)
    expect(auskunft.tags).toEqual([{ id: 'tag1', name: 'Messe' }])
    expect(downloadJson).toHaveBeenCalledWith(auskunft, dateiname)

    const insert = erstesArg(zugriffeMit('activities', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert).toMatchObject({
      lead_id: LEAD.id,
      type: 'notiz',
      member_id: MEMBER_V,
      metadata: { kind: 'auskunft_export', file: dateiname },
    })
    expect(timelineText(aktivitaet({ type: 'notiz', metadata: { kind: 'auskunft_export' } }))).toBe(
      'Auskunft exportiert (JSON)',
    )
  })
})
