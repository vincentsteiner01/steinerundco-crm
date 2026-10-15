// EinstellungenSeite: Bereich aus der Route, unbekannter Bereich → Profil, Unternavigation mit Kbd, Tasten 1–7, Befehle/Tasten-Verträge.
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
import { VERBOTEN, normalisiere } from '@/lib/keyboard'
import { useAuth } from '@/features/auth/authStore'
import { Component as EinstellungenSeite } from './EinstellungenSeite'
import { EINGANG_PFAD } from '@/features/eingang/public'
import { BEFEHLE } from './befehle'
import { BEREICHE } from './bereiche'
import { TASTEN } from './tasten'
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

  it('rendert Seitenkopf, Unternavigation (7 Einträge, 34 px, Kbd) und den Bereich aus der Route', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/ziele')
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Einstellungen' })
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(7)
    expect(links[6]).toHaveAttribute('href', '/einstellungen/verbindungen')
    expect(links[2]).toHaveAttribute('aria-current', 'page')
    expect(links[2]?.querySelector('kbd')).toHaveTextContent('3')
    expect(await screen.findByLabelText('Warnschwelle Budget')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Ziele' })).toBeInTheDocument()
  })

  it('unbekannter Bereich → Profil', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/phasen')
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/profil'))
    expect(await screen.findByLabelText('Anzeigename')).toBeInTheDocument()
  })

  it('Tasten 1–7 wechseln den Bereich, nicht in Eingabefeldern', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/profil')
    await screen.findByLabelText('Anzeigename')
    fireEvent.keyDown(document.body, { key: '5' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/sperrliste'))
    const suche = await screen.findByLabelText('Sperrliste durchsuchen')
    suche.focus()
    fireEvent.keyDown(suche, { key: '6' })
    expect(router.state.location.pathname).toBe('/einstellungen/sperrliste')
    suche.blur()
    fireEvent.keyDown(document.body, { key: '7' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/verbindungen'))
  })

  it('Mobil-Tabs tragen alle Bereiche und schalten um', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/profil')
    const tabs = screen.getByRole('tablist', { name: 'Einstellungen' })
    expect(tabs.querySelectorAll('[role=tab]')).toHaveLength(7)
    fireEvent.click(screen.getByRole('tab', { name: 'Export & Backup' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/export'))
  })

  it('Verträge: BEFEHLE (ein Backup-Befehl + ein Seitenbefehl je Bereich), TASTEN ohne verbotene Kombinationen', () => {
    expect(BEFEHLE.find((b) => b.id === 'einstellungen:backup-jetzt')?.gruppe).toBe('aktionen')
    for (const b of BEREICHE) {
      const befehl = BEFEHLE.find((x) => x.id === `einstellungen:${b.key}`)
      expect(befehl?.label).toBe(`Zu Einstellungen → ${b.label}`)
      expect(befehl?.gruppe).toBe('seiten')
    }
    const navigate = vi.fn()
    BEFEHLE[0]!.ausfuehren({ navigate, leadId: null, me: {} as never })
    expect(navigate).toHaveBeenCalledWith('/einstellungen/export?aktion=backup')
    // Runde 3: Palette „Eingang öffnen“ führt auf denselben Pfad wie der Eingang-Badge (Heute, Sidebar)
    BEFEHLE.find((b) => b.id === 'einstellungen:eingang')!.ausfuehren({ navigate, leadId: null, me: {} as never })
    expect(navigate).toHaveBeenLastCalledWith(EINGANG_PFAD)
    for (const g of TASTEN)
      for (const e of g.eintraege)
        for (const t of e.tasten) expect(VERBOTEN).not.toContain(normalisiere(t.toLowerCase()))
  })
})
