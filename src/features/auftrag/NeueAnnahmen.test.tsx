// „Neue Annahmen eintragen“ (16.10.2026): Verbindungsabbruch mitten in den Annahmen → Wiederholung, klares Ergebnis,
// Liste bleibt im Feld; ohne Fehler wird das Feld geleert.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/rpc', async (orig) => {
  const m = await orig<typeof import('@/data/rpc')>()
  return { ...m, rpc: { ...m.rpc, importLeads: vi.fn(), markAccepted: vi.fn(), logRequest: vi.fn() } }
})
vi.mock('@/data/connections', async (orig) => ({
  ...(await orig<typeof import('@/data/connections')>()),
  ladeVerbundeneLeads: vi.fn(),
}))
vi.mock('@/data/leads', async (orig) => ({ ...(await orig<typeof import('@/data/leads')>()), ladeLeadSeite: vi.fn() }))
vi.mock('@/data/errors', async (orig) => ({ ...(await orig<typeof import('@/data/errors')>()), zeigeFehler: vi.fn() }))
vi.mock('@/data/wiederholen', async (orig) => {
  const m = await orig<typeof import('@/data/wiederholen')>()
  return { ...m, mitWiederholung: <T,>(fn: () => Promise<T>) => m.mitWiederholung(fn, { warte: async () => {} }) }
})

import { ladeVerbundeneLeads } from '@/data/connections'
import { zeigeFehler } from '@/data/errors'
import { ladeLeadSeite } from '@/data/leads'
import { rpc } from '@/data/rpc'
import { NeueAnnahmen } from './NeueAnnahmen'

const ME = '00000000-0000-4000-8000-000000000001'
const TEXT = [
  'Herr Max Beispiel | Beispiel Solar GmbH | https://www.linkedin.com/in/max-beispiel',
  'Frau Anna Muster | Muster Energie | https://www.linkedin.com/in/anna-muster',
  'Herr Paul Probe | Probe PV | https://www.linkedin.com/in/paul-probe',
].join('\n')

function rendern(art: 'annahme' | 'anfrage' = 'annahme') {
  const onFertig = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <NeueAnnahmen me={ME} onFertig={onFertig} art={art} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByLabelText(art === 'anfrage' ? /Neue Anfragen eintragen/ : /Neue Annahmen eintragen/), {
    target: { value: TEXT },
  })
  return { onFertig }
}

describe('NeueAnnahmen', () => {
  beforeEach(() => {
    vi.mocked(rpc.importLeads)
      .mockReset()
      .mockResolvedValue({
        batch_id: 'b1',
        rows: [
          { status: 'neu', name: 'Max Beispiel' },
          { status: 'neu', name: 'Anna Muster' },
          { status: 'duplikat', name: 'Paul Probe', existing_id: 'l9' },
        ],
      } as never)
    vi.mocked(ladeLeadSeite)
      .mockReset()
      .mockResolvedValue({ zeilen: [{ id: 'l1' }, { id: 'l2' }] } as never)
    vi.mocked(rpc.markAccepted).mockReset()
    vi.mocked(zeigeFehler).mockReset()
  })

  it('Verbindungsabbruch bei einer Annahme: wiederholt, meldet „1 Annahme nicht gespeichert“, Liste bleibt im Feld', async () => {
    vi.mocked(rpc.markAccepted).mockImplementation(async ({ leadId }) => {
      if (leadId === 'l2') throw new TypeError('Failed to fetch')
      return {} as never
    })
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('2 als angenommen eingetragen · 2 neu angelegt · 1 schon im CRM.')
    expect(status).toHaveTextContent('1 Annahme nicht gespeichert')
    // l2: erster Versuch + 2 Wiederholungen; l1 und l9 je einmal
    expect(vi.mocked(rpc.markAccepted).mock.calls.filter(([p]) => p.leadId === 'l2')).toHaveLength(3)
    expect(rpc.markAccepted).toHaveBeenCalledTimes(5)
    expect(zeigeFehler).toHaveBeenCalledTimes(1) // ein Toast, nicht einer je Lead
    expect(screen.getByLabelText(/Neue Annahmen eintragen/)).toHaveValue(TEXT)
  })

  it('ohne Fehler: alle angenommen, Feld geleert, Hinweis auf die Opener', async () => {
    vi.mocked(rpc.markAccepted).mockResolvedValue({} as never)
    const { onFertig } = rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('3 als angenommen eingetragen')
    expect(status).toHaveTextContent('Die Opener stehen jetzt unten unter „Opener senden“.')
    expect(status).not.toHaveTextContent('nicht gespeichert')
    await waitFor(() => expect(screen.getByLabelText(/Neue Annahmen eintragen/)).toHaveValue(''))
    expect(onFertig).toHaveBeenCalled()
  })

  it('Anfragen (23.10.2026): log_request je Person, bestehende Verbindungen übersprungen – nichts doppelt gezählt', async () => {
    vi.mocked(ladeVerbundeneLeads)
      .mockReset()
      .mockResolvedValue(new Set(['l9']))
    vi.mocked(rpc.logRequest)
      .mockReset()
      .mockResolvedValue({} as never)
    rendern('anfrage')
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      '2 als Anfrage eingetragen · 2 neu angelegt · 1 schon im CRM · 1 schon als Anfrage/Kontakt bekannt.',
    )
    expect(vi.mocked(rpc.logRequest).mock.calls.map(([p]) => p.leadId)).toEqual(['l1', 'l2'])
    expect(rpc.logRequest).toHaveBeenCalledWith(expect.objectContaining({ memberId: ME, noteVariant: 'ohne' }))
    expect(rpc.markAccepted).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText(/Neue Anfragen eintragen/)).toHaveValue(''))
  })
})
