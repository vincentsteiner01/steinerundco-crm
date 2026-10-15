// Shell-Korrekturen aus dem Review: Esc in einem Feld schließt den Peek nicht (eine Ebene je Druck, ux § 5.1), „Mehr“ in der
// Tab-Leiste öffnet Pipeline · E-Mail · Leitfäden · Schnellimport · Einstellungen (ux § 7.1), Skip-Link (BAUPLAN § 10.3 A-03).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { supabaseMock } from '@/test/supabaseMock'

vi.mock('@/data/supabase', () => supabaseMock())
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
      member: { user_id: 'u1', email: 'test@example.com', display_name: 'Test' },
      abmelden: async () => {},
    }),
}))

import { AppShell } from './AppShell'
import { GlobaleTasten } from './GlobaleTasten'
import { TabLeiste } from './TabLeiste'

function Ort() {
  const l = useLocation()
  return <output data-testid="ort">{`${l.pathname}${l.search}`}</output>
}

function mitRouter(element: ReactNode, start: string) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [start] })
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

describe('Shell', () => {
  beforeEach(() => {
    useUiStore.setState({ paletteOffen: false, hilfeOffen: false, hotkeyScope: 'global', scopeStack: [] })
    _akkordZuruecksetzen()
  })

  it('Esc in einem Eingabefeld verlässt nur das Feld – der Peek (?lead=) bleibt; das nächste Esc schließt ihn', () => {
    mitRouter(
      <>
        <GlobaleTasten />
        <input aria-label="Notiz" />
        <Ort />
      </>,
      '/leads?lead=l1',
    )
    const feld = screen.getByLabelText('Notiz')
    feld.focus()
    fireEvent.keyDown(feld, { key: 'Escape' })
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=l1')
    expect(document.activeElement).not.toBe(feld)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
  })

  it('Tab-Leiste: „Mehr“ öffnet ein Menü mit Pipeline · E-Mail · Leitfäden · Schnellimport · Einstellungen', () => {
    const router = mitRouter(
      <>
        <TabLeiste />
        <Ort />
      </>,
      '/heute',
    )
    const mehr = screen.getByRole('button', { name: 'Mehr' })
    expect(mehr).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(mehr)
    const menu = screen.getByRole('menu', { name: 'Mehr' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Pipeline', 'E-Mail', 'Leitfäden', 'Schnellimport', 'Einstellungen'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Leitfäden' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leitfaeden')
    expect(screen.queryByRole('menu')).toBeNull()
    // aktiv auf einer Mehr-Route
    expect(screen.getByRole('button', { name: 'Mehr' })).toHaveAttribute('aria-current', 'page')
    act(() => void router.navigate('/heute'))
    expect(screen.getByRole('button', { name: 'Mehr' })).not.toHaveAttribute('aria-current')
    // Esc schließt das Menü und gibt den Fokus zurück
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mehr' }))
  })

  it('Skip-Link „Zum Inhalt“ ist das erste fokussierbare Element und zeigt auf #main', () => {
    mitRouter(<AppShell />, '/heute')
    const link = screen.getByRole('link', { name: 'Zum Inhalt' })
    expect(link).toHaveAttribute('href', '#main')
    const fokussierbar = document.querySelectorAll('a[href], button, input, select, textarea')
    expect(fokussierbar[0]).toBe(link)
    expect(document.getElementById('main')).toHaveAttribute('tabindex', '-1')
  })
})
