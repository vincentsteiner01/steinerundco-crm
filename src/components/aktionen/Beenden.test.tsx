// Beenden: `B` öffnet das Grund-Popover (kein Dialog, ux § 4.8), 1–9 → useLeadUpdate({ stage: 'beendet', ended_reason, ended_note }),
// Grund ist Pflicht (Sonstiges braucht eine Notiz), Undo über die stage_wechsel-Aktivität (BAUPLAN § 3.1.10b).
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
import { toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { MEMBER_V } from '@/test/fixtures/leads'
import { AKTIVITAET_ID, LEAD, letzterAufruf, rendern, taste } from './_testHilfe'
import { Beenden } from './Beenden'
import { beendenGruende } from './gruende'

const patch = () => letzterAufruf(supabase.from, 'leads', 'update')

describe('Beenden', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toastUndo).mockClear()
  })

  it('Gründe-Tabelle: 9 Einträge, Sonderfälle auf Enum + Notiz abgebildet', () => {
    const g = beendenGruende()
    expect(g.map((x) => x.kbd)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(g[4]).toMatchObject({ reason: 'sonstiges', note: 'Hat bereits Partner' })
    expect(g[5]).toMatchObject({ reason: 'kein_bedarf', note: 'Kennt das Problem nicht' })
    expect(g[6]).toMatchObject({ reason: 'nicht_icp', note: 'Eigenes Portfolio' })
    expect(g[7]).toMatchObject({ reason: 'kein_interesse', note: 'Keine Reaktion nach Sequenz' })
    expect(g[8]).toMatchObject({ reason: 'sonstiges', notizPflicht: true })
  })

  it('`B` öffnet das Popover; `1` beendet mit Kein Bedarf und bietet Rückgängig an', async () => {
    const onFertig = vi.fn()
    rendern(<Beenden leadId={LEAD.id} aktiv onFertig={onFertig} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Beenden/ })).toBeEnabled())
    taste('b')
    const menu = await screen.findByRole('menu', { name: 'Beenden – Grund' })
    expect(menu).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(9)
    taste('1')
    await waitFor(() => expect(patch()).toEqual({ stage: 'beendet', ended_reason: 'kein_bedarf', ended_note: null }))
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith('Beendet · Kein Bedarf.', AKTIVITAET_ID))
    expect(onFertig).toHaveBeenCalled()
  })

  it('`5` Hat Partner → sonstiges + Note', async () => {
    rendern(<Beenden leadId={LEAD.id} aktiv />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Beenden/ })).toBeEnabled())
    taste('b')
    await screen.findByRole('menu', { name: 'Beenden – Grund' })
    fireEvent.click(screen.getByRole('menuitem', { name: /Hat Partner/ }))
    await waitFor(() =>
      expect(patch()).toEqual({ stage: 'beendet', ended_reason: 'sonstiges', ended_note: 'Hat bereits Partner' }),
    )
  })

  it('Grund Pflicht: Sonstiges ohne Notiz speichert nicht, mit Notiz schon', async () => {
    rendern(<Beenden leadId={LEAD.id} aktiv />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Beenden/ })).toBeEnabled())
    taste('b')
    await screen.findByRole('menu', { name: 'Beenden – Grund' })
    taste('9')
    const feld = await screen.findByRole('textbox', { name: 'Notiz' })
    expect(screen.getByRole('button', { name: /^Beenden\s*⌘/ })).toBeDisabled()
    taste('Enter', { metaKey: true }, feld)
    expect(patch()).toBeNull()
    fireEvent.change(feld, { target: { value: 'Firma wird verkauft' } })
    taste('Enter', { metaKey: true }, feld)
    await waitFor(() =>
      expect(patch()).toEqual({ stage: 'beendet', ended_reason: 'sonstiges', ended_note: 'Firma wird verkauft' }),
    )
  })

  it('ohne `aktiv` reagiert `B` nicht; eigener trigger öffnet per Klick', async () => {
    rendern(<Beenden leadId={LEAD.id} trigger={<button type="button">Eigen</button>} />)
    taste('b')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eigen' }))
    expect(await screen.findByRole('menu', { name: 'Beenden – Grund' })).toBeInTheDocument()
  })
})
