import { describe, expect, it } from 'vitest'
import type { Activity } from '@/types/domain'
import { protokollText } from './protokollText'

const wechsel = (metadata: Record<string, unknown>): Activity =>
  ({
    id: 'a1',
    type: 'stage_wechsel',
    channel: 'sonstiges',
    lead_id: 'l1',
    member_id: 'm1',
    occurred_at: '2026-10-15T09:42:00.000Z',
    metadata,
    note: null,
    outcome: null,
    template_id: null,
    enrollment_id: null,
    reply_label: null,
    source: 'app',
  }) as unknown as Activity

describe('protokollText (Runde 3: Phasen wie die Pipeline)', () => {
  it('Stufenwechsel nennt die Pipeline-Phase, die Feinstufe steht im Tooltip', () => {
    const r = protokollText(wechsel({ from: 'vernetzt', to: 'vernetzung_gesendet', via: 'pipeline' }))
    expect(r.text).toBe('Phase zurückgesetzt: Vernetzt → Angefragt (per Pipeline)')
    expect(r.text).not.toContain('Vernetzung gesendet')
    expect(r.titel).toContain('Feinstufe: Vernetzt → Vernetzung gesendet')
  })

  it('vorwärts über Phasen: „Phase geändert: Vernetzt → Eröffnet“', () => {
    expect(protokollText(wechsel({ from: 'vernetzt', to: 'gespraech_eroeffnet' })).text).toBe(
      'Phase geändert: Vernetzt → Eröffnet',
    )
  })

  it('innerhalb einer Phase kein „Angefragt → Angefragt“', () => {
    const r = protokollText(wechsel({ from: 'neu', to: 'vernetzung_gesendet' }))
    expect(r.text).toBe('Phase Angefragt (Vernetzung gesendet)')
    expect(r.titel).toContain('Feinstufe: Neu → Vernetzung gesendet')
  })

  it('Beendet und Wiedervorlage bleiben beim gemeinsamen Wortlaut', () => {
    expect(protokollText(wechsel({ from: 'pitch', to: 'beendet', ended_reason: 'kein_bedarf' })).text).toMatch(
      /^Beendet · /,
    )
    expect(protokollText(wechsel({ from: 'dm_beantwortet', to: 'langfristig' })).text).toBe('Wiedervorlage')
  })

  it('andere Aktivitäten: Text und Tooltip wie die Timeline', () => {
    const a = { ...wechsel({}), type: 'notiz' } as Activity
    expect(protokollText(a)).toEqual({ text: 'Notiz', titel: 'Notiz' })
  })
})
