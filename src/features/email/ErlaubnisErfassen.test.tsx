// ErlaubnisErfassen.test.tsx (§ 8.1 Nr. 1): Dialog über Trigger, Zitat-Pflicht, Adresse Pflicht + Sammeladresse-Hinweis,
// Verknüpfung aus Anrufen, Patch email_consent_* (Trigger loggt `einwilligung`), Badge-Zustände.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toastFehler: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { letzterAufruf } from '@/components/aktionen/_testHilfe'
import { MEMBER_V } from '@/test/fixtures/leads'
import { ANTWORTEN, LEAD_ID, leadMitErlaubnis, rendern, zuruecksetzen } from './_testHilfe'
import { erlaubnisZustand, istSammeladresse } from './erlaubnis'
import { ErlaubnisBadge } from './ErlaubnisBadge'
import { ErlaubnisErfassen, ErlaubnisBadge as BadgePublic, istEmailSequenzAktiv } from './public'

const patch = () => letzterAufruf(supabase.from, 'leads', 'update') as Record<string, unknown> | null

describe('ErlaubnisErfassen', () => {
  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('Trigger öffnet den Dialog; ohne Zitat kein Patch; mit Zitat Patch email_consent_* + Adresse', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none', email_consent_note: null, email: null })
    rendern(<ErlaubnisErfassen leadId={LEAD_ID} trigger={<button type="button">Erlaubnis erfassen</button>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Erlaubnis erfassen' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog).toHaveTextContent('Tobias Lindner'))
    const speichern = within(dialog).getByRole('button', { name: 'Erlaubnis erfassen' })
    fireEvent.click(speichern)
    expect(await within(dialog).findByText('Zitat ist Pflicht – der Wortlaut der Bitte.')).toBeInTheDocument()
    expect(within(dialog).getByText('Adresse ist Pflicht.')).toBeInTheDocument()
    expect(patch()).toBeNull()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Zitat' }), {
      target: { value: 'Schick mir gern Infos' },
    })
    const adresse = within(dialog).getByRole('textbox', { name: 'Adresse' })
    fireEvent.change(adresse, { target: { value: 'info@firma.de' } })
    expect(within(dialog).getByText('Sammeladresse – die Bitte muss von der Person selbst kommen.')).toBeInTheDocument()
    fireEvent.change(adresse, { target: { value: 'C.Mueller@Firma.de' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Grundlage' }), {
      target: { value: 'requested_phone' },
    })
    fireEvent.click(speichern)
    await waitFor(() => expect(patch()).not.toBeNull())
    expect(patch()).toMatchObject({
      email: 'c.mueller@firma.de',
      email_consent_basis: 'requested_phone',
      email_consent_note: 'Schick mir gern Infos',
      email_consent_ref: null,
    })
    expect(typeof patch()?.email_consent_at).toBe('string')
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Erlaubnis erfasst · Am Telefon um Infos gebeten · /))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Verknüpfung mit einem Anruf → email_consent_ref { call_id }', async () => {
    const basisFrom = vi.mocked(supabase.from).getMockImplementation()
    vi.mocked(supabase.from).mockImplementation(((tabelle: string) => {
      const k = basisFrom?.(tabelle) as Record<string, unknown>
      if (tabelle === 'calls') {
        k['then'] = (res: (a: unknown) => unknown) =>
          Promise.resolve({
            data: [{ id: 'call-1', started_at: '2026-10-12T10:00:00+02:00', outcome: 'send_info' }],
            error: null,
          }).then(res)
      }
      return k
    }) as typeof supabase.from)
    rendern(<ErlaubnisErfassen leadId={LEAD_ID} trigger={<button type="button">Öffnen</button>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }))
    const dialog = await screen.findByRole('dialog')
    const ref = within(dialog).getByRole('combobox', { name: 'Verknüpfung' })
    await waitFor(() => expect(within(ref).getAllByRole('option').length).toBe(2))
    expect(within(ref).getAllByRole('option')[1]).toHaveTextContent(
      'Anruf · 12.10.2026, 10:00 · Info per E-Mail gewünscht',
    )
    fireEvent.change(ref, { target: { value: 'call:call-1' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Zitat' }), {
      target: { value: 'Ja, schicken Sie mir das' },
    })
    expect(within(dialog).getByRole('textbox', { name: 'Adresse' })).toHaveValue('tobias.lindner@beispiel.de')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Erlaubnis erfassen' }))
    await waitFor(() => expect(patch()).toMatchObject({ email_consent_ref: { call_id: 'call-1' } }))
    vi.mocked(supabase.from).mockImplementation(basisFrom as typeof supabase.from)
  })
})

describe('ErlaubnisBadge', () => {
  it('Chip neutral + Zitat; none → danger „Keine Erlaubnis“; revoked → „Widerspruch“; > 12 Monate → overdue', () => {
    const lead = leadMitErlaubnis()
    rendern(<ErlaubnisBadge lead={lead} />)
    expect(screen.getByTestId('erlaubnis-chip')).toHaveTextContent('Per LinkedIn gebeten · Mo 05.10.')
    expect(screen.getByTestId('erlaubnis-badge')).toHaveTextContent('Hat gebeten um: ‚kurze Infos zu Solvio‘')
    expect(erlaubnisZustand(lead, '2026-10-15')).toMatchObject({ ton: 'neutral', veraltet: false, gesperrt: false })
    expect(erlaubnisZustand(leadMitErlaubnis({ email_consent_basis: 'none' }))).toMatchObject({
      ton: 'danger',
      label: 'Keine Erlaubnis',
      gesperrt: true,
    })
    expect(erlaubnisZustand(leadMitErlaubnis({ email_consent_basis: 'revoked' }))).toMatchObject({
      ton: 'danger',
      label: 'Widerspruch',
    })
    expect(erlaubnisZustand(lead, '2027-10-06')).toMatchObject({ ton: 'overdue', veraltet: true })
    expect(erlaubnisZustand({ ...lead, last_inbound_at: '2027-01-01T10:00:00Z' }, '2027-10-06')).toMatchObject({
      ton: 'neutral',
    })
    expect(erlaubnisZustand(leadMitErlaubnis({ email_consent_at: null })).label).toBe('Per LinkedIn gebeten')
  })

  it('public.ts: ErlaubnisBadge rendert den Chip; kompakt nur Chip; istEmailSequenzAktiv', () => {
    rendern(<BadgePublic lead={leadMitErlaubnis({ email_consent_basis: 'none' })} />)
    expect(screen.getByTestId('erlaubnis-chip')).toHaveTextContent('Keine Erlaubnis')
    expect(screen.getByText('Keine Erlaubnis-Grundlage')).toBeInTheDocument()
    expect(istEmailSequenzAktiv([{ channel: 'email', status: 'aktiv' }])).toBe(true)
    expect(
      istEmailSequenzAktiv([
        { channel: 'email', status: 'pausiert' },
        { channel: 'linkedin', status: 'aktiv' },
      ]),
    ).toBe(false)
    expect(istEmailSequenzAktiv(null)).toBe(false)
  })

  it('istSammeladresse', () => {
    expect(istSammeladresse('info@firma.de')).toBe(true)
    expect(istSammeladresse('Kontakt@firma.de')).toBe(true)
    expect(istSammeladresse('max.mustermann@firma.de')).toBe(false)
  })
})
