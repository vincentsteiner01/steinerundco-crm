// Lead-Blatt (25.11.2026) mit gemockten Daten-Hooks: Felder, Speichern (nur Geändertes), alte Leads ohne Liste, „Karte entfernen“
// mit Rückgängig, E-Mail-Bereich (Adresse, Erlaubnis, Einzelmail). Nur erfundene Namen.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import type { Lead } from '@/types/domain'

const SEIT = '2026-11-25T09:00:00+00:00'

const m = vi.hoisted(() => ({
  lead: null as unknown,
  fehler: false,
  speichern: vi.fn(),
  verschieben: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(),
}))

vi.mock('@/data', () => ({
  useLead: () => ({ data: m.fehler ? undefined : m.lead, isError: m.fehler, refetch: vi.fn() }),
  useMembers: () => ({
    data: [
      { id: '00000000-0000-4000-8000-000000000002', display_name: 'Mike', email: 'mike@beispiel.test' },
      { id: '00000000-0000-4000-8000-000000000001', display_name: 'Vincent', email: 'vincent@beispiel.test' },
    ],
  }),
}))
vi.mock('@/data/board', () => ({
  useKarteSpeichern: () => ({ mutate: m.speichern, isPending: false }),
  useKarteVerschieben: () => ({ mutateAsync: m.verschieben }),
}))
// Der E-Mail-Bereich selbst ist nicht Teil des Boards – hier zählt nur, dass das Blatt ihn mit dem richtigen Lead einbindet
vi.mock('@/features/email/public', () => ({
  ErlaubnisBadge: ({ lead }: { lead: Lead }) => <span data-testid="erlaubnis">{lead.email_consent_basis}</span>,
  ErlaubnisErfassen: ({ leadId, trigger }: { leadId: string; trigger: ReactNode }) => (
    <span data-testid="erfassen" data-lead={leadId}>
      {trigger}
    </span>
  ),
}))
vi.mock('@/components/toast', () => ({ toast: m.toast, toastUndo: m.toastUndo, toastFehler: vi.fn() }))

import { LeadBlatt } from './LeadBlatt'

function lead(patch: Partial<Lead> = {}): Lead {
  return vollerLead(1, {
    first_name: 'Petra',
    last_name: 'Probelauf',
    full_name: 'Petra Probelauf',
    salutation: 'frau',
    company_id: null,
    company_name: null,
    linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
    owner_id: MEMBER_V,
    notes: null,
    email: null,
    board_liste: 'angeschrieben',
    board_seit: SEIT,
    ...patch,
  })
}

function zeigen(l: Lead, pfad = '/leads') {
  m.lead = l
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={[`${pfad}?lead=${l.id}`]}>
      <LeadBlatt leadId={l.id} onClose={onClose} />
    </MemoryRouter>,
  )
  return { onClose, blatt: within(screen.getByRole('dialog')) }
}

const gewaehlt = (gruppe: HTMLElement) =>
  within(gruppe)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)

beforeEach(() => {
  m.fehler = false
  m.speichern.mockReset().mockImplementation((_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.())
  m.verschieben.mockReset().mockResolvedValue(null)
  m.toast.mockClear()
  m.toastUndo.mockClear()
})

describe('Lead-Blatt', () => {
  it('zeigt die Felder des Leads: Name, Anrede, Firma, Link, Zugehörigkeit, Liste, Notiz', () => {
    const { blatt } = zeigen(lead({ company_name: 'Muster Solar GmbH', notes: 'Ruft Dienstag zurück' }))
    expect(screen.getByRole('dialog', { name: 'Petra Probelauf' })).toBeInTheDocument()
    expect(blatt.getByLabelText('Vorname')).toHaveValue('Petra')
    expect(blatt.getByLabelText('Nachname')).toHaveValue('Probelauf')
    expect(blatt.getByLabelText('Firma')).toHaveValue('Muster Solar GmbH')
    expect(blatt.getByLabelText('Firma')).toBeEnabled()
    expect(blatt.getByLabelText('LinkedIn-Link')).toHaveValue('https://www.linkedin.com/in/petra-probelauf/')
    expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')
    expect(gewaehlt(blatt.getByRole('group', { name: 'Anrede' }))).toEqual(['Frau'])
    expect(
      within(blatt.getByRole('group', { name: 'Zugehörigkeit' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Vincent', 'Mike'])
    expect(gewaehlt(blatt.getByRole('group', { name: 'Zugehörigkeit' }))).toEqual(['Vincent'])
    expect(
      within(blatt.getByRole('group', { name: 'Liste' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Angeschrieben', 'Gespräch vereinbart', 'Im Geschäft', 'Verloren'])
    expect(gewaehlt(blatt.getByRole('group', { name: 'Liste' }))).toEqual(['Angeschrieben'])
  })

  it('Speichern schickt nur die geänderten Felder, meldet „Gespeichert.“ und schließt', () => {
    const l = lead()
    const { blatt, onClose } = zeigen(l)
    fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Probelauf-Muster' } })
    fireEvent.change(blatt.getByLabelText('Firma'), { target: { value: 'Muster Solar GmbH' } })
    fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })
    fireEvent.click(within(blatt.getByRole('group', { name: 'Anrede' })).getByRole('button', { name: 'Herr' }))
    fireEvent.click(within(blatt.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Mike' }))
    fireEvent.click(
      within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Gespräch vereinbart' }),
    )
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).toHaveBeenCalledTimes(1)
    expect(m.speichern.mock.calls[0]![0]).toEqual({
      id: l.id,
      patch: {
        last_name: 'Probelauf-Muster',
        company_name: 'Muster Solar GmbH',
        notes: 'Ruft Dienstag zurück',
        salutation: 'herr',
        owner_id: MEMBER_M,
        board_liste: 'gespraech',
      },
    })
    expect(m.toast).toHaveBeenCalledWith('Gespeichert.')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Speichern ohne Änderung schließt nur; Abbrechen speichert nichts', () => {
    const { blatt, onClose } = zeigen(lead())
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Anders' } })
    fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('schlägt das Speichern fehl, bleibt das Blatt mit den Eingaben offen', () => {
    m.speichern.mockImplementation(() => {})
    const { blatt, onClose } = zeigen(lead())
    fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Anders' } })
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(blatt.getByLabelText('Nachname')).toHaveValue('Anders')
  })

  it('ein neuer Link, der kein Profil-Link ist, wird nicht gespeichert', () => {
    const { blatt, onClose } = zeigen(lead())
    fireEvent.change(blatt.getByLabelText('LinkedIn-Link'), {
      target: { value: 'https://www.linkedin.com/company/muster-solar' },
    })
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(blatt.getByRole('alert')).toHaveTextContent('Das ist kein LinkedIn-Profil-Link')
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Anrede: noch einmal auf die gewählte tippen nimmt sie zurück (neutral)', () => {
    const l = lead()
    const { blatt } = zeigen(l)
    fireEvent.click(within(blatt.getByRole('group', { name: 'Anrede' })).getByRole('button', { name: 'Frau' }))
    expect(gewaehlt(blatt.getByRole('group', { name: 'Anrede' }))).toEqual([])
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { salutation: 'neutral' } })
  })

  it('alter Lead ohne Liste: bei „Liste“ ist nichts gewählt, kein „Karte entfernen“; eine Liste wählen legt ihn aufs Board', () => {
    const l = lead({ board_liste: null, board_seit: null })
    const { blatt } = zeigen(l, '/email')
    expect(gewaehlt(blatt.getByRole('group', { name: 'Liste' }))).toEqual([])
    expect(blatt.queryByRole('button', { name: 'Karte entfernen' })).toBeNull()
    fireEvent.click(within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Im Geschäft' }))
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { board_liste: 'im_geschaeft' } })
  })

  it('Firma eines alten Leads mit verknüpftem Unternehmen ist nur Anzeige (die Datenbank schreibt sie selbst)', () => {
    const { blatt } = zeigen(lead({ company_id: 'firma-1', company_name: 'Muster Solar GmbH' }))
    expect(blatt.getByLabelText('Firma')).toHaveValue('Muster Solar GmbH')
    expect(blatt.getByLabelText('Firma')).toBeDisabled()
  })

  it('„Karte entfernen“ nimmt die Karte vom Board (nichts wird gelöscht); Rückgängig legt sie mit board_seit zurück', async () => {
    const l = lead({ board_liste: 'gespraech' })
    const { blatt, onClose } = zeigen(l)
    fireEvent.click(blatt.getByRole('button', { name: 'Karte entfernen' }))
    expect(m.verschieben).toHaveBeenCalledWith({ id: l.id, liste: null })
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(1))
    const [text, zurueck] = m.toastUndo.mock.calls[0] as [string, () => Promise<void>]
    expect(text).toBe('Karte entfernt.')
    await act(async () => {
      await zurueck()
    })
    expect(m.verschieben).toHaveBeenLastCalledWith({ id: l.id, liste: 'gespraech', seit: SEIT })
  })

  it('E-Mail-Bereich: Adresse oder „–“, Erlaubnis des Leads, „Erlaubnis erfassen“ und „E-Mail schreiben“ mit Rücksprung', () => {
    const l = lead({ email: 'petra@beispiel-solar.test', email_consent_basis: 'requested_linkedin' })
    const { blatt } = zeigen(l)
    const bereich = within(blatt.getByRole('region', { name: 'E-Mail' }))
    expect(bereich.getByText('petra@beispiel-solar.test')).toBeInTheDocument()
    expect(bereich.getByTestId('erlaubnis')).toHaveTextContent('requested_linkedin')
    expect(bereich.getByTestId('erfassen')).toHaveAttribute('data-lead', l.id)
    expect(bereich.getByRole('button', { name: 'Erlaubnis erfassen' })).toBeInTheDocument()
    const ziel = new URL(
      bereich.getByRole('link', { name: 'E-Mail schreiben' }).getAttribute('href')!,
      'https://x.test',
    )
    expect(ziel.pathname).toBe('/email/verfassen')
    expect(ziel.searchParams.get('lead')).toBe(l.id)
    expect(ziel.searchParams.get('zurueck')).toBe(`/leads?lead=${l.id}`)
  })

  it('ohne Adresse steht „–“', () => {
    const { blatt } = zeigen(lead())
    expect(within(blatt.getByRole('region', { name: 'E-Mail' })).getByText('–')).toBeInTheDocument()
  })

  it('Ladefehler: Fehlerzeile statt Formular', () => {
    m.fehler = true
    m.lead = null
    render(
      <MemoryRouter>
        <LeadBlatt leadId="x" onClose={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Der Lead konnte nicht geladen werden')
    expect(screen.queryByLabelText('Vorname')).toBeNull()
  })
})
