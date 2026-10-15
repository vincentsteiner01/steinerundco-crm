// Eingang-Liste: Standardfilter „Offen“, Filter Person/Status über die URL, Zuordnen (Lead-Suche → eingang_zuordnen) und
// Ignorieren (eingang_ignorieren), Realtime-Kanal crm:eingang lädt neu; Badge zeigt offene Einträge und verlinkt den Eingang.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseEingang())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast, toastFehler } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import type { KanalMock } from '@/test/supabaseMock'
import { EingangBadge, EINGANG_PFAD } from './EingangBadge'
import { EingangListe } from './EingangListe'
import { LEAD_A, MEMBER_M, MEMBER_V, ZEILEN, zustand } from './_testDaten'

function rendern(ui: ReactElement, start = '/einstellungen/verbindungen?tab=eingang') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [start] })
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { router, qc }
}

const rpc = () => vi.mocked(supabase.rpc)
const kanaele = () => (supabase as unknown as { __kanaele: KanalMock[] }).__kanaele

describe('EingangListe', () => {
  beforeEach(() => {
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    zustand.zeilen = ZEILEN
    zustand.offen = 2
    rpc().mockReset()
    vi.mocked(toast).mockClear()
    vi.mocked(toastFehler).mockClear()
  })

  it('zeigt standardmäßig die offenen Einträge beider Postfächer mit Status-Chip, Art und Text', async () => {
    rendern(<EingangListe />)
    const liste = await screen.findByRole('list', { name: 'Eingang' })
    const eintraege = within(liste).getAllByRole('listitem')
    expect(eintraege).toHaveLength(2)
    expect(eintraege[0]).toHaveAttribute('data-status', 'unbekannt')
    expect(within(eintraege[0]!).getByText('Bernd Testmann')).toBeInTheDocument()
    expect(within(eintraege[0]!).getByText('Nachricht')).toBeInTheDocument()
    expect(within(eintraege[0]!).getByText('linkedin.com/in/bernd-testmann-123')).toBeInTheDocument()
    expect(within(eintraege[0]!).getByText('‚Danke für die Nachricht, klingt spannend.‘')).toBeInTheDocument()
    expect(eintraege[1]).toHaveAttribute('data-status', 'fehler')
    expect(within(eintraege[1]!).getByText('Firma gesperrt')).toHaveClass('text-danger')
    // Filter-Chips mit Zählern
    expect(screen.getByRole('button', { name: /Offen 2/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Alle 4/ })).toBeInTheDocument()
  })

  it('Filter Person und Status stehen in der URL', async () => {
    const { router } = rendern(<EingangListe />)
    await screen.findByRole('list', { name: 'Eingang' })
    fireEvent.click(within(screen.getByRole('group', { name: 'Postfach' })).getByRole('button', { name: 'Mike' }))
    await waitFor(() => expect(router.state.location.search).toContain('person=mike'))
    expect(within(screen.getByRole('list', { name: 'Eingang' })).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Alle 2/ }))
    await waitFor(() => expect(router.state.location.search).toContain('status=alle'))
    const alle = within(screen.getByRole('list', { name: 'Eingang' })).getAllByRole('listitem')
    expect(alle.map((e) => e.getAttribute('data-status'))).toEqual(['fehler', 'ignoriert'])
    // abgeschlossene Einträge haben keine Aktionen
    expect(within(alle[1]!).queryByRole('button', { name: 'Ignorieren' })).not.toBeInTheDocument()
  })

  it('Lead zuordnen: Suche ist mit dem Absender vorbelegt, Zuordnen ruft eingang_zuordnen und zeigt das Ergebnis', async () => {
    rpc().mockResolvedValue({
      data: {
        id: 'e-unbekannt',
        status: 'verarbeitet',
        ergebnis: 'Antwort verbucht – Sequenz gestoppt',
        lead_id: LEAD_A.id,
      },
      error: null,
    } as never)
    rendern(<EingangListe />)
    const liste = await screen.findByRole('list', { name: 'Eingang' })
    const erster = within(liste).getAllByRole('listitem')[0]!
    fireEvent.click(within(erster).getByRole('button', { name: 'Lead zuordnen' }))
    const gruppe = within(erster).getByRole('group', { name: 'Lead zuordnen' })
    expect(within(gruppe).getByLabelText('Lead suchen')).toHaveValue('Bernd Testmann')
    expect(within(gruppe).getByText(/im Namen von Vincent: Antwort erhalten mit diesem Text/)).toBeInTheDocument()
    fireEvent.click(await within(gruppe).findByRole('button', { name: `${LEAD_A.full_name} zuordnen` }))
    await waitFor(() =>
      expect(rpc()).toHaveBeenCalledWith('eingang_zuordnen', { p_id: 'e-unbekannt', p_lead_id: LEAD_A.id }),
    )
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Antwort verbucht – Sequenz gestoppt.'))
  })

  it('Zuordnen mit Fehler-Ergebnis zeigt den Fehler statt einer Erfolgsmeldung', async () => {
    rpc().mockResolvedValue({
      data: { id: 'e-unbekannt', status: 'fehler', ergebnis: 'Firma gesperrt', lead_id: LEAD_A.id },
      error: null,
    } as never)
    rendern(<EingangListe />)
    const erster = within(await screen.findByRole('list', { name: 'Eingang' })).getAllByRole('listitem')[0]!
    fireEvent.click(within(erster).getByRole('button', { name: 'Lead zuordnen' }))
    fireEvent.click(await within(erster).findByRole('button', { name: `${LEAD_A.full_name} zuordnen` }))
    await waitFor(() => expect(toastFehler).toHaveBeenCalledWith('Zugeordnet, aber nicht verbucht: Firma gesperrt'))
    expect(toast).not.toHaveBeenCalled()
  })

  it('Ignorieren ruft eingang_ignorieren', async () => {
    rpc().mockResolvedValue({ data: { id: 'e-fehler', status: 'ignoriert' }, error: null } as never)
    rendern(<EingangListe />)
    const zweiter = within(await screen.findByRole('list', { name: 'Eingang' })).getAllByRole('listitem')[1]!
    fireEvent.click(within(zweiter).getByRole('button', { name: 'Ignorieren' }))
    await waitFor(() => expect(rpc()).toHaveBeenCalledWith('eingang_ignorieren', { p_id: 'e-fehler' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Ignoriert – ohne Eintrag im CRM.'))
  })

  it('Realtime: ein Ereignis auf crm.eingang lädt die Liste neu', async () => {
    rendern(<EingangListe />)
    await screen.findByRole('list', { name: 'Eingang' })
    const k = kanaele().find((x) => x.name === 'crm:eingang')
    expect(k?.handler[0]?.filter).toEqual({ event: '*', schema: 'crm', table: 'eingang' })
    zustand.zeilen = [
      {
        ...ZEILEN[0]!,
        id: 'e-neu',
        absender_name: 'Dora Neu',
        empfangen_at: '2026-10-15T11:00:00Z',
      },
      ...ZEILEN,
    ]
    k?.handler[0]?.cb({ eventType: 'INSERT', new: { id: 'e-neu' } })
    expect(await screen.findByText('Dora Neu')).toBeInTheDocument()
  })

  it('leerer Eingang: ruhiger Leerzustand', async () => {
    zustand.zeilen = []
    rendern(<EingangListe />)
    expect(await screen.findByText('Nichts zuzuordnen.')).toBeInTheDocument()
  })
})

describe('EingangBadge', () => {
  beforeEach(() => {
    zustand.zeilen = ZEILEN
  })

  it('zeigt die offenen Einträge und verlinkt den Eingang', async () => {
    zustand.offen = 3
    rendern(<EingangBadge />, '/heute')
    const link = await screen.findByRole('link', { name: '3 LinkedIn-Mails warten im Eingang' })
    expect(link).toHaveAttribute('href', EINGANG_PFAD)
    expect(link).toHaveTextContent('Eingang3zuordnen')
  })

  it('rendert bei 0 nichts', async () => {
    zustand.offen = 0
    rendern(<EingangBadge kompakt />, '/heute')
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('eingang'))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(MEMBER_M).toBeTruthy()
  })
})
