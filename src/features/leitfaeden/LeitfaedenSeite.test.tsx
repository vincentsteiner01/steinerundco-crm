// LeitfaedenSeite (23.10.2026, Mikes Sales Hub): Bereiche, Kategorien mit Karten, Lesefenster (?id=), Sterne bewerten,
// Bearbeiten-Fenster mit Formatleiste (Telefon & Sales), neuer Leitfaden aus „+ Leitfaden“ einer Kategorie.
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
import { MEMBER_V } from '@/test/fixtures/leads'
import { ALLE, ERSTE_ID, rendern, setzeDesktop } from './_testHilfe'
import { Component as LeitfaedenSeite } from './LeitfaedenSeite'

const upserts = () =>
  vi
    .mocked(supabase.from)
    .mock.results.map((r) => r.value as { upsert?: ReturnType<typeof vi.fn> })
    .flatMap((b) => (b.upsert && vi.isMockFunction(b.upsert) ? b.upsert.mock.calls.map((c) => c[0]) : []))

describe('LeitfaedenSeite', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    localStorage.clear()
    setzeDesktop(true)
    vi.mocked(supabase.from).mockClear()
  })

  it('LinkedIn: Kategorien als Abschnitte, Karten mit Auszug und Sternen, „Leitfaden schreiben“', async () => {
    rendern(<LeitfaedenSeite />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
    const eroeffnung = await screen.findByRole('region', { name: 'Gesprächseröffnung' })
    expect(within(eroeffnung).getByRole('heading', { name: /Gesprächseröffnung \(3\)/ })).toBeInTheDocument()
    const karte = eroeffnung.querySelector(`[data-leitfaden="${ERSTE_ID}"]`) as HTMLElement
    expect(karte).toHaveTextContent('Gesprächseröffnung (V1)')
    expect(karte).toHaveTextContent('Hallo [Vorname], [Unternehmen] in [Stadt]')
    expect(within(karte).getByText('Noch nicht bewertet')).toBeInTheDocument()
    // inaktive Variante steht hinten und ist markiert
    const namen = [...eroeffnung.querySelectorAll('[data-leitfaden] button.text-left')].map((b) => b.textContent)
    expect(namen.at(-1)).toBe('Gesprächseröffnung (V2)')
    expect(screen.getByRole('button', { name: /Leitfaden schreiben/ })).toBeInTheDocument()
  })

  it('?kanal=telefon: Mikes Kategorien – Telefonakquise mit allen Telefon-Phasen, leere Sales-Kategorie', async () => {
    rendern(<LeitfaedenSeite />, '/leitfaeden?kanal=telefon')
    const akquise = await screen.findByRole('region', { name: 'Telefonakquise' })
    expect(akquise.querySelectorAll('[data-leitfaden]')).toHaveLength(
      ALLE.filter((t) => t.channel === 'telefon').length,
    )
    // Phase klein über dem Titel, Reihenfolge wie im Skript (Zentrale zuerst)
    expect(akquise.querySelector('[data-leitfaden]')).toHaveTextContent(/^Zentrale/)
    expect(
      within(screen.getByRole('region', { name: 'Erstgespräch' })).getByText(
        'Noch keine Leitfäden in dieser Kategorie.',
      ),
    ).toBeInTheDocument()
  })

  it('Karte öffnet das Lesefenster (?id=), Sterne bewerten, Bearbeiten öffnet den Editor', async () => {
    const { router } = rendern(<LeitfaedenSeite />)
    const eroeffnung = await screen.findByRole('region', { name: 'Gesprächseröffnung' })
    fireEvent.click(within(eroeffnung).getByRole('button', { name: 'Gesprächseröffnung (V1)' }))
    await waitFor(() => expect(router.state.location.search).toContain(`id=${ERSTE_ID}`))
    const fenster = await screen.findByRole('dialog')
    expect(within(fenster).getByRole('heading', { name: 'Gesprächseröffnung (V1)' })).toBeInTheDocument()
    expect(within(fenster).getByText('Gesprächseröffnung')).toBeInTheDocument()
    fireEvent.click(within(fenster).getByRole('button', { name: '2 von 3 Sternen' }))
    await waitFor(() => expect(upserts()).toContainEqual(expect.objectContaining({ id: ERSTE_ID, rating: 2 })))
    expect(within(fenster).getByRole('button', { name: /Kopieren/ })).toBeInTheDocument()
    fireEvent.click(within(fenster).getByRole('button', { name: /Bearbeiten/ }))
    const editor = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    expect(within(editor).getByLabelText(/Titel/)).toHaveValue('Gesprächseröffnung (V1)')
    // LinkedIn-Texte gehen so raus, wie sie stehen – keine Formatleiste
    expect(within(editor).queryByRole('toolbar', { name: 'Formatierung' })).toBeNull()
  })

  it('Telefon: „+ Leitfaden“ einer Kategorie → Editor mit Formatleiste; Fett-Knopf setzt **…**; Speichern legt an', async () => {
    rendern(<LeitfaedenSeite />, '/leitfaeden?kanal=telefon')
    const erst = await screen.findByRole('region', { name: 'Erstgespräch' })
    fireEvent.click(within(erst).getByRole('button', { name: /Leitfaden/ }))
    const editor = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
    expect(within(editor).getByLabelText('Kategorie')).toHaveValue('sonstiges:erstgespraech')
    fireEvent.change(within(editor).getByLabelText(/Titel/), { target: { value: 'Ablauf Erstgespräch' } })
    const text = within(editor).getByLabelText('Text') as HTMLTextAreaElement
    fireEvent.change(text, { target: { value: 'Ziel des Gesprächs' } })
    text.setSelectionRange(0, 4)
    fireEvent.click(
      within(within(editor).getByRole('toolbar', { name: 'Formatierung' })).getByRole('button', { name: 'Fett' }),
    )
    await waitFor(() => expect(text).toHaveValue('**Ziel** des Gesprächs'))
    fireEvent.click(within(editor).getByRole('button', { name: /Speichern/ }))
    await waitFor(() =>
      expect(upserts()).toContainEqual(
        expect.objectContaining({
          channel: 'sonstiges',
          phase: 'erstgespraech',
          name: 'Ablauf Erstgespräch',
          body: '**Ziel** des Gesprächs',
          active: true,
        }),
      ),
    )
  })

  it('Fehler beim Laden → Leerzustand mit „Erneut versuchen“', async () => {
    vi.mocked(supabase.from).mockImplementationOnce(
      () =>
        ({
          select: () => ({
            order: () => ({
              order: () => ({ order: () => ({ order: async () => ({ data: null, error: { message: 'kaputt' } }) }) }),
            }),
          }),
        }) as never,
    )
    rendern(<LeitfaedenSeite />)
    expect(await screen.findByText('Leitfäden konnten nicht geladen werden.')).toBeInTheDocument()
  })
})
