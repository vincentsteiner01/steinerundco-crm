// CommandPalette: öffnet (⌘K / Store), filtert, navigiert (BAUPLAN § 3.1.12)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { supabaseMock } from '@/test/supabaseMock'

vi.mock('@/data/supabase', () => supabaseMock())
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (
    sel: (s: { status: string; member: { user_id: string; email: string; display_name: string } }) => unknown,
  ) => sel({ status: 'mitglied', member: { user_id: 'u1', email: 'test@example.com', display_name: 'Test' } }),
}))

import { supabase } from '@/data/supabase'
import { CommandPalette, PALETTE_VERLAUF } from './CommandPalette'
import { GlobaleTasten } from './GlobaleTasten'

function rendern() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <GlobaleTasten />
            <CommandPalette />
            <p>START</p>
          </>
        ),
      },
      { path: '/pipeline', element: <p>PIPELINE</p> },
      { path: '/leads/neu', element: <p>LEAD NEU</p> },
    ],
    { initialEntries: ['/'] },
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('CommandPalette', () => {
  beforeEach(() => {
    useUiStore.setState({ paletteOffen: false, hilfeOffen: false, hotkeyScope: 'global', scopeStack: [] })
    localStorage.clear()
  })

  it('öffnet per ⌘K und zeigt Gruppen', async () => {
    rendern()
    expect(screen.queryByPlaceholderText(/Lead, Aktion/)).not.toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true })
    await waitFor(() => expect(screen.getByPlaceholderText(/Lead, Aktion/)).toBeInTheDocument())
    expect(screen.getByText('Aktionen')).toBeInTheDocument()
    expect(screen.getByText('Seiten')).toBeInTheDocument()
    expect(screen.getByText('Lead anlegen')).toBeInTheDocument()
  })

  it('filtert nach Text und Präfix >', async () => {
    rendern()
    useUiStore.getState().setPaletteOffen(true)
    const eingabe = await screen.findByPlaceholderText(/Lead, Aktion/)
    fireEvent.change(eingabe, { target: { value: 'pipe' } })
    await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument())
    expect(screen.queryByText('Lead anlegen')).not.toBeInTheDocument()
    fireEvent.change(eingabe, { target: { value: '>' } })
    await waitFor(() => expect(screen.getByText('Lead anlegen')).toBeInTheDocument())
    expect(screen.queryByText('Seiten')).not.toBeInTheDocument()
  })

  it('Enter navigiert und merkt den Befehl', async () => {
    const router = rendern()
    useUiStore.getState().setPaletteOffen(true)
    const eingabe = await screen.findByPlaceholderText(/Lead, Aktion/)
    fireEvent.change(eingabe, { target: { value: 'Pipeline' } })
    await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Pipeline'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/pipeline'))
    expect(useUiStore.getState().paletteOffen).toBe(false)
    expect(JSON.parse(localStorage.getItem('crm.palette.zuletzt') ?? '[]')).toContain('seite:/pipeline')
  })

  it('Esc schließt, ⌥N navigiert zu /leads/neu', async () => {
    const router = rendern()
    useUiStore.getState().setPaletteOffen(true)
    await screen.findByPlaceholderText(/Lead, Aktion/)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(useUiStore.getState().paletteOffen).toBe(false))
    fireEvent.keyDown(document.body, { key: 'Dead', code: 'KeyN', altKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/leads/neu'))
  })

  it('Runde 2: solange die Lead-Suche läuft „Suche …“ statt „Nichts gefunden.“', async () => {
    const orig = vi.mocked(supabase.from).getMockImplementation()
    const haengt: Record<string, unknown> = {}
    for (const m of ['select', 'is', 'or', 'order', 'limit', 'eq', 'in', 'not', 'neq', 'maybeSingle', 'single'])
      haengt[m] = () => haengt
    haengt['then'] = () => new Promise(() => {})
    vi.mocked(supabase.from).mockImplementation(() => haengt as never)
    try {
      rendern()
      useUiStore.getState().setPaletteOffen(true)
      const eingabe = await screen.findByPlaceholderText(/Lead, Aktion/)
      fireEvent.change(eingabe, { target: { value: 'qqxx' } })
      expect(await screen.findByText('Suche …')).toBeInTheDocument()
      expect(screen.queryByText('Nichts gefunden.')).toBeNull()
    } finally {
      if (orig) vi.mocked(supabase.from).mockImplementation(orig)
    }
  })

  describe('Runde 3: Telefon (Vollbild, kein Esc)', () => {
    const vorher = window.matchMedia
    beforeEach(() => {
      window.matchMedia = ((q: string) => ({
        matches: q.includes('767'),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
      window.history.replaceState(null, '')
    })
    afterEach(() => {
      window.matchMedia = vorher
    })

    it('zeigt „Abbrechen“ statt der Esc-Taste; Klick schließt und räumt den Verlaufseintrag wieder ab', async () => {
      rendern()
      useUiStore.getState().setPaletteOffen(true)
      await screen.findByPlaceholderText(/Lead, Aktion/)
      expect(screen.queryByText('Esc')).toBeNull()
      expect((window.history.state as Record<string, unknown> | null)?.[PALETTE_VERLAUF]).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
      expect(useUiStore.getState().paletteOffen).toBe(false)
      await waitFor(() =>
        expect((window.history.state as Record<string, unknown> | null)?.[PALETTE_VERLAUF]).toBeUndefined(),
      )
    })

    it('„Zurück“ des Browsers schließt die Palette, die Seite bleibt', async () => {
      const router = rendern()
      useUiStore.getState().setPaletteOffen(true)
      await screen.findByPlaceholderText(/Lead, Aktion/)
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      })
      expect(useUiStore.getState().paletteOffen).toBe(false)
      expect(router.state.location.pathname).toBe('/')
    })

    it('ein Befehl mit Navigation läuft erst nach dem Entfernen des Verlaufseintrags', async () => {
      const router = rendern()
      useUiStore.getState().setPaletteOffen(true)
      const eingabe = await screen.findByPlaceholderText(/Lead, Aktion/)
      fireEvent.change(eingabe, { target: { value: 'Pipeline' } })
      await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Pipeline'))
      expect(useUiStore.getState().paletteOffen).toBe(false)
      await waitFor(() => expect(router.state.location.pathname).toBe('/pipeline'))
      expect((window.history.state as Record<string, unknown> | null)?.[PALETTE_VERLAUF]).toBeUndefined()
    })
  })
})
