// LeadNeuSeite.test.tsx (ux § 3.2.5): Sheet „Lead anlegen“ über der Liste, Vorbelegung aus der URL, ⌘Enter speichert und öffnet den Peek.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rendern, zuruecksetzen } from './_testHilfe'
import { Component as LeadNeuSeite } from './LeadNeuSeite'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
}))

describe('LeadNeuSeite', () => {
  beforeEach(() => zuruecksetzen())

  it('öffnet das Sheet mit Vorbelegung; ⌘Enter speichert und öffnet den Peek (/leads?lead=…)', async () => {
    rendern(<LeadNeuSeite />, {
      route: '/leads/neu?vorname=Jana&nachname=Ost&unternehmen=Ost%20Solar',
      pfad: '/leads/neu',
    })
    const dialog = await screen.findByRole('dialog', { name: 'Lead anlegen' })
    expect(dialog).toBeInTheDocument()
    const vorname = screen.getByLabelText('Vorname', { exact: false }) as HTMLInputElement
    expect(vorname.value).toBe('Jana')
    fireEvent.keyDown(vorname, { key: 'Enter', metaKey: true })
    await waitFor(() =>
      expect(screen.getByTestId('ort').textContent).toBe('/leads?lead=10000000-0000-4000-8000-000000000090'),
    )
  })
})
