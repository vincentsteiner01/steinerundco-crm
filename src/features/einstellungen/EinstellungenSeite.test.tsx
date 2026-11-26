// EinstellungenSeite (Neustart 25.11.2026): genau fünf Bereiche in fester Reihenfolge, schlichte Unternavigation ohne Ziffern
// und Tastenhinweise, entfallene Adressen (ziele, sequenzen, verbindungen) und unbekannte Bereiche leiten aufs Profil um.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { BEREICHE, istBereich } from './bereiche'
import { Component as EinstellungenSeite } from './EinstellungenSeite'
import { MEMBER_V, testZustandZuruecksetzen } from './_testDaten'
import { rendern } from './_testHilfe'

const FUENF = ['profil', 'passcode', 'sperrliste', 'feiertage', 'export']
const TITEL = ['Profil', 'Passcode', 'Sperrliste', 'Feiertage', 'Export & Backup']

describe('EinstellungenSeite', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    testZustandZuruecksetzen()
    Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: vi.fn() })
  })

  it('kennt genau fünf Bereiche: profil · passcode · sperrliste · feiertage · export', () => {
    expect(BEREICHE.map((b) => b.key)).toEqual(FUENF)
    expect(BEREICHE.map((b) => b.label)).toEqual(TITEL)
    for (const alt of ['ziele', 'sequenzen', 'verbindungen']) expect(istBereich(alt)).toBe(false)
    expect(PFADE.einstellungen()).toBe('/einstellungen/profil')
    expect(PFADE.einstellungen('feiertage')).toBe('/einstellungen/feiertage')
  })

  it('Unternavigation: fünf Links in dieser Reihenfolge, der aktive markiert – keine Ziffern, keine Tastenhinweise', async () => {
    const { container } = rendern(<EinstellungenSeite />, '/einstellungen/feiertage')
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Einstellungen' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(FUENF.map((b) => `/einstellungen/${b}`))
    // Der sichtbare Text ist nur der Titel – keine vorangestellte Ziffer, kein kbd
    expect(links.map((a) => a.textContent)).toEqual(TITEL)
    expect(links[3]).toHaveAttribute('aria-current', 'page')
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Feiertage' })).toBeInTheDocument()
    expect(await screen.findByText('An diesen Tagen sendet keine Kampagne.')).toBeInTheDocument()
    expect(container.querySelector('kbd')).toBeNull()
    // Es gibt nur diese eine Unternavigation (keine zweite Tab-Leiste für das Telefon)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it.each(FUENF.map((b, i) => [b, TITEL[i]!] as const))(
    'Bereich %s zeigt seine Überschrift und keine Tastenhinweise',
    async (bereich, titel) => {
      const { container, router } = rendern(<EinstellungenSeite />, `/einstellungen/${bereich}`)
      expect(await screen.findByRole('heading', { level: 2, name: titel })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe(`/einstellungen/${bereich}`)
      // Inhalt geladen (kein Ladebalken mehr), dann erst nach kbd suchen
      await waitFor(() => expect(screen.queryByRole('status', { name: 'Lade …' })).not.toBeInTheDocument())
      expect(container.querySelector('kbd')).toBeNull()
    },
  )

  it.each(['ziele', 'sequenzen', 'verbindungen', 'verbindungen?tab=eingang'])(
    'alte Adresse /einstellungen/%s leitet auf /einstellungen/profil um',
    async (alt) => {
      const { router } = rendern(<EinstellungenSeite />, `/einstellungen/${alt}`)
      await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/profil'))
      expect(router.state.location.search).toBe('')
      expect(await screen.findByLabelText('Kürzel')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Profil' })).toBeInTheDocument()
    },
  )

  it('unbekannter Bereich → Profil', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/phasen')
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/profil'))
    expect(await screen.findByLabelText('Kürzel')).toBeInTheDocument()
  })

  it('Klick in der Unternavigation wechselt den Bereich', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/profil')
    await screen.findByLabelText('Kürzel')
    fireEvent.click(screen.getByRole('link', { name: 'Export & Backup' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/export'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Export & Backup' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export & Backup' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current')
  })
})
