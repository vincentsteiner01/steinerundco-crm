// AnrufButton: Gate-Logik (LD-03), ⌘⇧K öffnet den Anruf-Screen oder zeigt den Grund (T-18)
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_M } from '@/test/fixtures/leads'

const stand = vi.hoisted(() => ({ lead: null as unknown, sperrliste: [] as unknown[] }))

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => {
    if (tabelle === 'leads') return { data: stand.lead, error: null }
    if (tabelle === 'sperrliste') return { data: stand.sperrliste, error: null }
    return h.antworten()(tabelle)
  })
})
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
}))

import { toastFehler } from '@/components/toast'
import { AnrufButton } from './public'
import { leadMitBezug, LEAD_A, LEAD_OHNE_NUMMER, rendern } from './_testHilfe'

const kombi = () => fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', metaKey: true, shiftKey: true })

describe('AnrufButton', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(toastFehler).mockClear()
    stand.sperrliste = []
  })

  it('LD-03: aktiv nur mit Nummer und Anrufgrund; ⌘⇧K navigiert zum Anruf-Screen', async () => {
    stand.lead = leadMitBezug(LEAD_A)
    const { router } = rendern(<AnrufButton leadId={LEAD_A.id} />, '/leads', '/leads')
    const btn = await screen.findByRole('button', { name: 'Anrufen' })
    await waitFor(() => expect(btn).toBeEnabled())
    kombi()
    expect(router.state.location.pathname).toBe(`/telefon/anruf/${LEAD_A.id}`)
  })

  it('ohne Nummer: deaktiviert mit Grund; ⌘⇧K zeigt den Grund als Toast', async () => {
    stand.lead = leadMitBezug(LEAD_OHNE_NUMMER)
    const { router } = rendern(<AnrufButton leadId={LEAD_OHNE_NUMMER.id} groesse="S" />, '/leads', '/leads')
    const btn = await screen.findByRole('button', { name: 'Anrufen – Keine Nummer' })
    expect(btn).toBeDisabled()
    kombi()
    expect(vi.mocked(toastFehler)).toHaveBeenCalledWith('Keine Nummer')
    expect(router.state.location.pathname).toBe('/leads')
  })

  it('Sperrlisten-Treffer und Firmensperre sperren den Button', async () => {
    stand.lead = leadMitBezug(LEAD_A, { companies: { do_not_contact: true } as never })
    rendern(<AnrufButton leadId={LEAD_A.id} />, '/leads', '/leads')
    expect(await screen.findByRole('button', { name: 'Anrufen – Firma gesperrt – nicht anrufen' })).toBeDisabled()
  })

  it('bei mehreren Buttons reagiert nur die Cursor-Zeile', async () => {
    stand.lead = leadMitBezug(LEAD_A)
    const { router } = rendern(
      <ul>
        <li aria-selected="false">
          <AnrufButton leadId="lead-x" />
        </li>
        <li aria-selected="true">
          <AnrufButton leadId={LEAD_A.id} />
        </li>
      </ul>,
      '/leads',
      '/leads',
    )
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Anrufen' })).toHaveLength(2))
    kombi()
    expect(router.state.location.pathname).toBe(`/telefon/anruf/${LEAD_A.id}`)
  })
})
