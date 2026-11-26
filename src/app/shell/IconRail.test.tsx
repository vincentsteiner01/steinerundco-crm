// Runde 2 (900 px): Im Icon-Rail trug JEDER Eintrag den Aktiv-Balken – der Tooltip-Trigger (Radix Slot) verkettete die
// className-Funktion von NavLink als Text. Nur der aktive Eintrag darf die Aktiv-Klassen tragen.
// Neustart 25.11.2026: E-Mail als eine Ikone für alle E-Mail-Seiten, unten nur Person und „Abmelden“. Seit 26.11.2026 sieben
// Ikonen – KPIs steht nach E-Mail.
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'

vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { member: null; abmelden: () => Promise<void> }) => unknown) =>
    sel({ member: null, abmelden: async () => {} }),
}))

import { IconRail } from './IconRail'

function rendern(start: string) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <TooltipProvider>
            <IconRail />
          </TooltipProvider>
        ),
      },
    ],
    { initialEntries: [start] },
  )
  render(<RouterProvider router={router} />)
}

describe('IconRail', () => {
  it('nur der aktive Eintrag ist markiert; kein Funktions-Quelltext in className', () => {
    rendern('/leads')
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Leads', 'Leitfäden', 'E-Mail', 'KPIs', 'Team', 'Einstellungen', 'Hilfe'])
    expect(within(nav).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Leitfäden' })).not.toHaveAttribute('aria-current')
    for (const a of screen.getAllByRole('link')) {
      expect(a.className).not.toMatch(/isActive|=>/)
      // Aktiv-Balken nur über die aria-current-Variante, nie als unbedingte Klasse
      expect(a.className.split(/\s+/)).not.toContain('before:bg-signal')
    }
  })

  it('E-Mail ist auf jeder E-Mail-Seite die aktive Ikone und führt zu den Kampagnen', () => {
    rendern('/email/antworten')
    const email = screen.getByRole('link', { name: 'E-Mail' })
    expect(email).toHaveAttribute('href', '/email/kampagnen')
    expect(email).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Leads' })).not.toHaveAttribute('aria-current')
  })

  it('KPIs ist auf /kpis die aktive Ikone', () => {
    rendern('/kpis')
    const kpis = screen.getByRole('link', { name: 'KPIs' })
    expect(kpis).toHaveAttribute('href', '/kpis')
    expect(kpis).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'E-Mail' })).not.toHaveAttribute('aria-current')
  })

  it('sonst nichts: keine Suche, kein Feedback – nur „Abmelden“ als Knopf', () => {
    rendern('/leads')
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Abmelden'])
  })
})
