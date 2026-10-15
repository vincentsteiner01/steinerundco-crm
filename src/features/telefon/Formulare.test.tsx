// Kleine Formulare der Telefon-Seite: „Anrufgrund setzen“ (BAUPLAN § 3.4 Gate, § 8.2 Nr. 1, § 1.5 Nr. 14) und „Rückruf planen“
// (Palette-Befehl). Pflichtfelder, Vorbelegung aus dem LinkedIn-Zustand, Schreibzugriffe, ⌘↵.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { heuteBerlin } from '@/lib/format'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import { MEMBER_M } from '@/test/fixtures/leads'

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => {
    if (tabelle === 'leads') return { data: h.LEAD_OHNE_GRUND, error: null }
    if (tabelle === 'activities') return { data: { id: 1, lead_id: h.LEAD_OHNE_GRUND.id }, error: null }
    if (tabelle === 'tasks') return { data: { id: 't1', lead_id: h.LEAD_A.id }, error: null }
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

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { anrufgrundVorbelegung, HINWEIS_NUR_VERNETZT } from './anrufgrund'
import { AnrufgrundSetzen } from './AnrufgrundSetzen'
import { RueckrufPlanen } from './RueckrufPlanen'
import { LEAD_A, LEAD_B, LEAD_OHNE_GRUND, rendern } from './_testHilfe'

type Kette = Record<string, ReturnType<typeof vi.fn>>
/** Aufrufe einer Methode (insert/update) je Tabelle, in Reihenfolge. */
function aufrufe(tabelle: string, methode: 'insert' | 'update'): unknown[] {
  const from = vi.mocked(supabase.from)
  return from.mock.results
    .map((r, i) => ({ k: r.value as Kette, t: from.mock.calls[i]?.[0] }))
    .filter((x) => x.t === tabelle)
    .flatMap((x) => x.k[methode]?.mock.calls.map((c) => c[0]) ?? [])
}

describe('anrufgrundVorbelegung', () => {
  it('Antwort vorhanden → vernetzt + Antwort; nur vernetzt → vernetzt; Angefragt → keine Vorbelegung', () => {
    expect(anrufgrundVorbelegung(LEAD_OHNE_GRUND)).toBe('linkedin_vernetzt_antwort')
    expect(anrufgrundVorbelegung({ stage: 'vernetzt', last_inbound_channel: null, last_inbound_at: null })).toBe(
      'linkedin_vernetzt',
    )
    expect(
      anrufgrundVorbelegung({ stage: 'vernetzung_gesendet', last_inbound_channel: null, last_inbound_at: null }),
    ).toBeNull()
  })
})

describe('AnrufgrundSetzen', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], online: true })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('vorbelegt aus dem LinkedIn-Zustand; Setzen schreibt call_basis und eine Aktivität einwilligung/anrufgrund', async () => {
    rendern(<AnrufgrundSetzen lead={LEAD_OHNE_GRUND} />)
    fireEvent.click(screen.getByRole('button', { name: 'Anrufgrund setzen' }))
    const select = await screen.findByLabelText(/Anrufgrund/)
    expect(select).toHaveValue('linkedin_vernetzt_antwort')
    fireEvent.click(screen.getByRole('button', { name: /^Setzen/ }))
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith('Anrufgrund gesetzt: LinkedIn vernetzt + Antwort.'),
    )
    expect(aufrufe('leads', 'update')[0]).toEqual({
      call_basis: 'linkedin_vernetzt_antwort',
      call_basis_note: null,
      call_basis_url: null,
    })
    expect(aufrufe('activities', 'insert')[0]).toMatchObject({
      lead_id: LEAD_OHNE_GRUND.id,
      type: 'einwilligung',
      channel: 'telefon',
      outcome: 'linkedin_vernetzt_antwort',
      metadata: { kind: 'anrufgrund' },
    })
  })

  it('„nur vernetzt“ zeigt den Hinweis; „Sonstiger konkreter Anlass“ verlangt Notiz und URL; ⌘↵ speichert', async () => {
    rendern(<AnrufgrundSetzen lead={{ ...LEAD_B, call_basis: null }} offen onOpenChange={() => {}} />)
    const select = await screen.findByLabelText(/Anrufgrund/)
    expect(select).toHaveValue('linkedin_vernetzt')
    expect(screen.getByText(HINWEIS_NUR_VERNETZT)).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'sonstiger_konkreter_anlass' } })
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true })
    expect(await screen.findByText('Notiz ist Pflicht.')).toBeInTheDocument()
    expect(screen.getByText('URL ist Pflicht.')).toBeInTheDocument()
    expect(aufrufe('leads', 'update')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText(/Notiz/), { target: { value: 'Pressemitteilung Ausbau Innendienst' } })
    fireEvent.change(screen.getByLabelText(/URL/), { target: { value: 'https://beispiel.de/presse' } })
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(aufrufe('leads', 'update')).toHaveLength(1))
    expect(aufrufe('leads', 'update')[0]).toEqual({
      call_basis: 'sonstiger_konkreter_anlass',
      call_basis_note: 'Pressemitteilung Ausbau Innendienst',
      call_basis_url: 'https://beispiel.de/presse',
    })
  })
})

describe('RueckrufPlanen', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], online: true })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('Datum und Uhrzeit sind Pflicht; danach entsteht ein Rückruf-Task (kind rueckruf, member ich, Notiz)', async () => {
    const onFertig = vi.fn()
    rendern(<RueckrufPlanen leadId={LEAD_A.id} offen onOpenChange={() => {}} onFertig={onFertig} />)
    const knopf = await screen.findAllByRole('button', { name: /Rückruf planen/ })
    fireEvent.click(knopf[knopf.length - 1] as HTMLElement)
    expect(await screen.findByText('Datum und Uhrzeit sind Pflicht.')).toBeInTheDocument()
    expect(aufrufe('tasks', 'insert')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText(/Notiz/), { target: { value: 'mit Frau Behrens' } })
    fireEvent.click(screen.getByLabelText(/Datum und Uhrzeit/))
    fireEvent.click(await screen.findByRole('button', { name: 'Morgen' }))
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(aufrufe('tasks', 'insert')).toHaveLength(1))
    expect(aufrufe('tasks', 'insert')[0]).toMatchObject({
      lead_id: LEAD_A.id,
      kind: 'rueckruf',
      member_id: MEMBER_M,
      note: 'mit Frau Behrens',
      due_at: tagZuDate(tagPlus(heuteBerlin(), 1), '09:00').toISOString(),
    })
    await waitFor(() => expect(onFertig).toHaveBeenCalled())
  })
})
