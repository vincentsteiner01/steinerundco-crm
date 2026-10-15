// Sequenzen (E-03 nur Verzögerung/Leitfaden über M1-Editor, E-13, § 1.5 Nr. 35): Liste mit Kanal/Schritten/laufenden Leads,
// „A alt“ inaktiv, Aktivieren → sequences.active, Deaktivieren mit laufenden Leads fragt, ?id= öffnet den Editor.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))
vi.mock('@/features/sequenzen/public', () => ({
  SequenzEditor: ({ sequenceId }: { sequenceId: string }) => <div data-testid="editor">Editor {sequenceId}</div>,
}))

import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { SEQUENZEN } from '@/test/fixtures/sequenzen'
import { Sequenzen } from './Sequenzen'
import { letzterAufruf, MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)
const zeile = (id: string) => document.querySelector(`tr[data-id="${id}"]`) as HTMLElement

describe('Sequenzen', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    vonMock().mockClear()
    localStorage.clear()
  })

  it('listet alle Sequenzen mit Kanal, Schritten, laufenden Leads und Aktiv-Switch; „A alt“ ist inaktiv', async () => {
    rendern(<Sequenzen />, '/einstellungen/sequenzen')
    const tabelle = await screen.findByRole('table', { name: 'Sequenzen' })
    expect(within(tabelle).getAllByRole('row')).toHaveLength(SEQUENZEN.length + 1)
    const aAlt = zeile(SEQUENZEN[3]!.id)
    expect(within(aAlt).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(within(aAlt).getByText('Sheet-Regel')).toBeInTheDocument()
    const a = zeile(SEQUENZEN[0]!.id)
    expect(within(a).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(a).getAllByRole('cell')[2]).toHaveTextContent('6')
    expect(within(a).getAllByRole('cell')[3]).toHaveTextContent('2')
    expect(screen.getByRole('note')).toHaveTextContent('Alte Sheet-Regel')
  })

  it('E-13: „A alt“ aktivieren schreibt sequences.active = true', async () => {
    rendern(<Sequenzen />, '/einstellungen/sequenzen')
    await screen.findByRole('table', { name: 'Sequenzen' })
    fireEvent.click(within(zeile(SEQUENZEN[3]!.id)).getByRole('switch'))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'sequences', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'sequences', 'upsert') as Record<string, unknown>
    expect(u.key).toBe('linkedin_sheet_regel')
    expect(u.active).toBe(true)
    expect(u.steps).toBeUndefined()
  })

  it('Deaktivieren mit laufenden Leads fragt „n laufende Leads behalten ihre Schritte“, Bestätigen schreibt active = false', async () => {
    rendern(<Sequenzen />, '/einstellungen/sequenzen')
    await screen.findByRole('table', { name: 'Sequenzen' })
    fireEvent.click(within(zeile(SEQUENZEN[0]!.id)).getByRole('switch'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('2 laufende Leads behalten ihre Schritte')
    expect(letzterAufruf(vonMock(), 'sequences', 'upsert')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deaktivieren' }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'sequences', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'sequences', 'upsert') as Record<string, unknown>
    expect(u.key).toBe('linkedin_standard')
    expect(u.active).toBe(false)
  })

  it('Deaktivieren ohne laufende Leads schreibt sofort', async () => {
    rendern(<Sequenzen />, '/einstellungen/sequenzen')
    await screen.findByRole('table', { name: 'Sequenzen' })
    fireEvent.click(within(zeile(SEQUENZEN[1]!.id)).getByRole('switch'))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'sequences', 'upsert')).not.toBeNull())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Name öffnet den M1-Editor über ?id=, „Alle Sequenzen“/Esc führt zurück', async () => {
    const { router } = rendern(<Sequenzen />, '/einstellungen/sequenzen')
    fireEvent.click(await screen.findByRole('button', { name: /^A$/ }))
    expect(router.state.location.search).toBe(`?id=${SEQUENZEN[0]!.id}`)
    expect(await screen.findByTestId('editor')).toHaveTextContent(SEQUENZEN[0]!.id)
    fireEvent.click(screen.getByRole('button', { name: /Alle Sequenzen/ }))
    expect(router.state.location.search).toBe('')
    expect(await screen.findByRole('table', { name: 'Sequenzen' })).toBeInTheDocument()
  })

  it('Hinweis-Kasten lässt sich für heute ausblenden', async () => {
    rendern(<Sequenzen />, '/einstellungen/sequenzen')
    const note = await screen.findByRole('note')
    fireEvent.click(within(note).getByRole('button', { name: 'Ausblenden (heute)' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(localStorage.getItem('crm.einstellungen.hinweis-a-alt')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
