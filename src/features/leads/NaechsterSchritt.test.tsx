// NaechsterSchritt (Peek/Detail): „Anrufen“ aus der Mini-Queue-Karte nur mit offenem Telefon-Gate (§ 8.2 Nr. 2, Review).
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queueItem } from '@/test/fixtures/queue'
import { leadMitBezug, rendern, zuruecksetzen } from './_testHilfe'
import { NaechsterSchritt } from './NaechsterSchritt'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
}))
vi.mock('@/features/heute/public', () => ({
  QueueKarte: (p: { onAktion: (a: string) => void }) => (
    <button type="button" onClick={() => p.onAktion('anrufen')}>
      Karte anrufen
    </button>
  ),
}))

import { toast } from '@/components/toast'

describe('NaechsterSchritt', () => {
  beforeEach(() => {
    zuruecksetzen()
    vi.mocked(toast).mockClear()
  })

  it('Anrufen ohne Anrufgrund: Grund als Toast, kein Anruf-Screen', async () => {
    const lead = leadMitBezug(1, { phone_e164: '+4940123456', call_basis: null })
    rendern(<NaechsterSchritt lead={lead} item={queueItem('heute', 1, { lead_id: lead.id })} />, { route: '/leads' })
    fireEvent.click(screen.getByRole('button', { name: 'Karte anrufen' }))
    expect(toast).toHaveBeenCalledWith('Nummer ohne Anrufgrund')
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads/)
  })

  it('Anrufen mit offenem Gate öffnet den Anruf-Screen', async () => {
    const lead = leadMitBezug(1, { phone_e164: '+4940123456', call_basis: 'linkedin_vernetzt' })
    rendern(<NaechsterSchritt lead={lead} item={queueItem('heute', 1, { lead_id: lead.id })} />, { route: '/leads' })
    fireEvent.click(screen.getByRole('button', { name: 'Karte anrufen' }))
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(`/telefon/anruf/${lead.id}`))
  })
})
