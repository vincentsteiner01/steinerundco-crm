// Palette-Befehle und Tasten-Registry M3 (BAUPLAN § 3.4: „Call-Block starten“, „Rückruf planen für …“, „Anrufgrund setzen …“)
import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Befehl } from '@/app/befehle'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
}))

import { toast } from '@/components/toast'
import { queryClient } from '@/data/queryClient'
import { qk } from '@/data/queryKeys'
import { BEFEHLE } from './befehle'
import { LEAD_A, leadMitBezug } from './_testHilfe'
import { TASTEN } from './tasten'

type Ctx = Parameters<Befehl['ausfuehren']>[0]

function ausfuehren(id: string, leadId: string | null) {
  const b = BEFEHLE.find((x) => x.id === id)
  if (!b) throw new Error(id)
  const navigate = vi.fn()
  const ctx = { navigate, leadId } as unknown as Ctx
  const sichtbar = b.sichtbar ? b.sichtbar(ctx) : true
  if (sichtbar) b.ausfuehren(ctx)
  return { navigate, sichtbar }
}

describe('BEFEHLE (Telefon)', () => {
  it('„Call-Block starten“ öffnet /telefon?block=start', () => {
    expect(ausfuehren('telefon:callblock', null).navigate).toHaveBeenCalledWith('/telefon?block=start')
  })

  beforeEach(() => {
    queryClient.clear()
    vi.mocked(toast).mockClear()
    queryClient.setQueryData(qk.sperrliste, [])
  })

  it('Anrufen ⌘⇧K prüft das Telefon-Gate (§ 8.2 Nr. 2): offen → Anruf-Screen', async () => {
    queryClient.setQueryData(qk.leads.detail('l1'), leadMitBezug({ ...LEAD_A, id: 'l1' }))
    const { navigate } = ausfuehren('telefon:anrufen', 'l1')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/telefon/anruf/l1'))
  })

  it('Anrufen ⌘⇧K ohne Anrufgrund oder mit Sperrlisten-Treffer: Grund als Toast, kein Anruf-Screen (Review)', async () => {
    queryClient.setQueryData(qk.leads.detail('l1'), leadMitBezug({ ...LEAD_A, id: 'l1', call_basis: null }))
    const ohne = ausfuehren('telefon:anrufen', 'l1')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Nummer ohne Anrufgrund'))
    expect(ohne.navigate).not.toHaveBeenCalled()

    queryClient.setQueryData(qk.leads.detail('l2'), leadMitBezug({ ...LEAD_A, id: 'l2' }))
    queryClient.setQueryData(qk.sperrliste, [{ id: 's1', phone_e164: LEAD_A.phone_e164, channels: ['telefon'] }])
    const gesperrt = ausfuehren('telefon:anrufen', 'l2')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Auf der Sperrliste'))
    expect(gesperrt.navigate).not.toHaveBeenCalled()
  })

  it('Lead-Befehle nur mit Lead: Rückruf planen, Anrufgrund setzen', () => {
    expect(ausfuehren('telefon:anrufen', null).sichtbar).toBe(false)
    expect(ausfuehren('telefon:rueckruf', 'l1').navigate).toHaveBeenCalledWith('/telefon?rueckruf=l1')
    window.history.pushState({}, '', '/telefon')
    expect(ausfuehren('telefon:anrufgrund', 'l1').navigate).toHaveBeenCalledWith('/telefon?anrufgrund=l1')
    window.history.pushState({}, '', '/leads')
    expect(ausfuehren('telefon:anrufgrund', 'l1').sichtbar).toBe(false)
    expect(ausfuehren('telefon:rueckruf', null).sichtbar).toBe(false)
  })

  it('Tasten-Registry nennt die Scopes Anrufliste und Anruf-Screen mit allen Ergebnis-Tasten', () => {
    const alle = TASTEN.flatMap((g) => g.eintraege.flatMap((e) => e.tasten))
    expect(TASTEN.map((g) => g.gruppe)).toEqual(['Telefon – Anrufliste', 'Anruf-Screen'])
    for (const t of ['R', 'S', 'N', '⌘⇧K', '⌘⇧X', '⌘↵', 'Esc', '1–9 0 X W K Q D']) expect(alle).toContain(t)
  })
})
