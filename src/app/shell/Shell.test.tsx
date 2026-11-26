// Hülle nach dem Neustart (25.11.2026): Sidebar = Marke, acht Punkte (seit 26.11.2026 mit KPIs und Ziele), Person mit „Abmelden“
// – sonst nichts. Tab-Leiste mit fünf Spalten (Leads · Leitfäden · E-Mail · KPIs · Mehr; Ziele steht unter „Mehr“), globale Tasten
// nur noch Z, R, Esc. Dazu die Korrekturen aus dem Review: Esc in einem Feld schließt das Lead-Blatt nicht (eine Ebene je Druck,
// ux § 5.1), Skip-Link (BAUPLAN § 10.3 A-03).
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { hatFehlerToast, toastFehler } from '@/components/toast'
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
      member: { user_id: 'u1', email: 'test@example.com', display_name: 'Petra Probelauf' },
      abmelden: async () => {},
    }),
}))

import { AppShell } from './AppShell'
import { GlobaleTasten } from './GlobaleTasten'
import { Sidebar } from './Sidebar'
import { TabLeiste } from './TabLeiste'

function Ort() {
  const l = useLocation()
  return <output data-testid="ort">{`${l.pathname}${l.search}`}</output>
}

function mitRouter(element: ReactNode, start: string) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [start] })
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
  return router
}

describe('Shell', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    _akkordZuruecksetzen()
    localStorage.clear()
  })

  it('Esc in einem Eingabefeld verlässt das Feld; ?lead= fasst die Hülle nie an – das Lead-Blatt schließt sein Sheet selbst', () => {
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
    // auch das zweite Esc (kein Feld mehr im Fokus) lässt die Adresse stehen
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=l1')
  })

  it('Esc schließt den Fehler-Toast', () => {
    mitRouter(<GlobaleTasten />, '/leads')
    toastFehler('Nicht gespeichert.')
    expect(hatFehlerToast()).toBe(true)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(hatFehlerToast()).toBe(false)
  })

  it('Gehe-zu-Akkorde und ⌘K gibt es nicht mehr', () => {
    mitRouter(
      <>
        <GlobaleTasten />
        <Ort />
      </>,
      '/leitfaeden',
    )
    fireEvent.keyDown(document.body, { key: 'g' })
    fireEvent.keyDown(document.body, { key: 'l' })
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true })
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leitfaeden$/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Sidebar: Marke, acht Punkte (E-Mail aufgeklappt mit vier Unterpunkten, danach KPIs und Ziele), unten Person mit „Abmelden“ – sonst nichts', () => {
    mitRouter(<Sidebar />, '/leads')
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Leads', '/leads'],
      ['Leitfäden', '/leitfaeden'],
      ['Kampagnen', '/email/kampagnen'],
      ['Antworten', '/email/antworten'],
      ['Postfächer', '/email/postfaecher'],
      ['Einzelmails', '/email'],
      ['KPIs', '/kpis'],
      ['Ziele', '/ziele'],
      ['Team', '/team'],
      ['Einstellungen', '/einstellungen'],
      ['Hilfe', '/hilfe'],
    ])
    expect(within(nav).getByRole('button', { name: 'E-Mail' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(nav).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page')
    // außerhalb der Navigation: nur die Marke (führt zum Board) und „Abmelden“
    const leiste = screen.getByRole('complementary', { name: 'Seitenleiste' })
    expect(within(leiste).getAllByRole('button')).toHaveLength(2)
    expect(within(leiste).getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
    expect(within(leiste).getByText('Petra Probelauf')).toBeInTheDocument()
    expect(within(leiste).getAllByRole('link')[0]).toHaveAttribute('href', '/leads')
    expect(leiste.querySelector('kbd')).toBeNull()
    expect(within(leiste).queryByText(/Suchen|Feedback|Tastenkürzel|live/)).toBeNull()
  })

  it('Sidebar: E-Mail lässt sich zuklappen (gemerkt) – auf einer E-Mail-Seite bleibt die Gruppe offen', () => {
    const router = mitRouter(<Sidebar />, '/leads')
    const gruppe = () => screen.getByRole('button', { name: 'E-Mail' })
    fireEvent.click(gruppe())
    expect(gruppe()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Kampagnen' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('crm.nav.gruppen') ?? '{}')).toEqual({ email: false })
    act(() => void router.navigate('/email/kampagnen/42'))
    expect(gruppe()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Kampagnen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Einzelmails' })).not.toHaveAttribute('aria-current')
    // die Gruppe der offenen Seite lässt sich nicht zuklappen – sonst verschwände der markierte Punkt
    fireEvent.click(gruppe())
    expect(gruppe()).toHaveAttribute('aria-expanded', 'true')
  })

  it('Tab-Leiste: Leads · Leitfäden · E-Mail · KPIs · Mehr (fünf Spalten); „Mehr“ öffnet Ziele · Team · Einstellungen · Hilfe', () => {
    const router = mitRouter(
      <>
        <TabLeiste />
        <Ort />
      </>,
      '/leads',
    )
    const leiste = screen.getByRole('navigation', { name: 'Navigation' })
    expect(leiste.className.split(/\s+/)).toContain('grid-cols-5')
    expect(
      within(leiste)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Leads', 'Leitfäden', 'E-Mail', 'KPIs'])
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'KPIs' })).toHaveAttribute('href', '/kpis')
    const mehr = screen.getByRole('button', { name: 'Mehr' })
    expect(mehr).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(mehr)
    const menu = screen.getByRole('menu', { name: 'Mehr' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Ziele', 'Team', 'Einstellungen', 'Hilfe'])
    expect(within(menu).getByRole('menuitem', { name: 'Ziele' })).toHaveAttribute('href', '/ziele')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Team' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/team')
    expect(screen.queryByRole('menu')).toBeNull()
    // aktiv auf einer Mehr-Route
    expect(screen.getByRole('button', { name: 'Mehr' })).toHaveAttribute('aria-current', 'page')
    act(() => void router.navigate('/leads'))
    expect(screen.getByRole('button', { name: 'Mehr' })).not.toHaveAttribute('aria-current')
    // KPIs ist ein eigener Reiter, nicht unter „Mehr“
    act(() => void router.navigate('/kpis'))
    expect(screen.getByRole('link', { name: 'KPIs' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Leads' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Mehr' })).not.toHaveAttribute('aria-current')
    // Ziele liegt unter „Mehr“: kein eigener Reiter, auf /ziele ist „Mehr“ aktiv
    act(() => void router.navigate('/ziele'))
    expect(screen.getByRole('button', { name: 'Mehr' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'KPIs' })).not.toHaveAttribute('aria-current')
    expect(within(leiste).queryByRole('link', { name: 'Ziele' })).toBeNull()
    // Esc schließt das Menü und gibt den Fokus zurück
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mehr' }))
  })

  it('Tab-Leiste: der E-Mail-Tab ist auf allen /email-Seiten aktiv', () => {
    const router = mitRouter(<TabLeiste />, '/email/antworten')
    const email = () => screen.getByRole('link', { name: 'E-Mail' })
    expect(email()).toHaveAttribute('href', '/email/kampagnen')
    for (const pfad of ['/email/antworten', '/email', '/email/verfassen?lead=l1', '/email/kampagnen/42']) {
      act(() => void router.navigate(pfad))
      expect(email(), pfad).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Leads' })).not.toHaveAttribute('aria-current')
    }
    act(() => void router.navigate('/leitfaeden'))
    expect(email()).not.toHaveAttribute('aria-current')
  })

  it('Skip-Link „Zum Inhalt“ ist das erste fokussierbare Element und zeigt auf #main', () => {
    mitRouter(<AppShell />, '/leads')
    const link = screen.getByRole('link', { name: 'Zum Inhalt' })
    expect(link).toHaveAttribute('href', '#main')
    const fokussierbar = document.querySelectorAll('a[href], button, input, select, textarea')
    expect(fokussierbar[0]).toBe(link)
    expect(document.getElementById('main')).toHaveAttribute('tabindex', '-1')
  })
})
