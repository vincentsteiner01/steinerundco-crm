// LeadOutlet (Neustart 25.11.2026, ersetzt den Peek): öffnet das Lead-Blatt bei `?lead=` auf jeder Seite – nur nicht im Composer
// (/email/verfassen, dort meint `lead` den Empfänger). Schließen: nach einem Direktaufruf wird allein dieser Parameter entfernt
// (replace); hat ein eigener Verlaufseintrag das Blatt geöffnet (Karte auf dem Board), geht es genau einen Schritt zurück.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'

// Das Lead-Blatt selbst baut die Teilaufgabe „Board“ – hier zählt nur der Vertrag { leadId, onClose }
vi.mock('@/features/board/LeadBlatt', () => ({
  LeadBlatt: ({ leadId, onClose }: { leadId: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Lead-Blatt" data-lead={leadId}>
      <button type="button" onClick={onClose}>
        Schließen
      </button>
      <button
        type="button"
        onClick={() => {
          onClose()
          onClose()
        }}
      >
        Zweimal schließen
      </button>
    </div>
  ),
}))

import { BLATT_IM_VERLAUF } from '@/features/board/verlauf'
import { LeadOutlet } from './LeadOutlet'

function Ort() {
  const l = useLocation()
  return <output data-testid="ort">{`${l.pathname}${l.search}`}</output>
}

function rendern(...verlauf: string[]) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <LeadOutlet />
            <Ort />
          </>
        ),
      },
    ],
    { initialEntries: verlauf },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LeadOutlet', () => {
  beforeEach(() => useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] }))

  it('öffnet das Lead-Blatt bei ?lead= und entfernt beim Schließen nur diesen Parameter', async () => {
    rendern('/email?tab=gesendet&lead=l1')
    const blatt = await screen.findByRole('dialog', { name: 'Lead-Blatt' })
    expect(blatt).toHaveAttribute('data-lead', 'l1')
    // Listen- und Karten-Tasten der Seite dahinter ruhen, solange das Blatt offen ist
    expect(useUiStore.getState().hotkeyScope).toBe('formular')
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/email\?tab=gesendet$/)
    expect(useUiStore.getState().hotkeyScope).toBe('global')
  })

  it('Direktaufruf mit ?lead=: Schließen ersetzt den Eintrag (replace) – es gibt nichts, wohin „zurück“ führen dürfte', async () => {
    const router = rendern('/hilfe', '/leads?lead=l1')
    await screen.findByRole('dialog', { name: 'Lead-Blatt' })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
    // der Eintrag davor ist unberührt: ein Schritt zurück führt dorthin, nicht ins Blatt
    await act(() => router.navigate(-1))
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/hilfe$/)
  })

  it('über einen eigenen Verlaufseintrag geöffnet (Karte): Schließen geht einen Schritt zurück, „Vor“ öffnet wieder', async () => {
    const router = rendern('/hilfe', '/leads')
    await act(() => router.navigate('/leads?lead=l1', { state: BLATT_IM_VERLAUF }))
    await screen.findByRole('dialog', { name: 'Lead-Blatt' })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.historyAction).toBe('POP')
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
    // kein toter Eintrag: „Vor“ führt wieder ins Blatt – und es lässt sich erneut schließen
    await act(() => router.navigate(1))
    expect(await screen.findByRole('dialog', { name: 'Lead-Blatt' })).toHaveAttribute('data-lead', 'l1')
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
  })

  it('„Zurück“ des Browsers schließt das so geöffnete Blatt und bleibt auf dem Board', async () => {
    const router = rendern('/hilfe', '/leads')
    await act(() => router.navigate('/leads?lead=l1', { state: BLATT_IM_VERLAUF }))
    await screen.findByRole('dialog', { name: 'Lead-Blatt' })
    await act(() => router.navigate(-1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
    expect(useUiStore.getState().hotkeyScope).toBe('global')
  })

  it('zweimal Schließen hintereinander geht nur EINEN Schritt zurück (sonst verließe es das Board)', async () => {
    const router = rendern('/hilfe', '/leads')
    await act(() => router.navigate('/leads?lead=l1', { state: BLATT_IM_VERLAUF }))
    await screen.findByRole('dialog', { name: 'Lead-Blatt' })
    fireEvent.click(screen.getByRole('button', { name: 'Zweimal schließen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
  })

  it('öffnet auf dem Board und folgt einem Wechsel des Leads', async () => {
    const router = rendern('/leads')
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(() => router.navigate('/leads?lead=l1'))
    expect(await screen.findByRole('dialog', { name: 'Lead-Blatt' })).toHaveAttribute('data-lead', 'l1')
    await act(() => router.navigate('/leads?lead=l2'))
    expect(screen.getByRole('dialog', { name: 'Lead-Blatt' })).toHaveAttribute('data-lead', 'l2')
  })

  it('öffnet nicht auf /email/verfassen – dort gehört ?lead= dem Composer', async () => {
    const router = rendern('/email/verfassen?lead=l1')
    // dem Lazy-Import Zeit geben: es darf auch danach kein Blatt erscheinen
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead=l1')
    expect(useUiStore.getState().hotkeyScope).toBe('global')
    await act(() => router.navigate('/email?lead=l1'))
    expect(await screen.findByRole('dialog', { name: 'Lead-Blatt' })).toBeInTheDocument()
  })
})
