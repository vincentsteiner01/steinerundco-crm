// L-02…L-04, L-06 (BAUPLAN § 3.1.7): Fehlertexte, Countdown nach 5 Versuchen, Redirect-Ziel aus ?von=, Ablehnung von //evil und https://…
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('./authStore', () => ({
  useAuth: (sel: (s: { status: string; member: null }) => unknown) => sel({ status: 'anonym', member: null }),
}))

import { setzeBleiben, supabase } from '@/data/supabase'
import { Component as Anmelden, sicheresZiel } from './Anmelden'

function Ziel({ name }: { name: string }) {
  return <h1>{name}</h1>
}

function rendern(start = '/anmelden') {
  const router = createMemoryRouter(
    [
      { path: '/anmelden', Component: Anmelden },
      { path: '/heute', element: <Ziel name="HEUTE" /> },
      { path: '/leads', element: <Ziel name="LEADS" /> },
    ],
    { initialEntries: [start] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const signIn = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>

describe('Anmelden', () => {
  beforeEach(() => {
    localStorage.clear()
    signIn.mockReset()
    signIn.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } })
  })
  afterEach(() => vi.useRealTimers())

  it('zeigt Headline, zwei Kacheln und merkt die Person', () => {
    rendern()
    expect(screen.getByRole('heading', { name: 'Wer bist du?' })).toBeInTheDocument()
    const mike = screen.getByRole('button', { name: /Mike/ })
    fireEvent.click(mike)
    expect(mike).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('crm.person')).toBe('mike')
    expect(document.activeElement).toBe(screen.getByLabelText('Passcode'))
  })

  it('L-01: erster Besuch → Fokus auf der Kachel, `M` wählt Mike und setzt den Fokus ins Passcode-Feld (Review)', () => {
    rendern()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Vincent/ }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'm', code: 'KeyM' })
    expect(screen.getByRole('button', { name: /Mike/ })).toHaveAttribute('aria-pressed', 'true')
    expect(document.activeElement).toBe(screen.getByLabelText('Passcode'))
    expect((screen.getByLabelText('Passcode') as HTMLInputElement).value).toBe('')
  })

  it('L-07: gemerkte Person ist vorausgewählt, der Fokus liegt im Passcode-Feld', () => {
    localStorage.setItem('crm.person', 'mike')
    rendern()
    expect(screen.getByRole('button', { name: /Mike/ })).toHaveAttribute('aria-pressed', 'true')
    expect(document.activeElement).toBe(screen.getByLabelText('Passcode'))
  })

  it('L-02: unter 10 Zeichen → Hinweis, kein Request', () => {
    rendern()
    fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: 'kurz' } })
    fireEvent.click(screen.getByRole('button', { name: /Anmelden/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Mindestens 10 Zeichen.')
    expect(signIn).not.toHaveBeenCalled()
  })

  it('L-03: falscher Passcode → Meldung, Text bleibt im Feld', async () => {
    rendern()
    const feld = screen.getByLabelText('Passcode') as HTMLInputElement
    fireEvent.change(feld, { target: { value: 'zehn-zeichen-x' } })
    fireEvent.click(screen.getByRole('button', { name: /Anmelden/ }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Passcode stimmt nicht – versuch es nochmal.'),
    )
    expect(feld.value).toBe('zehn-zeichen-x')
    expect(signIn).toHaveBeenCalledWith({ email: 'vincent@steinerundco.de', password: 'zehn-zeichen-x' })
    expect(setzeBleiben).toHaveBeenCalled()
  })

  it('L-04: nach 5 Fehlversuchen 30 s Sperre mit Countdown', async () => {
    rendern()
    const feld = screen.getByLabelText('Passcode')
    fireEvent.change(feld, { target: { value: 'zehn-zeichen-x' } })
    // Unter Last (volle Suite) erst klicken, wenn der vorige Versuch fertig ist (Button wieder frei) – sonst Timing-Flake
    for (let i = 0; i < 5; i++) {
      await waitFor(() => expect(screen.getByRole('button', { name: /Anmelden/ })).toBeEnabled(), { timeout: 3000 })
      fireEvent.click(screen.getByRole('button', { name: /Anmelden/ }))
      await waitFor(() => expect(signIn).toHaveBeenCalledTimes(i + 1), { timeout: 3000 })
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /Nochmal in \d+ s/ })).toBeDisabled(), {
      timeout: 3000,
    })
    fireEvent.click(screen.getByRole('button', { name: /Nochmal/ }))
    expect(signIn).toHaveBeenCalledTimes(5)
  })

  it('L-06: Erfolg leitet zum Ziel aus ?von=', async () => {
    signIn.mockResolvedValue({ data: {}, error: null })
    const router = rendern('/anmelden?von=%2Fleads%3Flead%3D42')
    fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: 'zehn-zeichen-x' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Anmelden/ }))
    })
    await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/leads?lead=42'))
  })

  it('lehnt //evil und https://… als Ziel ab', () => {
    expect(sicheresZiel('//evil.example')).toBe('/heute')
    expect(sicheresZiel('https://evil.example')).toBe('/heute')
    expect(sicheresZiel('/anmelden?von=x')).toBe('/heute')
    expect(sicheresZiel(null)).toBe('/heute')
    expect(sicheresZiel('/leads?lead=42')).toBe('/leads?lead=42')
  })
})
