// Antwort erhalten: `A` öffnet den Inline-Block, Chips 1–9 (Mapping Label → Vorlage aus lib/vorlagenKeys), Chip 4 ohne Zitat
// blockiert, ⌘Enter → rpc.logReply, Toast mit Undo über die nachricht_erhalten-Aktivität, Hinweis bei fremder Zuständigkeit.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten({ fremd: true }))
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
import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { PHASE2_VORLAGE_NACH_LABEL } from '@/lib/vorlagenKeys'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { TOAST } from '@/texte/de'
import { LEAD_FREMD, rendern, taste } from './_testHilfe'
import { AntwortErhalten } from './AntwortErhalten'
import { chipBlockiert, REAKTION_CHIPS, vorlageFuerChip, ZITAT_PFLICHT_TEXT } from './reaktionen'

const rpc = () => vi.mocked(supabase.rpc)
const aufruf = () => rpc().mock.calls[0] as unknown as [string, Record<string, unknown>]

describe('AntwortErhalten', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    rpc().mockReset()
    rpc().mockResolvedValue({ data: 123, error: null } as never)
    vi.mocked(toast).mockClear()
    vi.mocked(toastUndo).mockClear()
  })

  it('Mapping Chip → Vorlage folgt PHASE2_VORLAGE_NACH_LABEL; Chip 4 → nein_mit_grund, Chip 9 → kein Vorschlag', () => {
    expect(REAKTION_CHIPS.map((c) => c.kbd)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    for (const c of REAKTION_CHIPS) {
      if (c.kbd === '4') expect(vorlageFuerChip(c)).toBe('li_bedarf_nein_mit_grund')
      else expect(vorlageFuerChip(c)).toBe(PHASE2_VORLAGE_NACH_LABEL[c.reply])
    }
    expect(vorlageFuerChip(REAKTION_CHIPS[0]!)).toBe('li_bedarf_ja_v1')
    expect(vorlageFuerChip(REAKTION_CHIPS[1]!)).toBe('li_bedarf_ja_v3')
    expect(vorlageFuerChip(REAKTION_CHIPS[2]!)).toBe('li_bedarf_nein_ohne_grund')
    expect(vorlageFuerChip(REAKTION_CHIPS[6]!)).toBe('li_bedarf_nein_mit_grund')
    expect(vorlageFuerChip(REAKTION_CHIPS[8]!)).toBeNull()
    expect(REAKTION_CHIPS.some((c) => c.reply === 'widerspruch')).toBe(false)
    expect(chipBlockiert(REAKTION_CHIPS[3]!, '')).toBe(true)
    expect(chipBlockiert(REAKTION_CHIPS[3]!, 'zu teuer')).toBe(false)
    expect(chipBlockiert(REAKTION_CHIPS[2]!, '')).toBe(false)
  })

  it('Chip 4 ohne Zitat ist blockiert: Speichern deaktiviert, ⌘Enter ruft nichts; mit Zitat → log_reply + Undo-Toast', async () => {
    const onFertig = vi.fn()
    rendern(<AntwortErhalten leadId={LEAD_FREMD.id} aktiv onFertig={onFertig} />)
    taste('a')
    const block = await screen.findByRole('group', { name: 'Antwort erhalten' })
    expect(block).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Speichern/ })).toBeDisabled()
    taste('4')
    expect(screen.getByRole('button', { name: /Nein \(mit Grund\)/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText(ZITAT_PFLICHT_TEXT).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^Speichern/ })).toBeDisabled()
    taste('Enter', { metaKey: true })
    expect(rpc()).not.toHaveBeenCalled()

    const zitat = screen.getByLabelText('Zitat')
    fireEvent.change(zitat, { target: { value: 'Zu teuer für uns' } })
    expect(screen.queryByText(ZITAT_PFLICHT_TEXT)).not.toBeInTheDocument()
    taste('Enter', { metaKey: true }, zitat)
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    const [name, args] = aufruf()
    expect(name).toBe('log_reply')
    expect(args).toEqual({
      p_lead_id: LEAD_FREMD.id,
      p_channel: 'linkedin',
      p_label: 'kein_bedarf',
      p_note: 'Zu teuer für uns',
    })
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith(TOAST.antwortErhalten('Nein (mit Grund)'), 123))
    expect(onFertig).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Antwort erhalten' })).not.toBeInTheDocument())
  })

  it('`1` Ja → interessiert ohne Zitat, Vorlage „Ja (V1)“ vorgeschlagen; Hinweis bei fremder Zuständigkeit', async () => {
    const onVorschlag = vi.fn()
    rendern(<AntwortErhalten leadId={LEAD_FREMD.id} aktiv onVorschlag={onVorschlag} />)
    taste('a')
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    expect(await screen.findByText(/Zuständig ist Mike – trotzdem loggen\?/)).toBeInTheDocument()
    taste('1')
    expect(screen.getByRole('button', { name: /^Speichern/ })).toBeEnabled()
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    const [, args] = aufruf()
    expect(args).toEqual({ p_lead_id: LEAD_FREMD.id, p_channel: 'linkedin', p_label: 'interessiert', p_note: null })
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith(TOAST.antwortErhalten('Ja (V1)'), 123))
    expect(onVorschlag).toHaveBeenCalledWith('li_bedarf_ja_v1')
    expect(LEAD_FREMD.owner_id).toBe(MEMBER_M)
  })

  it('`9` Nicht ICP → kein Vorschlag, Toast „Lead beendet“', async () => {
    rendern(<AntwortErhalten leadId={LEAD_FREMD.id} aktiv />)
    taste('a')
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    taste('9')
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    expect(aufruf()[1]).toMatchObject({ p_label: 'nicht_icp' })
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith('Antwort erhalten – Lead beendet · Nicht ICP.', 123))
  })

  it('ohne `aktiv` reagiert `A` nicht; Esc schließt den Block', async () => {
    rendern(<AntwortErhalten leadId={LEAD_FREMD.id} />)
    taste('a')
    expect(screen.queryByRole('group', { name: 'Antwort erhalten' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Antwort/ }))
    await screen.findByRole('group', { name: 'Antwort erhalten' })
    taste('Escape')
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Antwort erhalten' })).not.toBeInTheDocument())
  })
})
