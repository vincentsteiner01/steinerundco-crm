// Zusammenspiel nach dem Neustart (25.11.2026): echter Router, echte Hülle, echtes Board, echtes Lead-Blatt und die echte
// Leitfäden-Seite – gemockt sind nur die Daten (@/data/board, supabase) und die Anmeldung. Geprüft werden die Verträge zwischen
// den Teilen: /leads → Board, /leitfaeden → Leitfäden, Klick auf eine Karte setzt `?lead=`, die Hülle öffnet darüber das
// Lead-Blatt (auf jeder Seite außer /email/verfassen), Schließen entfernt nur diesen Parameter. Nur erfundene Namen.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardKarte } from '@/data/board'

const m = vi.hoisted(() => ({
  karten: [] as unknown[],
  lead: null as unknown,
  members: [] as unknown[],
  verschieben: vi.fn(),
  speichern: vi.fn(),
}))

vi.mock('@/data/supabase', async () =>
  (await import('@/test/supabaseMock')).supabaseMock((tabelle) =>
    tabelle === 'leads'
      ? { data: m.lead, error: null }
      : tabelle === 'members'
        ? { data: m.members, error: null }
        : { data: [], error: null },
  ),
)
vi.mock('@/data/board', () => ({
  useBoardKarten: () => ({ data: m.karten, isPending: false, isError: false, refetch: vi.fn() }),
  useKarteVerschieben: () => ({ mutateAsync: m.verschieben }),
  useKarteAnlegen: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useKarteSpeichern: () => ({ mutate: m.speichern, isPending: false }),
}))
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (
    sel: (s: {
      status: string
      member: { user_id: string; email: string; display_name: string }
      abmelden: () => Promise<void>
    }) => unknown,
  ) =>
    sel({
      status: 'mitglied',
      member: {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'vincent@beispiel.test',
        display_name: 'Vincent',
      },
      abmelden: async () => {},
    }),
}))
// Der Composer ist ein eigenes Sheet mit eigenem `?lead=` – hier zählt nur, dass die Hülle dort KEIN Lead-Blatt öffnet
vi.mock('@/features/email/VerfassenSeite', () => ({ Component: () => <h1>Composer</h1> }))

import { useUiStore } from '@/app/uiStore'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { PFADE, ROUTEN } from './router'

const LEAD = vollerLead(1, {
  first_name: 'Petra',
  last_name: 'Probelauf',
  full_name: 'Petra Probelauf',
  salutation: 'frau',
  company_id: null,
  company_name: 'Muster Solar GmbH',
  linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
  owner_id: MEMBER_V,
  email: null,
  board_liste: 'angeschrieben',
  board_seit: '2026-11-25T09:00:00+00:00',
})

const KARTE: BoardKarte = {
  id: LEAD.id,
  salutation: 'frau',
  first_name: 'Petra',
  last_name: 'Probelauf',
  full_name: 'Petra Probelauf',
  company_name: 'Muster Solar GmbH',
  linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
  owner_id: MEMBER_V,
  board_liste: 'angeschrieben',
  board_seit: '2026-11-25T09:00:00+00:00',
}

function starten(start: string) {
  const router = createMemoryRouter(ROUTEN, { initialEntries: [start] })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return router
}

const ort = (router: ReturnType<typeof starten>) => router.state.location.pathname + router.state.location.search
const blatt = () => screen.findByRole('dialog', { name: 'Petra Probelauf' })
// jsdom kennt keine Breakpoints: Sidebar und Icon-Rail stehen beide im Dokument – die Sidebar zuerst
const hauptnavigation = () => within(screen.getAllByRole('navigation', { name: 'Hauptnavigation' })[0] as HTMLElement)

beforeEach(() => {
  m.karten = [KARTE]
  m.lead = LEAD
  m.members = [
    { id: MEMBER_M, display_name: 'Mike', short_name: 'Mike', email: 'mike@beispiel.test' },
    { id: MEMBER_V, display_name: 'Vincent', short_name: 'Vincent', email: 'vincent@beispiel.test' },
  ]
  m.verschieben.mockReset().mockResolvedValue(null)
  m.speichern.mockReset()
  useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
  localStorage.clear()
})

describe('Zusammenspiel: Router, Hülle, Board, Lead-Blatt, Leitfäden', () => {
  it('Start → Board in der Hülle; Klick auf die Karte öffnet das Lead-Blatt über ?lead=, „Abbrechen“ entfernt den Parameter', async () => {
    const router = starten('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument()
    expect(ort(router)).toBe('/leads')
    expect(hauptnavigation().getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('region').map((r) => within(r).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Angeschrieben',
      'Gespräch vereinbart',
      'Im Geschäft',
      'Verloren',
    ])
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Petra Probelauf' }))
    expect(ort(router)).toBe(`/leads?lead=${LEAD.id}`)
    const dialog = await blatt()
    // das echte Blatt mit den Daten des Leads – nicht nur ein Rahmen
    expect(await within(dialog).findByLabelText('Vorname')).toHaveValue('Petra')
    expect(within(dialog).getByLabelText('Firma')).toHaveValue('Muster Solar GmbH')
    expect(within(dialog).getByRole('button', { name: 'Erlaubnis erfassen' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'E-Mail schreiben' })).toHaveAttribute(
      'href',
      `/email/verfassen?lead=${LEAD.id}&zurueck=${encodeURIComponent(`/leads?lead=${LEAD.id}`)}`,
    )
    // solange das Blatt offen ist, ruhen die Tasten der Seite dahinter
    expect(useUiStore.getState().hotkeyScope).toBe('formular')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ort(router)).toBe('/leads')
    expect(useUiStore.getState().hotkeyScope).toBe('global')
    expect(m.speichern).not.toHaveBeenCalled()
  })

  it('PFADE.lead(id) und die alte Adresse /leads/:id öffnen dasselbe Blatt über dem Board; „Schließen“ führt aufs Board', async () => {
    expect(PFADE.lead(LEAD.id)).toBe(`/leads?lead=${LEAD.id}`)
    const router = starten(`/leads/${LEAD.id}`)
    const dialog = await blatt()
    expect(ort(router)).toBe(PFADE.lead(LEAD.id))
    fireEvent.click(within(dialog).getByRole('button', { name: /Schließen/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ort(router)).toBe('/leads')
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument()

    await act(() => router.navigate(PFADE.lead(LEAD.id)))
    expect(await blatt()).toBeInTheDocument()
  })

  it('Knopf auf der Karte verschiebt, ohne das Blatt zu öffnen', async () => {
    const router = starten('/leads')
    fireEvent.click(await screen.findByRole('button', { name: 'Hat Interesse' }))
    expect(m.verschieben).toHaveBeenCalledWith({ id: LEAD.id, liste: 'gespraech' })
    expect(ort(router)).toBe('/leads')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('/leitfaeden zeigt die Leitfäden-Seite; ?lead= öffnet das Blatt auch dort und bleibt beim Schließen auf der Seite', async () => {
    const router = starten('/leads')
    await screen.findByRole('heading', { level: 1, name: 'Leads' })
    fireEvent.click(hauptnavigation().getByRole('link', { name: 'Leitfäden' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Leitfaden schreiben' })).toBeInTheDocument()
    expect(ort(router)).toBe('/leitfaeden')
    expect(hauptnavigation().getByRole('link', { name: 'Leitfäden' })).toHaveAttribute('aria-current', 'page')

    await act(() => router.navigate(`/leitfaeden?lead=${LEAD.id}`))
    const dialog = await blatt()
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ort(router)).toBe('/leitfaeden')
    expect(screen.getByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
  })

  it('/email/verfassen: ?lead= gehört dem Composer – die Hülle öffnet dort kein Lead-Blatt', async () => {
    const router = starten(`/email/verfassen?lead=${LEAD.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Composer' })).toBeInTheDocument()
    // dem Lazy-Import Zeit geben: es darf auch danach kein Blatt erscheinen
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(ort(router)).toBe(`/email/verfassen?lead=${LEAD.id}`)
    expect(useUiStore.getState().hotkeyScope).toBe('global')
  })
})
