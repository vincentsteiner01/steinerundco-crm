// Runde 2 (900 px): Im Icon-Rail trug JEDER Eintrag den Lime-Balken – der Tooltip-Trigger (Radix Slot) verkettete die
// className-Funktion von NavLink als Text. Nur der aktive Eintrag darf die Aktiv-Klassen tragen.
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'

vi.mock('@/data/nav', () => ({ useNavZaehler: () => ({ heute: 3 }) }))
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { member: null; abmelden: () => Promise<void> }) => unknown) =>
    sel({ member: null, abmelden: async () => {} }),
}))

import { IconRail } from './IconRail'

describe('IconRail', () => {
  it('nur der aktive Eintrag ist markiert; kein Funktions-Quelltext in className', () => {
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
      { initialEntries: ['/leads'] },
    )
    render(<RouterProvider router={router} />)
    const leads = screen.getByRole('link', { name: 'Leads' })
    const heute = screen.getByRole('link', { name: 'Heute' })
    expect(leads).toHaveAttribute('aria-current', 'page')
    expect(heute).not.toHaveAttribute('aria-current')
    for (const a of screen.getAllByRole('link')) {
      expect(a.className).not.toMatch(/isActive|=>/)
      // Aktiv-Balken nur über die aria-current-Variante, nie als unbedingte Klasse
      expect(a.className.split(/\s+/)).not.toContain('before:bg-signal')
    }
  })

  it('Runde 2: „Feedback geben (⌥F)“ sitzt in der Rail (statt schwebend über dem Inhalt) und öffnet den Dialog', () => {
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
      { initialEntries: ['/heute'] },
    )
    render(<RouterProvider router={router} />)
    const h = vi.fn()
    window.addEventListener('crm:feedback', h)
    const knopf = screen.getByRole('button', { name: 'Feedback geben (⌥F)' })
    expect(knopf).toHaveAttribute('data-tour', 'feedback')
    fireEvent.click(knopf)
    expect(h).toHaveBeenCalledTimes(1)
    window.removeEventListener('crm:feedback', h)
  })
})
