// E-01 (BAUPLAN § 3.9 Passcode.test.tsx): ≥ 10 Zeichen, ungleich alt, Wiederholung; Erfolg → Re-Auth, updateUser, signOut(others).
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { Passcode } from './Passcode'
import { MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

const signIn = vi.mocked(supabase.auth.signInWithPassword)
const updateUser = vi.mocked(supabase.auth.updateUser)
const signOut = vi.mocked(supabase.auth.signOut)

function tippen(aktuell: string, neu: string, wdh: string) {
  fireEvent.change(screen.getByLabelText('Aktueller Passcode'), { target: { value: aktuell } })
  fireEvent.change(screen.getByLabelText('Neuer Passcode'), { target: { value: neu } })
  fireEvent.change(screen.getByLabelText('Neuen Passcode wiederholen'), { target: { value: wdh } })
  fireEvent.click(screen.getByRole('button', { name: /Passcode ändern/ }))
}

describe('Passcode', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    signIn.mockClear()
    updateUser.mockClear()
    signOut.mockClear()
    signIn.mockResolvedValue({ data: { session: null, user: null }, error: null } as never)
  })

  it('zeigt drei Felder, Checkbox „Andere Geräte abmelden“ (an) und den deaktivierten Reset der anderen Person', () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    expect(screen.getByLabelText('Aktueller Passcode')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Andere Geräte abmelden')).toBeChecked()
    const reset = screen.getByRole('button', { name: /zurücksetzen/ })
    expect(reset).toBeDisabled()
    expect(screen.getByLabelText('Kommt in v1.1 – bis dahin: Lead fragen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Passcode ändern/ })).toBeDisabled()
  })

  it('unter 10 Zeichen → Fehler am neuen Feld, kein Request', () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    tippen('alterpasscode', 'kurz', 'kurz')
    expect(screen.getByRole('alert')).toHaveTextContent('Mindestens 10 Zeichen')
    expect(signIn).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('neuer Passcode gleich dem alten → Fehler', () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    tippen('gleichgleich12', 'gleichgleich12', 'gleichgleich12')
    expect(screen.getByRole('alert')).toHaveTextContent('unterscheiden')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('Wiederholung weicht ab → Fehler', () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    tippen('alterpasscode', 'neuerpasscode1', 'neuerpasscode2')
    expect(screen.getByRole('alert')).toHaveTextContent('Wiederholung')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('gültig → Re-Auth mit altem Passcode, updateUser mit neuem, signOut(others); Felder geleert', async () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    tippen('alterpasscode', 'neuerpasscode1', 'neuerpasscode1')
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'neuerpasscode1' }))
    expect(signIn).toHaveBeenCalledWith({ email: 'v@example.test', password: 'alterpasscode' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
    await waitFor(() => expect(screen.getByLabelText('Neuer Passcode')).toHaveValue(''))
  })

  it('Auge-Toggle zeigt den Passcode im Klartext', () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    fireEvent.click(screen.getAllByRole('button', { name: 'Passcode anzeigen' })[0]!)
    expect(screen.getByLabelText('Aktueller Passcode')).toHaveAttribute('type', 'text')
  })

  it('„Überall abmelden“ öffnet den Dialog, Bestätigen ruft signOut(global)', async () => {
    rendern(<Passcode />, '/einstellungen/passcode')
    fireEvent.click(screen.getByRole('button', { name: 'Überall abmelden' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Akten-Sitzung')
    fireEvent.click(screen.getByRole('button', { name: 'Überall abmelden', hidden: false }))
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'global' }))
  })
})
