// @vitest-environment jsdom
// Seitenleiste: Antwort aus der LinkedIn-Mail ist schon erfasst (ohne Reaktion) → „Reaktion nachtragen“ statt zweiter Antwort.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ich, LeadAnsicht } from '../src/shared/typen'
import { LeadKarte } from '../src/ui/panel/LeadKarte'

const ICH: Ich = {
  id: 'u-vincent',
  name: 'Vincent',
  kurz: 'Vincent',
  kuerzel: 'V',
  personId: 'vincent',
  email: 'vincent@steinerundco.de',
  platzhalter: { display_name: 'Vincent', short_name: 'Vincent', caller_number_e164: null, signature: null, calendly_url: null },
}

function ansicht(antwortOffen: LeadAnsicht['antwortOffen']): LeadAnsicht {
  return {
    lead: {
      id: 'l-1', name: 'Paula Probe', titel: null, vorname: 'Paula', nachname: 'Probe', anrede: 'frau', unternehmen: 'Probe GmbH',
      rolle: 'geschaeftsfuehrer', rollenTitel: null, stadt: null, stufe: 'dm_beantwortet', stufeLabel: 'Antwort erhalten', phaseTon: 'neutral',
      beendetGrund: null, owner: null, linkedinNorm: 'linkedin.com/in/paula-probe',
    },
    verbindungen: [],
    meineVerbindung: 'angenommen',
    andereOffen: false,
    gate: { erlaubt: true, grund: null, text: null },
    sequenz: null,
    vorlage: null,
    antwortOffen,
    platzhalterLead: { first_name: 'Paula', last_name: 'Probe', company_name: 'Probe GmbH', city: null, call_basis: null, call_basis_note: null, salutation: 'frau' },
  } as LeadAnsicht
}

describe('LeadKarte – Reaktion nachtragen', () => {
  const sendMessage = vi.fn(async (_n: unknown) => ({ ok: true, daten: { text: 'Reaktion erfasst.', ansicht: null, rueckgabe: null } }))
  beforeEach(() => {
    sendMessage.mockClear()
    ;(globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage }, tabs: { create: vi.fn(async () => ({})) } }
  })
  afterEach(() => cleanup())

  it('Antwort aus der Mail ohne Reaktion: Knopf „Reaktion nachtragen“, Zitat aus der Mail, kein neues Zitat gesendet', async () => {
    const onErledigt = vi.fn()
    render(
      <LeadKarte
        ansicht={ansicht({ seit: '2026-10-15T08:00:00Z', label: null, zitat: 'Gern mehr Infos.', vorlage: null, aktivitaetId: 4242 })}
        ich={ICH}
        extrakt={{ art: 'nachrichten', url: 'https://www.linkedin.com/messaging/thread/1/', person: null, letzteNachricht: 'Anderer Text', auswahl: null, hinweis: null }}
        basis="https://crm.steinerundco.de"
        onErledigt={onErledigt}
        leseFrisch={async () => null}
      />,
    )
    expect(screen.getByText(/Reaktion fehlt noch/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Reaktion nachtragen/ }))
    expect(screen.queryByPlaceholderText(/Was hat die Person geschrieben/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ja/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reaktion speichern/ }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({ typ: 'antwortErhalten', leadId: 'l-1', label: 'interessiert', zitat: null })
    await waitFor(() => expect(onErledigt).toHaveBeenCalled())
  })

  it('ohne offene Antwort bleibt es „Antwort erhalten“ mit Zitat-Feld', () => {
    render(<LeadKarte ansicht={ansicht(null)} ich={ICH} extrakt={null} basis="https://crm.steinerundco.de" onErledigt={vi.fn()} leseFrisch={async () => null} />)
    fireEvent.click(screen.getByRole('button', { name: /Antwort erhalten/ }))
    expect(screen.getByPlaceholderText(/Was hat die Person geschrieben/)).toBeTruthy()
  })
})
