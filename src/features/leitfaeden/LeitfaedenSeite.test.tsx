// LeitfaedenSeite: Zustände (Laden, Fehler, leer, Daten), Kanal-Segment + ?kanal=, ?phase=-Chip, Suche (data-suche),
// J/K-Cursor + Detail rechts (Desktop), ↵ öffnet die Vollseite, mobil öffnet der Klick.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_V } from '@/test/fixtures/leads'
import { kette } from '@/test/supabaseMock'
import { ALLE, ERSTE_ID, rendern, setzeDesktop } from './_testHilfe'
import { Component as LeitfaedenSeite } from './LeitfaedenSeite'

const cursor = () => document.querySelector('[role="treeitem"][data-cursor]')

describe('LeitfaedenSeite', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    localStorage.clear()
    setzeDesktop(true)
    vi.mocked(supabase.from).mockClear()
  })

  it('Desktop: Kopf mit Kontext, Baum links, Detail rechts (erster Eintrag = Cursor)', async () => {
    rendern(<LeitfaedenSeite />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
    await screen.findByRole('tree', { name: 'Leitfäden' })
    expect(screen.getByText(/LinkedIn · 6 Phasen · 16 Leitfäden/)).toBeInTheDocument()
    expect(cursor()).toHaveTextContent('Gesprächseröffnung (V1)')
    const detail = await screen.findByRole('article')
    expect(detail).toHaveAttribute('data-leitfaden', ERSTE_ID)
    expect(within(detail).getByLabelText('Name')).toHaveValue('Gesprächseröffnung (V1)')
    expect(within(detail).getByLabelText('Text')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Kanal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leitfaden anlegen/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Leitfaden suchen')).toHaveAttribute('data-suche')
  })

  it('J/K bewegen den Cursor (Detail folgt), ↵ öffnet /leitfaeden/:id mit ?vorschau=', async () => {
    const { router } = rendern(<LeitfaedenSeite />, '/leitfaeden?vorschau=abc')
    await screen.findByRole('tree')
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(cursor()).toHaveTextContent('Gesprächseröffnung (V2)')
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(cursor()).toHaveTextContent('Gesprächseröffnung (V3)')
    fireEvent.keyDown(document.body, { key: 'k' })
    expect(cursor()).toHaveTextContent('Gesprächseröffnung (V2)')
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-leitfaden', ALLE[1]?.id))
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(router.state.location.pathname).toBe(`/leitfaeden/${ALLE[1]?.id}`)
    expect(router.state.location.search).toBe('?vorschau=abc')
  })

  it('?kanal=telefon zeigt den Telefon-Baum; Segment wechselt den Kanal und löscht ?phase=', async () => {
    const { router } = rendern(<LeitfaedenSeite />, '/leitfaeden?kanal=telefon&phase=mailbox')
    await screen.findByRole('tree')
    expect(screen.getByText(/Telefon · 10 Phasen · 10 Leitfäden/)).toBeInTheDocument()
    const tree = screen.getByRole('tree')
    expect(within(tree).getAllByRole('group')).toHaveLength(1)
    expect(within(tree).getByRole('group', { name: 'Mailbox' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
    await waitFor(() => expect(within(screen.getByRole('tree')).getAllByRole('group')).toHaveLength(10))
    expect(router.state.location.search).toBe('?kanal=telefon')
    fireEvent.click(within(screen.getByRole('group', { name: 'Kanal' })).getByRole('button', { name: /E-Mail/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?kanal=email'))
    expect(screen.getAllByRole('treeitem')).toHaveLength(10)
  })

  it('Suche filtert den Baum und setzt den Cursor auf den ersten Treffer', async () => {
    rendern(<LeitfaedenSeite />)
    await screen.findByRole('tree')
    fireEvent.change(screen.getByLabelText('Leitfaden suchen'), { target: { value: 'pitch' } })
    expect(screen.getAllByRole('treeitem')).toHaveLength(2)
    expect(cursor()).toHaveTextContent('Pitch A')
  })

  it('Mobil: nur der Baum, Klick öffnet die Vollseite', async () => {
    setzeDesktop(false)
    const { router } = rendern(<LeitfaedenSeite />)
    await screen.findByRole('tree')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('treeitem', { name: /Pitch B/ }))
    expect(router.state.location.pathname).toMatch(/^\/leitfaeden\/2000/)
  })

  it('Laden: Skeleton (Status); Fehler: Meldung + Erneut versuchen', async () => {
    vi.mocked(supabase.from).mockImplementation(
      (tabelle: string) =>
        kette(
          tabelle === 'templates'
            ? { data: null, error: { message: 'kaputt', code: '500' } }
            : { data: [], error: null },
        ) as never,
    )
    rendern(<LeitfaedenSeite />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await screen.findByText('Leitfäden konnten nicht geladen werden.')
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeInTheDocument()
  })

  it('Leer: Kein Leitfaden für den Kanal → Leerzustand mit „Leitfaden anlegen“ → /leitfaeden/neu?kanal=', async () => {
    vi.mocked(supabase.from).mockImplementation(
      (tabelle: string) =>
        kette(
          tabelle === 'templates'
            ? { data: ALLE.filter((t) => t.channel !== 'email'), error: null }
            : { data: [], error: null },
        ) as never,
    )
    const { router } = rendern(<LeitfaedenSeite />, '/leitfaeden?kanal=email')
    await screen.findByText('Noch kein Leitfaden für E-Mail.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Leitfaden anlegen' }).at(-1) as HTMLElement)
    expect(router.state.location.pathname).toBe('/leitfaeden/neu')
    expect(router.state.location.search).toBe('?kanal=email')
  })
})
