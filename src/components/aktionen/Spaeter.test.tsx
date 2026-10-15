// Später: `S` öffnet das Popover, 1–5/D, snooze_step/snooze_task mit gerolltem Zieltag 09:00, Undo-Toast, Option 5 = Wiedervorlage,
// ab snooze_count ≥ 3 die Frage „Dreimal verschoben – beenden oder Wiedervorlage?“ (BAUPLAN § 3.1.10b, H-07/H-08).
import { screen, waitFor } from '@testing-library/react'
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
import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import { MEMBER_V } from '@/test/fixtures/leads'
import { TOAST } from '@/texte/de'
import { AKTIVITAET_ID, LEAD, rendern, taste } from './_testHilfe'
import { Spaeter } from './Spaeter'
import { spaeterOptionen, spaeterWann } from './spaeterOptionen'

const rpc = () => vi.mocked(supabase.rpc)
const heute = heuteBerlin()
const optionen = spaeterOptionen(heute)

describe('Spaeter', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    rpc().mockReset()
    rpc().mockResolvedValue({ data: { id: 'e1', snooze_count: 1 }, error: null } as never)
    vi.mocked(toast).mockClear()
    vi.mocked(toastUndo).mockClear()
  })

  it('`S` öffnet das Menü mit 1–5 und Datum, Zieltage gerollt', async () => {
    rendern(<Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv />)
    expect(screen.getByRole('button', { name: /Später/ })).toBeInTheDocument()
    taste('s')
    const menu = await screen.findByRole('menu', { name: 'Später' })
    expect(menu).toBeInTheDocument()
    const eintraege = screen.getAllByRole('menuitem')
    expect(eintraege).toHaveLength(6)
    expect(eintraege[0]).toHaveTextContent('Morgen')
    expect(eintraege[4]).toHaveTextContent('Wiedervorlage')
    expect(eintraege[5]).toHaveTextContent('Datum')
    for (const o of optionen)
      expect([0, 6], `${o.label} fällt auf ein Wochenende`).not.toContain(new Date(o.tag).getUTCDay())
  })

  it('`2` verschiebt den Schritt um +3 T (p_days, die DB rechnet ab max(fällig, jetzt)) und bietet Rückgängig an', async () => {
    const onFertig = vi.fn()
    rendern(<Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv onFertig={onFertig} />)
    taste('s')
    await screen.findByRole('menu', { name: 'Später' })
    taste('2')
    await waitFor(() => expect(rpc()).toHaveBeenCalled())
    const [name, args] = rpc().mock.calls[0] as unknown as [string, Record<string, unknown>]
    const ziel = optionen[1]
    expect(name).toBe('snooze_step')
    expect(args).toEqual({ p_enrollment_id: 'e1', p_days: 3 })
    await waitFor(() =>
      expect(toastUndo).toHaveBeenCalledWith(TOAST.spaeter(spaeterWann(ziel!.tag, heute)), AKTIVITAET_ID),
    )
    expect(onFertig).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Später' })).not.toBeInTheDocument())
  })

  it('Aufgabe: `1` ruft snooze_task; ohne Aktivität nur ein neutraler Toast', async () => {
    rendern(<Spaeter leadId={LEAD.id} taskId="t9" aktiv />)
    taste('s')
    await screen.findByRole('menu', { name: 'Später' })
    taste('1')
    await waitFor(() => expect(rpc()).toHaveBeenCalled())
    const [name, args] = rpc().mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(name).toBe('snooze_task')
    expect(args).toEqual({ p_task_id: 't9', p_days: 1 })
    await waitFor(() => expect(toast).toHaveBeenCalledWith(TOAST.spaeter(spaeterWann(optionen[0]!.tag, heute))))
    expect(toastUndo).not.toHaveBeenCalled()
  })

  it('`3` „Nächster Montag“ schickt ein festes Datum (p_until 09:00)', async () => {
    rendern(<Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv faelligAm={null} />)
    taste('s')
    await screen.findByRole('menu', { name: 'Später' })
    taste('3')
    await waitFor(() => expect(rpc()).toHaveBeenCalled())
    const [name, args] = rpc().mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(name).toBe('snooze_step')
    expect(args).toEqual({ p_enrollment_id: 'e1', p_until: tagZuDate(optionen[2]!.tag, '09:00').toISOString() })
  })

  it('A7 (BAUPLAN § 5.2): Schritt schon künftig fällig – die Anzeige rechnet ab dem Fälligkeitstag', async () => {
    const kuenftig = tagPlus(heute, 10)
    rendern(
      <Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv faelligAm={`${kuenftig}T07:00:00.000Z`} snoozeCount={0} />,
    )
    taste('s')
    await screen.findByRole('menu', { name: 'Später' })
    const plus3 = spaeterOptionen(heute, undefined, `${kuenftig}T07:00:00.000Z`)[1]!
    expect(plus3.tag > tagPlus(heute, 3)).toBe(true)
    expect(screen.getAllByRole('menuitem')[1]).toHaveTextContent(fmtDatumKurz(plus3.tag))
  })

  it('`5` setzt eine Wiedervorlage (+2 Mo) statt zu verschieben', async () => {
    rendern(<Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv />)
    taste('s')
    await screen.findByRole('menu', { name: 'Später' })
    taste('5')
    await waitFor(() => expect(rpc()).toHaveBeenCalled())
    const [name, args] = rpc().mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(name).toBe('set_wiedervorlage')
    expect(args).toEqual({ p_lead_id: LEAD.id, p_due: optionen[4]!.tag })
    await waitFor(() => expect(toastUndo).toHaveBeenCalled())
  })

  it('ohne Schritt oder Aufgabe ist der Auslöser deaktiviert; ohne `aktiv` reagiert `S` nicht', async () => {
    rendern(<Spaeter leadId={LEAD.id} />)
    expect(screen.getByRole('button', { name: /Später/ })).toBeDisabled()
    taste('s')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ab dem dritten Später die Frage „Dreimal verschoben – beenden oder Wiedervorlage?“ (H-08)', async () => {
    rendern(<Spaeter leadId={LEAD.id} enrollmentId="e1" aktiv snoozeCount={3} />)
    taste('s')
    expect(await screen.findByText('Dreimal verschoben – beenden oder Wiedervorlage?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wiedervorlage' })).toBeInTheDocument()
    taste('2')
    expect(rpc()).not.toHaveBeenCalled()
    screen.getByRole('button', { name: 'Trotzdem verschieben' }).click()
    expect(await screen.findByRole('menu', { name: 'Später' })).toBeInTheDocument()
  })
})
