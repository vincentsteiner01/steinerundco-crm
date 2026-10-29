// Einführungstour: Autostart je Person (nur auf Heute, nur ohne Merker), Start per Ereignis, Tasten → ← Esc, Seitentasten sind
// während der Tour stumm, Spotlight auf sichtbare Ziele, Sheet unter 768 px, gespeichert wird nur das Ende der Einführung.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import type { Member } from '@/types/domain'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
const mutate = vi.fn()
let me: Partial<Member> | undefined
vi.mock('@/data/members', async (orig) => ({
  ...(await orig<typeof import('@/data/members')>()),
  useMe: () => me,
  useProfilSpeichern: () => ({ mutate }),
}))

import { tourStarten } from './ereignis'
import { OnboardingTour } from './OnboardingTour'

const VINCENT: Partial<Member> = {
  id: '6b6a66af-06a0-47fb-a151-d131860982f5',
  display_name: 'Vincent',
  // echte Daten seit Runde 2: Kürzel „VS“ im Profil – die Tour sagt trotzdem „Willkommen, Vincent.“
  short_name: 'VS',
  linkedin_plan: 'premium',
  weekly_budget: 150,
  daily_target: 30,
  preferences: { realtime_toasts: false },
}

function rendern(start = '/heute', seite: React.ReactNode = <p>Seite</p>) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <OnboardingTour />
            <Outlet />
          </>
        ),
        children: [{ path: '*', element: seite }],
      },
    ],
    { initialEntries: [start] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const dialog = () => screen.findByRole('dialog', {}, { timeout: 3000 })
const zaehler = () => screen.getByLabelText(/^Schritt \d+ von \d+$/).textContent

beforeEach(() => {
  me = { ...VINCENT }
  mutate.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Autostart', () => {
  it('startet auf Heute, wenn die Person die Einführung noch nie gesehen hat', async () => {
    rendern('/heute')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await dialog()).toHaveTextContent('Willkommen, Vincent.')
    expect(zaehler()).toMatch(/^1 \/ 9$/)
  })

  it('startet nicht, wenn die Einführung schon fertig ist', async () => {
    vi.useFakeTimers()
    me = { ...VINCENT, preferences: { onboarding_v1: 'done' } }
    rendern('/heute')
    await act(async () => void vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('startet nicht auf anderen Seiten (z. B. mitten im Anruf)', async () => {
    vi.useFakeTimers()
    rendern('/telefon/anruf/abc')
    await act(async () => void vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Recherche-Tour: startet einmal beim ersten Besuch von Auftrag und merkt sich „Fertig“ getrennt von der Einführung', async () => {
    me = { ...VINCENT, preferences: { onboarding_v1: 'done' } }
    rendern('/auftrag')
    expect(await dialog()).toHaveTextContent('Neu: Recherche per Knopfdruck')
    expect(zaehler()).toBe('1 / 4')
    for (let i = 1; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: /Weiter/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fertig/ }))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]![0].preferences).toEqual({ onboarding_v1: 'done', tour_recherche_v1: 'done' })
  })

  it('Recherche-Tour startet nicht, wenn sie schon gesehen wurde – und nicht auf Heute', async () => {
    vi.useFakeTimers()
    me = { ...VINCENT, preferences: { onboarding_v1: 'done', tour_recherche_v1: 'skipped' } }
    rendern('/auftrag')
    await act(async () => void vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('startet nicht, solange das Profil lädt', async () => {
    vi.useFakeTimers()
    me = undefined
    rendern('/heute')
    await act(async () => void vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Bedienung', () => {
  it('→/↵ weiter, ← zurück, Esc überspringt und speichert skipped (andere Präferenzen bleiben)', async () => {
    me = { ...VINCENT, preferences: { onboarding_v1: 'done' } }
    rendern('/leads')
    act(() => tourStarten())
    await dialog()
    expect(zaehler()).toBe('1 / 9')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(zaehler()).toBe('2 / 9')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(zaehler()).toBe('3 / 9')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(zaehler()).toBe('2 / 9')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // war schon done → Überspringen eines Neustarts schreibt nichts
    expect(mutate).not.toHaveBeenCalled()
  })

  it('Überspringen beim ersten Mal speichert skipped über den Profil-Upsert', async () => {
    me = { ...VINCENT, preferences: {} }
    rendern('/leads')
    act(() => tourStarten('onboarding'))
    await dialog()
    fireEvent.click(screen.getByRole('button', { name: /Überspringen/ }))
    expect(mutate).toHaveBeenCalledTimes(1)
    const upsert = mutate.mock.calls[0]![0]
    expect(upsert.member_id).toBe(VINCENT.id)
    expect(upsert.weekly_budget).toBe(150)
    expect(upsert.preferences).toEqual({ onboarding_v1: 'skipped' })
  })

  it('bis zum Ende durchklicken speichert done; ab dem 4. Schritt bleibt die Tour auf Heute', async () => {
    const router = rendern('/leads')
    act(() => tourStarten('onboarding'))
    await dialog()
    await waitFor(() => expect(router.state.location.pathname).toBe('/heute'))
    for (let i = 1; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: /Weiter/ }))
    expect(zaehler()).toBe('9 / 9')
    expect(router.state.location.pathname).toBe('/heute')
    fireEvent.click(screen.getByRole('button', { name: /Fertig/ }))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]![0].preferences).toEqual({ realtime_toasts: false, onboarding_v1: 'done' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Mini-Tour aus der Hilfe öffnet ihren Screen und schreibt nichts', async () => {
    const router = rendern('/hilfe/kpis-team')
    act(() => tourStarten('kpis'))
    await dialog()
    await waitFor(() => expect(router.state.location.pathname).toBe('/kpis'))
    expect(screen.getByRole('button', { name: /Schließen/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutate).not.toHaveBeenCalled()
  })

  it('Seitentasten (E, S, J …) und Klicks erreichen die Seite nicht, solange die Tour läuft', async () => {
    const seitenTaste = vi.fn()
    document.addEventListener('keydown', seitenTaste)
    rendern('/leads')
    act(() => tourStarten())
    await dialog()
    fireEvent.keyDown(document.body, { key: 'e' })
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(seitenTaste).not.toHaveBeenCalled()
    expect(document.querySelector('[data-tour-overlay]')).toHaveClass('fixed', 'inset-0')
    document.removeEventListener('keydown', seitenTaste)
  })
})

describe('Spotlight und Sheet', () => {
  it('sichtbares Ziel bekommt das Loch, das Popover steht daneben; fehlendes Ziel → mittig', async () => {
    const ziel = (
      <nav aria-label="Hauptnavigation">
        <a href="/heute">Heute</a>
      </nav>
    )
    const orig = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.matches?.('a[href="/heute"]'))
        return { top: 100, left: 12, width: 200, height: 34, right: 212, bottom: 134, x: 12, y: 100 } as DOMRect
      return orig.call(this)
    }
    try {
      rendern('/heute', ziel)
      act(() => tourStarten())
      const d = await dialog()
      await waitFor(() => expect(document.querySelector('[data-tour-loch]')).not.toBeNull())
      expect(d).toHaveAttribute('data-seite', 'rechts')
      fireEvent.keyDown(window, { key: 'ArrowRight' }) // Queue-Karte fehlt hier → mittig mit Hinweis
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-seite', 'mitte'), { timeout: 4500 })
      expect(screen.getByRole('dialog')).toHaveTextContent('Gerade ist nichts fällig')
    } finally {
      Element.prototype.getBoundingClientRect = orig
    }
  })

  it('unter 768 px erscheint die Karte als Sheet über der Tab-Leiste', async () => {
    const orig = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('max-width: 767px'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      rendern('/leads')
      act(() => tourStarten())
      expect(await dialog()).toHaveAttribute('data-seite', 'sheet')
    } finally {
      window.matchMedia = orig
    }
  })
})
