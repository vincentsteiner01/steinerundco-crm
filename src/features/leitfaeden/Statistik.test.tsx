// Statistik (LF-06): Zahlen aus v_template_performance, Ø Zeit bis Antwort und 8-Wochen-Balken aus den Aktivitäten,
// Fallback auf die Client-Rechnung ohne View-Zeile, Skeleton beim Laden.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActivityZeitraum } from '@/data/activities'

const daten = vi.hoisted(() => ({ wert: { data: undefined as unknown, isPending: true } }))
vi.mock('@/data/activities', async (original) => ({
  ...(await original<typeof import('@/data/activities')>()),
  useTemplateActivities: () => daten.wert,
}))

import { PERF } from './_testHilfe'
import { Statistik } from './Statistik'

const heute = new Date().toISOString()
const vorTagen = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const akt = (p: Partial<ActivityZeitraum> & { lead_id: string; occurred_at: string }): ActivityZeitraum => ({
  id: 1,
  member_id: null,
  channel: 'linkedin',
  type: 'nachricht_gesendet',
  template_id: 't',
  outcome: null,
  reply_label: null,
  enrollment_id: null,
  step_id: null,
  ...p,
})

describe('Statistik', () => {
  it('lädt: Skeleton ohne View-Zeile', () => {
    daten.wert = { data: undefined, isPending: true }
    render(<Statistik templateId="t" perf={null} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('zeigt gesendet · Antworten 7 T · Quote aus der View, Ø aus Aktivitäten, acht Balken (letzter Lime)', () => {
    daten.wert = {
      isPending: false,
      data: {
        sendungen: [akt({ lead_id: 'a', occurred_at: vorTagen(3) }), akt({ lead_id: 'b', occurred_at: vorTagen(20) })],
        antworten: [akt({ lead_id: 'a', occurred_at: vorTagen(1), type: 'nachricht_erhalten' })],
      },
    }
    render(<Statistik templateId="t" perf={PERF[0]} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('gesendet')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/^25\s%$/)).toBeInTheDocument()
    expect(screen.getByText('2,0 T')).toBeInTheDocument()
    expect(screen.getByText(/^zuletzt/)).toBeInTheDocument()
    const svg = screen.getByRole('img', { name: /Sendungen je Woche, 8 Wochen/ })
    const balken = svg.querySelectorAll('rect')
    expect(balken).toHaveLength(8)
    expect(balken[7]).toHaveAttribute('data-wert', '1')
    expect(balken[7]).toHaveClass('text-signal')
    expect(balken[5]?.getAttribute('data-wert')).toBe('1')
    expect(Number(balken[7]?.getAttribute('height'))).toBe(24)
  })

  it('ohne View-Zeile rechnet der Client: 2 gesendet · 1 Antwort · 50 %', () => {
    daten.wert = {
      isPending: false,
      data: {
        sendungen: [akt({ lead_id: 'a', occurred_at: vorTagen(3) }), akt({ lead_id: 'b', occurred_at: heute })],
        antworten: [akt({ lead_id: 'a', occurred_at: vorTagen(2), type: 'nachricht_erhalten' })],
      },
    }
    render(<Statistik templateId="t" perf={null} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/^50\s%$/)).toBeInTheDocument()
    expect(screen.getByText('1,0 T')).toBeInTheDocument()
    expect(screen.queryByText(/^zuletzt/)).not.toBeInTheDocument()
  })
})
