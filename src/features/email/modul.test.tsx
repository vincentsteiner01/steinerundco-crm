// modul.test.tsx: Verträge des Moduls (BAUPLAN § 3.0 Nr. 3, § 3.1.8) – befehle.ts (nur mit Lead sichtbar, ⌥M), tasten.ts (Anhang A),
// links.ts (Composer-URL, Rücksprung ohne Open Redirect), VerfassenSeite (Sheet, ohne Lead Leerzustand, Esc → zurück).
import { screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router'
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
import { useAuth } from '@/features/auth/authStore'
import { anzeigeNachBinding, VERBOTEN } from '@/lib/keyboard'
import { MEMBER_V } from '@/test/fixtures/leads'
import type { Member } from '@/types/domain'
import { LEAD_ID, rendern, taste, zuruecksetzen } from './_testHilfe'
import { BEFEHLE } from './befehle'
import { emailTabUrl, istEmailTab, sicheresZurueck, verfassenUrl } from './links'
import { TASTEN } from './tasten'
import { Component as VerfassenSeite } from './VerfassenSeite'

function Ort() {
  const l = useLocation()
  return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>
}

describe('befehle.ts / tasten.ts', () => {
  it('Lead-Befehle nur mit Lead sichtbar; ⌥M navigiert zum Composer mit zurueck', () => {
    const navigate = vi.fn()
    const me = { id: MEMBER_V } as Member
    const verfassen = BEFEHLE.find((b) => b.id === 'email-verfassen')
    expect(verfassen?.tasten).toEqual(['⌥M'])
    expect(verfassen?.sichtbar?.({ navigate, leadId: null, me })).toBe(false)
    expect(verfassen?.sichtbar?.({ navigate, leadId: LEAD_ID, me })).toBe(true)
    verfassen?.ausfuehren({ navigate, leadId: LEAD_ID, me })
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/email\/verfassen\?lead=.*&zurueck=/))
    for (const id of ['email-erlaubnis-erfassen', 'email-widerspruch-erfassen']) {
      const b = BEFEHLE.find((x) => x.id === id)
      expect(b?.sichtbar?.({ navigate, leadId: null, me })).toBe(false)
      b?.ausfuehren({ navigate, leadId: LEAD_ID, me })
    }
    expect(navigate).toHaveBeenLastCalledWith(expect.stringContaining('widerspruch=1'))
    expect(BEFEHLE.map((b) => b.label)).toContain('Erlaubnis erfassen …')
  })

  it('keine verbotene Taste, Gruppe „E-Mail“ mit ⌘↵, Esc, [', () => {
    expect(TASTEN[0]?.gruppe).toBe('E-Mail')
    const alle = TASTEN.flatMap((g) => g.eintraege.flatMap((e) => e.tasten))
    expect(alle).toEqual(expect.arrayContaining(['⌘↵', 'Esc', '[', '⌥M']))
    for (const t of alle) if (/[⌘⌥⇧]/.test(t)) expect(VERBOTEN).not.toContain(anzeigeNachBinding(t))
  })
})

describe('links.ts', () => {
  it('verfassenUrl kodiert alle Parameter; sicheresZurueck lehnt // und Hosts ab', () => {
    const u = verfassenUrl({
      leadId: 'L',
      vorlageId: 'V',
      enrollmentId: 'E',
      schrittId: 'S',
      zurueck: '/leads?lead=L',
      erlaubnis: true,
    })
    expect(u).toBe('/email/verfassen?lead=L&vorlage=V&schritt=S&enrollment=E&zurueck=%2Fleads%3Flead%3DL&erlaubnis=1')
    expect(sicheresZurueck('/leads?lead=1')).toBe('/leads?lead=1')
    expect(sicheresZurueck('//evil.de')).toBe('/email')
    expect(sicheresZurueck('https://evil.de')).toBe('/email')
    expect(sicheresZurueck(null)).toBe('/email')
    expect(emailTabUrl('gesendet')).toBe('/email?tab=gesendet')
    expect(istEmailTab('entwuerfe')).toBe(true)
    expect(istEmailTab('x')).toBe(false)
  })
})

describe('VerfassenSeite', () => {
  beforeEach(() => {
    zuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
  })

  it('Sheet 640 mit Composer über /email; Esc schließt und springt nach ?zurueck', async () => {
    rendern(
      <>
        <VerfassenSeite />
        <Ort />
      </>,
      `/email/verfassen?lead=${LEAD_ID}&zurueck=${encodeURIComponent('/email?tab=entwuerfe')}`,
    )
    const sheet = await screen.findByRole('dialog', { name: 'E-Mail verfassen' })
    await waitFor(() => expect(screen.getByTestId('composer')).toHaveAttribute('data-status', 'bearbeiten'))
    expect(sheet).toHaveStyle({ '--sheet-b': '640px' })
    expect(useUiStore.getState().hotkeyScope).toBe('formular')
    taste('Escape', {}, sheet)
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email?tab=entwuerfe'))
  })

  it('ohne ?lead: Leerzustand im Sheet; ungültiges zurueck → /email', async () => {
    rendern(
      <>
        <VerfassenSeite />
        <Ort />
      </>,
      '/email/verfassen?zurueck=//evil',
    )
    expect(await screen.findByText('Kein Lead gewählt.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('E-Mail')
    taste('Escape', {}, screen.getByRole('dialog'))
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email'))
    expect(screen.getByTestId('ort').textContent).not.toContain('evil')
  })
})
