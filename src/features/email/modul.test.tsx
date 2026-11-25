// modul.test.tsx: Verträge des Moduls (BAUPLAN § 3.0 Nr. 3) – links.ts (Composer-URL, Rücksprung ohne Open Redirect),
// VerfassenSeite (Sheet, ohne Lead Leerzustand, Esc → zurück). befehle.ts/tasten.ts sind mit der Palette entfallen (25.11.2026).
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
import { MEMBER_V } from '@/test/fixtures/leads'
import { LEAD_ID, rendern, taste, zuruecksetzen } from './_testHilfe'
import { emailTabUrl, istEmailTab, sicheresZurueck, verfassenUrl } from './links'
import { Component as VerfassenSeite } from './VerfassenSeite'

function Ort() {
  const l = useLocation()
  return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>
}

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
