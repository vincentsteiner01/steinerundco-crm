// Widerspruch erfassen (BAUPLAN § 8.1 Nr. 6, § 8.2 Nr. 7): Zitat Pflicht, Umfang, und der Lead endet „beendet · widerspruch“ –
// kein Trigger setzt die Stufe auf diesem Weg (Review-Korrektur).
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

import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_V } from '@/test/fixtures/leads'
import { LEAD, letzterAufruf, rendern } from './_testHilfe'
import { WiderspruchErfassen } from './WiderspruchErfassen'

describe('WiderspruchErfassen', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('beendet den Lead mit Grund „widerspruch“ und schreibt Kanal-Umfang + Zitat', async () => {
    rendern(<WiderspruchErfassen leadId={LEAD.id} />)
    const knopf = await screen.findByRole('button', { name: 'Widerspruch erfassen' })
    await waitFor(() => expect(knopf).toBeEnabled())
    fireEvent.click(knopf)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: /nur E-Mail/ }))
    fireEvent.change(within(dialog).getByLabelText(/Zitat/), { target: { value: 'Bitte keine Mails mehr' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Widerspruch erfassen' }))
    await waitFor(() => expect(letzterAufruf(supabase.from, 'leads', 'update')).not.toBeNull())
    expect(letzterAufruf(supabase.from, 'leads', 'update')).toEqual({
      do_not_contact: true,
      do_not_contact_channels: ['email'],
      objection_note: 'Bitte keine Mails mehr',
      stage: 'beendet',
      ended_reason: 'widerspruch',
      ended_note: 'Bitte keine Mails mehr',
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Widerspruch erfasst · nur E-Mail.'))
  })

  it('ohne Zitat wird nichts gespeichert', async () => {
    rendern(<WiderspruchErfassen leadId={LEAD.id} />)
    const knopf = await screen.findByRole('button', { name: 'Widerspruch erfassen' })
    await waitFor(() => expect(knopf).toBeEnabled())
    fireEvent.click(knopf)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Widerspruch erfassen' }))
    expect(await within(dialog).findByText('Zitat ist Pflicht.')).toBeInTheDocument()
    expect(letzterAufruf(supabase.from, 'leads', 'update')).toBeNull()
  })

  it('ohne `schlicht` (E-Mail-Bereich) wie vor dem Neustart: Ziffern-Marken, langer Text, blauer Knopf in 36 px', async () => {
    rendern(<WiderspruchErfassen leadId={LEAD.id} />)
    const knopf = await screen.findByRole('button', { name: 'Widerspruch erfassen' })
    await waitFor(() => expect(knopf).toBeEnabled())
    fireEvent.click(knopf)
    const dialog = await screen.findByRole('dialog')
    expect([...dialog.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['1', '2', '3'])
    expect(dialog).toHaveTextContent('alle Sequenzen enden')
    const ja = within(dialog).getByRole('button', { name: 'Widerspruch erfassen' })
    expect(ja).toHaveClass('bg-signal', 'h-9')
    expect(ja).not.toHaveClass('bg-danger')
  })

  it('`schlicht` (Lead-Blatt, 25.11.2026): keine Tastenmarken, ein kurzer Satz, Knöpfe 44 px – gespeichert wird dasselbe', async () => {
    rendern(<WiderspruchErfassen schlicht leadId={LEAD.id} trigger={<button type="button">Öffnen</button>} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Öffnen' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('kbd')).toBeNull()
    expect(dialog).toHaveTextContent('Die Person kommt auf die Sperrliste und wird nicht mehr kontaktiert.')
    expect(dialog).not.toHaveTextContent('Sequenzen')
    expect(dialog).not.toHaveTextContent('importiert')
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['nur Telefon', 'nur E-Mail', 'alle Kanäle'])
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toHaveClass('h-11')
    const ja = within(dialog).getByRole('button', { name: 'Widerspruch erfassen' })
    expect(ja).toHaveClass('h-11')
    // die Ziffern wählen hier nichts: der Umfang bleibt „alle Kanäle“
    fireEvent.keyDown(document.body, { key: '1' })
    expect(within(dialog).getByRole('radio', { name: 'alle Kanäle' })).toBeChecked()
    fireEvent.change(within(dialog).getByLabelText(/Zitat/), { target: { value: 'Bitte nicht mehr melden' } })
    await waitFor(() => expect(ja).toBeEnabled())
    fireEvent.click(ja)
    await waitFor(() => expect(letzterAufruf(supabase.from, 'leads', 'update')).not.toBeNull())
    expect(letzterAufruf(supabase.from, 'leads', 'update')).toMatchObject({
      do_not_contact: true,
      do_not_contact_channels: ['linkedin', 'telefon', 'email'],
      objection_note: 'Bitte nicht mehr melden',
    })
  })
})
