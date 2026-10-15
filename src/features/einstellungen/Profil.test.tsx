// Profil (ux § 3.10 Nr. 1, E-11): Werte aus crm.members, Rufnummer → E.164, LinkedIn-Plan → Wochenbudget-Vorschlag (nur Feld),
// Kanäle/Benachrichtigungen in preferences, Upsert der eigenen member_profiles-Zeile.
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
import { Profil } from './Profil'
import { anzahlAufrufe, letzterAufruf, MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)
type Upsert = Record<string, unknown> & { preferences: { kanaele: Record<string, boolean>; realtime_toasts: boolean } }

describe('Profil', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    vonMock().mockClear()
  })

  it('zeigt Anzeigename/E-Mail read-only, Kürzel, Plan, Rufnummer formatiert, Kanäle aus preferences', async () => {
    rendern(<Profil />)
    expect(await screen.findByLabelText('Anzeigename')).toHaveValue('Vincent')
    expect(screen.getByLabelText('Anzeigename')).toBeDisabled()
    expect(screen.getByLabelText('E-Mail', { selector: 'input' })).toHaveValue('v@example.test')
    expect(screen.getByLabelText('Kürzel')).toHaveValue('VS')
    expect(screen.getByLabelText('LinkedIn-Plan')).toHaveValue('premium')
    expect(screen.getByLabelText('Rufnummer')).toHaveValue('+49 40 123456')
    expect(screen.getByRole('switch', { name: 'LinkedIn' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Telefon' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Realtime-Toasts' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/nie unterdrückt anrufen/)).toBeInTheDocument()
  })

  it('E-11: Rufnummer-Eingabe wird beim Verlassen formatiert und als E.164 gespeichert', async () => {
    rendern(<Profil />)
    const tel = await screen.findByLabelText('Rufnummer')
    fireEvent.change(tel, { target: { value: '0151 23456789' } })
    fireEvent.blur(tel)
    expect(tel).toHaveValue('+49 1512 3456789')
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern/ })[0]!)
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Upsert
    expect(u.member_id).toBe(MEMBER_V)
    expect(u.caller_number_e164).toBe('+4915123456789')
    expect(u.short_name).toBe('VS')
    expect(u.linkedin_plan).toBe('premium')
    expect(u.preferences.kanaele).toEqual({ linkedin: true, telefon: false, email: true })
  })

  it('unvollständige Rufnummer → „Nummer unvollständig“, kein Upsert', async () => {
    rendern(<Profil />)
    const tel = await screen.findByLabelText('Rufnummer')
    fireEvent.change(tel, { target: { value: '12' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern/ })[0]!)
    expect(screen.getByRole('alert')).toHaveTextContent('Nummer unvollständig')
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(0)
  })

  it('LinkedIn-Plan wechseln zeigt den Wochenbudget-Vorschlag und ändert nur das Feld', async () => {
    rendern(<Profil />)
    const plan = await screen.findByLabelText('LinkedIn-Plan')
    fireEvent.change(plan, { target: { value: 'sales_navigator' } })
    expect(screen.getByText('Vorschlag für Sales Navigator: 200')).toBeInTheDocument()
    expect(screen.getByLabelText('Wochenbudget Anfragen')).toHaveValue('150')
    fireEvent.click(screen.getByRole('button', { name: '200 übernehmen' }))
    expect(screen.getByLabelText('Wochenbudget Anfragen')).toHaveValue('200')
    expect(screen.queryByText(/Vorschlag für/)).not.toBeInTheDocument()
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(0)
  })

  it('Kanal-Switch und Realtime-Toasts landen in preferences, fremde Keys bleiben', async () => {
    rendern(<Profil />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Telefon' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Realtime-Toasts' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern/ })[1]!)
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Upsert
    expect(u.preferences.kanaele.telefon).toBe(true)
    expect(u.preferences.realtime_toasts).toBe(false)
  })

  it('Speichern ist ohne Änderung deaktiviert („Nichts geändert“)', async () => {
    rendern(<Profil />)
    const knopf = () => screen.getAllByRole('button', { name: /Speichern/ })[0]!
    await screen.findByLabelText('Kürzel')
    expect(knopf()).toBeDisabled()
    expect(screen.getAllByLabelText('Nichts geändert').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'vs' } })
    expect(screen.getByLabelText('Kürzel')).toHaveValue('VS')
    expect(knopf()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'v' } })
    expect(knopf()).toBeEnabled()
  })
})
