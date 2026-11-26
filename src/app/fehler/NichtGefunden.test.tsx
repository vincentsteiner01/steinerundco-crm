// „Seite nicht gefunden“ (25.11.2026): eine Überschrift, ein Satz, ein großer Knopf – keine Datumszeile, keine zweite Überschrift.
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NichtGefunden } from './NichtGefunden'

describe('NichtGefunden', () => {
  it('zeigt genau eine Überschrift, den Satz und „Zu den Leads“ in 44 px; der Knopf führt aufs Board', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/gibtsnicht']}>
        <Routes>
          <Route path="/leads" element={<p>Board</p>} />
          <Route path="*" element={<NichtGefunden />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Seite nicht gefunden\.$/)
    expect(screen.getByText('Die Adresse kennt das CRM nicht.')).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/KW \d|\d{4}/)
    const knopf = screen.getByRole('button', { name: 'Zu den Leads' })
    expect(knopf).toHaveClass('h-11', 'bg-signal')
    fireEvent.click(knopf)
    expect(screen.getByText('Board')).toBeInTheDocument()
  })
})
