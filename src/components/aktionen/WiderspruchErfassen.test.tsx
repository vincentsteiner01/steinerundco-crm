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
})
