// Hilfe-Seite: Übersicht mit häufigen Fragen, Themen mit Inhalt aus themen.ts, Suche (Enter öffnet), „Zeig’s mir“ startet die
// Mini-Tour, „Tour erneut starten“ die Einführung, Tastenkürzel aus der Registry, unbekanntes Thema → /hilfe.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { TooltipProvider } from '@/components/ui/Tooltip'
import { useAuth } from '@/features/auth/authStore'
import { TOUR_EVENT } from './ereignis'
import { Component as HilfeSeite } from './HilfeSeite'

function rendern(start: string) {
  const router = createMemoryRouter(
    [
      { path: '/hilfe', element: <HilfeSeite /> },
      { path: '/hilfe/:thema', element: <HilfeSeite /> },
      { path: '*', element: <p>andere Seite</p> },
    ],
    { initialEntries: [start] },
  )
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
  return router
}

const touren: string[] = []
const merke = (e: Event) => touren.push((e as CustomEvent<{ tour: string }>).detail.tour)

beforeEach(() => {
  touren.length = 0
  window.removeEventListener(TOUR_EVENT, merke)
  window.addEventListener(TOUR_EVENT, merke)
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: 'u1', email: 'vincent@steinerundco.de', display_name: 'Vincent' },
  } as never)
})

describe('Hilfe', () => {
  it('Übersicht: Titel, häufige Fragen mit Links, Themenliste mit allen Themen', () => {
    rendern('/hilfe')
    expect(screen.getByRole('heading', { level: 1, name: 'Hilfe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Was das CRM kann – und was nicht.' })).toBeInTheDocument()
    expect(screen.getByText('Kann ich mein Gmail verbinden?')).toBeInTheDocument()
    expect(screen.getByText('Kommen LinkedIn-Nachrichten automatisch ins CRM?')).toBeInTheDocument()
    const liste = screen.getByRole('navigation', { name: 'Hilfe-Themen' })
    // Runde 2: am Telefon steht das Themenverzeichnis unter Einleitung und FAQ
    expect(screen.getByRole('complementary', { name: 'Themen' })).toHaveClass('max-md:order-last')
    expect(within(liste).getAllByRole('link').length).toBeGreaterThanOrEqual(13)
    expect(within(liste).getByRole('link', { name: /Was das CRM \(noch\) nicht kann/ })).toHaveAttribute(
      'href',
      '/hilfe/noch-nicht',
    )
  })

  it('„Tour erneut starten“ startet die Einführung', () => {
    rendern('/hilfe')
    fireEvent.click(screen.getByRole('button', { name: /Tour erneut starten/ }))
    expect(touren).toEqual(['onboarding'])
  })

  it('Thema LinkedIn: Text, „geplant“-Hinweis, „Zeig’s mir“ startet die Mini-Tour', () => {
    rendern('/hilfe/linkedin')
    expect(screen.getByRole('heading', { level: 2, name: /LinkedIn: was automatisch geht/ })).toBeInTheDocument()
    expect(screen.getByText(/berührt das CRM LinkedIn nie/)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-geplant]').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByRole('button', { name: /Zeig’s mir/ }))
    expect(touren).toEqual(['linkedin'])
    // Weiter-Navigation zum nächsten Thema
    expect(screen.getByRole('navigation', { name: 'Weitere Themen' })).toHaveTextContent('Telefon')
  })

  it('Suche filtert über den ganzen Text, Enter öffnet den ersten Treffer, nichts gefunden → Hinweis', () => {
    const router = rendern('/hilfe')
    const feld = screen.getByRole('searchbox', { name: 'Hilfe durchsuchen' })
    fireEvent.change(feld, { target: { value: 'gmail verbinden' } })
    const liste = screen.getByRole('navigation', { name: 'Hilfe-Themen' })
    expect(
      within(liste)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['07E-Mail'])
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(router.state.location.pathname).toBe('/hilfe/email')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hilfe durchsuchen' }), { target: { value: 'xyzzy' } })
    expect(screen.getByText(/Nichts gefunden/)).toBeInTheDocument()
  })

  it('Tastenkürzel kommen aus der Registry (src/app/tasten.ts) plus Hilfe-Gruppe', () => {
    rendern('/hilfe/tastenkuerzel')
    const register = document.querySelector('[data-tastenregister]') as HTMLElement
    expect(within(register).getByRole('region', { name: 'Global' })).toBeInTheDocument()
    expect(within(register).getByRole('region', { name: 'Heute' })).toBeInTheDocument()
    expect(within(register).getByRole('region', { name: 'Hilfe & Tour' })).toBeInTheDocument()
    // ⌥F und G A stehen in der Liste – aus der Registry oder aus der Ergänzung, nie doppelt
    expect(within(register).getAllByText('⌥F')).toHaveLength(1)
    expect(within(register).getAllByText('A').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Tastenliste öffnen/ })).toBeInTheDocument()
  })

  it('Dein Tag zeigt die Routine der angemeldeten Person zuerst', () => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: 'u2', email: 'mike@steinerundco.de', display_name: 'Mike' },
    } as never)
    rendern('/hilfe/dein-tag')
    const titel = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titel[0]).toMatch(/^Mike/)
    // Mikes „Zeig’s mir“ führt durch Telefon statt LinkedIn
    fireEvent.click(screen.getByRole('button', { name: /Zeig’s mir/ }))
    expect(touren).toEqual(['telefon'])
  })

  it('unbekanntes Thema → Übersicht', () => {
    const router = rendern('/hilfe/gibt-es-nicht')
    expect(router.state.location.pathname).toBe('/hilfe')
  })
})
