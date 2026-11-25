// EinstellungenSeite: Bereich aus der Route, unbekannter Bereich → Profil, Unternavigation, Mobil-Tabs.
// Zifferntasten, Kbd-Hinweise und die Palette-/Tasten-Verträge sind mit dem Neustart (25.11.2026) entfallen.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { Component as EinstellungenSeite } from './EinstellungenSeite'
import { MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

describe('EinstellungenSeite', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
  })

  it('rendert Seitenkopf, Unternavigation (7 Einträge, 34 px) und den Bereich aus der Route', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/ziele')
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Einstellungen' })
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(7)
    expect(links[6]).toHaveAttribute('href', '/einstellungen/verbindungen')
    expect(links[2]).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByLabelText('Warnschwelle Budget')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Ziele' })).toBeInTheDocument()
  })

  it('unbekannter Bereich → Profil', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/phasen')
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/profil'))
    expect(await screen.findByLabelText('Anzeigename')).toBeInTheDocument()
  })

  it('Mobil-Tabs tragen alle Bereiche und schalten um', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/profil')
    const tabs = screen.getByRole('tablist', { name: 'Einstellungen' })
    expect(tabs.querySelectorAll('[role=tab]')).toHaveLength(7)
    fireEvent.click(screen.getByRole('tab', { name: 'Export & Backup' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/export'))
  })
})
