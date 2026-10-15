// Vorschau (LF-03): Lead wählen (Suche), Platzhalter gefüllt/offen (Amber), manuelle Felder, Kopieren gesperrt bis alles gefüllt,
// `C` kopiert den gefüllten Text, Lead aus `?vorschau=` (gesteuert).
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_V } from '@/test/fixtures/leads'
import { LEAD, rendern } from './_testHilfe'
import { Vorschau } from './Vorschau'

const offen = () => document.querySelectorAll('[data-ph="offen"]')
const gefuellt = () => document.querySelectorAll('[data-ph="gefuellt"]')

describe('Vorschau', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    vi.mocked(toast).mockClear()
    vi.mocked(navigator.clipboard.writeText).mockClear()
  })

  it('ohne Lead bleiben Lead-Platzhalter offen (Amber), Absender-Platzhalter sind gefüllt; Kopieren gesperrt', async () => {
    rendern(<Vorschau kanal="linkedin" subject="" body="Hallo [Vorname] von [Unternehmen], Gruß [Absender Vorname]" />)
    await waitFor(() => expect(gefuellt()).toHaveLength(1))
    expect(gefuellt()[0]).toHaveTextContent('Vincent')
    expect(offen()).toHaveLength(2)
    expect(offen()[0]).toHaveTextContent('[Vorname]')
    expect(screen.getByText('ohne Lead')).toBeInTheDocument()
    const kopieren = screen.getByRole('button', { name: /Kopieren/ })
    expect(kopieren).toBeDisabled()
    expect(screen.getByLabelText('Erst [Vorname] eintragen')).toBeInTheDocument()
    expect(screen.getByText(/1\/3/)).toHaveClass('text-overdue')
  })

  it('Lead per Suche wählen: Platzhalter werden gefüllt, Literal „Frau [Nachname]“ auch; C kopiert den gefüllten Text', async () => {
    rendern(<Vorschau kanal="linkedin" subject="" body="Hallo Frau [Nachname] von [Unternehmen] in [Stadt]" />)
    const suche = screen.getByLabelText('Lead für die Vorschau suchen')
    fireEvent.change(suche, { target: { value: 'Nora' } })
    const treffer = await screen.findByRole('option', { name: /Test Person 01/ })
    fireEvent.click(treffer)
    await waitFor(() => expect(offen()).toHaveLength(0))
    expect(gefuellt()).toHaveLength(4) // Anrede, Nachname, Unternehmen, Stadt
    expect(screen.getByText('Frau')).toHaveAttribute('title', 'aus Anrede')
    expect(screen.getByText('Beispiel')).toHaveAttribute('title', 'aus Nachname')
    expect(screen.getByText(/4\/4/)).toBeInTheDocument()
    const kopieren = screen.getByRole('button', { name: /Kopieren/ })
    expect(kopieren).toBeEnabled()
    fireEvent.keyDown(document.body, { key: 'c' })
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hallo Frau Beispiel von Solar 01 GmbH in Hamburg'),
    )
    expect(toast).toHaveBeenCalledWith('Kopiert.')
    await screen.findByText('Kopiert')
    // Lead entfernen → wieder offen
    fireEvent.click(screen.getByRole('button', { name: 'Lead entfernen' }))
    await waitFor(() => expect(offen().length).toBeGreaterThan(0))
  })

  it('manuelle Platzhalter: Feld füllt [Reaktion]; C ohne vollständige Füllung zeigt den Grund als Toast', async () => {
    rendern(<Vorschau kanal="linkedin" subject="" body="Danke – [Reaktion]" />)
    expect(offen()).toHaveLength(1)
    fireEvent.keyDown(document.body, { key: 'c' })
    expect(toast).toHaveBeenCalledWith('Erst [Reaktion] eintragen.')
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    const feld = screen.getByPlaceholderText('Reaktion eintragen')
    fireEvent.change(feld, { target: { value: 'passt' } })
    expect(offen()).toHaveLength(0)
    expect(gefuellt()[0]).toHaveTextContent('passt')
    expect(screen.getByRole('button', { name: /Kopieren/ })).toBeEnabled()
  })

  it('gesteuert über leadId (`?vorschau=`): Lead wird geladen, Name steht im Kopf; E-Mail zeigt Betreff im Block', async () => {
    const onLead = vi.fn()
    rendern(
      <Vorschau
        kanal="email"
        subject="Hallo [Vorname]"
        body="Text [Signatur]"
        leadId={LEAD.id}
        onLeadChange={onLead}
      />,
    )
    await screen.findByText('Test Person 01')
    await waitFor(() => expect(offen()).toHaveLength(0))
    expect(screen.getByText('Nora')).toHaveAttribute('title', 'aus Vorname')
    expect(screen.getByText('Viele Grüße')).toHaveAttribute('title', 'aus Signatur')
    fireEvent.click(screen.getByRole('button', { name: 'Lead entfernen' }))
    expect(onLead).toHaveBeenCalledWith(null)
  })
})
