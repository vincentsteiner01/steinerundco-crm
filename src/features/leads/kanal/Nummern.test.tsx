// Weitere Nummern + Länderauswahl in der Telefon-Karte (Feedback 9f9301ea, ebfc59a0)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { vollerLead } from '@/test/fixtures/leads'
import type { LeadMitBezug } from '@/types/domain'
import { WeitereNummern } from './Nummern'

const lead = (patch: Partial<LeadMitBezug> = {}) =>
  ({ ...vollerLead(1), phone_e164: '+4940123456', phone_type: 'zentrale', phone_numbers: [], ...patch }) as LeadMitBezug

function rendern(l: LeadMitBezug) {
  const patch = vi.fn(async () => true)
  render(
    <TooltipProvider>
      <WeitereNummern lead={l} patch={patch} />
    </TooltipProvider>,
  )
  return patch
}

describe('WeitereNummern', () => {
  it('fügt eine österreichische Durchwahl hinzu („0…“ mit Land AT)', async () => {
    const patch = rendern(lead())
    fireEvent.click(screen.getByRole('button', { name: '+ Nummer' }))
    fireEvent.change(screen.getByLabelText('Art der Nummer'), { target: { value: 'durchwahl' } })
    fireEvent.change(screen.getByLabelText('Land der Nummer'), { target: { value: 'AT' } })
    fireEvent.change(screen.getByLabelText('Neue Nummer'), { target: { value: '0664 1234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ phone_numbers: [{ e164: '+436641234567', typ: 'durchwahl' }] }),
    )
  })

  it('„Als Hauptnummer“ tauscht: neue Hauptnummer + alte Hauptnummer in die Liste', async () => {
    const patch = rendern(lead({ phone_numbers: [{ e164: '+491711234567', typ: 'mobil' }] }))
    expect(screen.getByText('+49 171 1234567')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mobil als Hauptnummer' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        phone_e164: '+491711234567',
        phone_type: 'mobil',
        phone_numbers: [{ e164: '+4940123456', typ: 'zentrale' }],
      }),
    )
  })

  it('ohne Hauptnummer wird die erste Nummer die Hauptnummer; doppelte Nummer wird abgelehnt', async () => {
    const patch = rendern(lead({ phone_e164: null, phone_type: 'unbekannt' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Nummer' }))
    fireEvent.change(screen.getByLabelText('Neue Nummer'), { target: { value: '040 123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({ phone_e164: '+4940123456', phone_type: 'zentrale' }),
      ),
    )
  })

  it('lehnt eine bereits eingetragene Nummer ab', async () => {
    const patch = rendern(lead())
    fireEvent.click(screen.getByRole('button', { name: '+ Nummer' }))
    fireEvent.change(screen.getByLabelText('Neue Nummer'), { target: { value: '040 123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Diese Nummer ist schon eingetragen.')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })
})
