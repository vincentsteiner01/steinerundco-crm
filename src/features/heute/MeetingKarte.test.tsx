// MeetingKarte.test.tsx (BAUPLAN § 3.2 Unit-Tests, H-24): „Stattgefunden? Status setzen“ mit 1–4; No-Show eines Erstgesprächs zeigt
// den Vorschlag-Toast (6 s), `↵` startet `email_noshow_erstgespraech`; ohne E-Mail-Adresse „Rückruf planen?“ → Aufgabe morgen 10:00.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('./_testHilfe')).toastMock())

import { useUiStore } from '@/app/uiStore'
import { sonnerToast, toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import type { LeadMitBezug, Meeting } from '@/types/domain'
import {
  ANTWORTEN,
  ICH,
  leadMitBezug,
  leadsSetzen,
  rendern,
  rpcAufrufe,
  taste,
  zeile,
  zuruecksetzen,
} from './_testHilfe'
import { HeuteKontext } from './kontext'
import { MeetingKarte, NOSHOW_RUECKRUF_TEXT, NOSHOW_SEQUENZ_TEXT } from './MeetingKarte'
import type { AktionenKontext } from './useQueueAktionen'

const HEUTE = '2026-10-14'

function meeting(leadId: string, patch: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meet-1',
    lead_id: leadId,
    type: 'erstgespraech',
    status: 'geplant',
    scheduled_at: '2026-10-14T10:00:00+02:00',
    duration_min: 15,
    location: 'Google Meet',
    ...patch,
  } as Meeting
}

function karte(lead: LeadMitBezug) {
  leadsSetzen(lead)
  const item = zeile('ueberfaellig', 1, {
    item_kind: 'meeting',
    meeting_id: 'meet-1',
    enrollment_id: null,
    lead_id: lead.id,
    due_at: '2026-10-14T10:00:00+02:00',
  })
  const k: AktionenKontext = {
    heute: HEUTE,
    offen: () => 1,
    schritt: () => null,
    markiereEigen: vi.fn(),
    onErledigt: vi.fn(),
    onAbgehakt: vi.fn(),
    istNeu: () => false,
  }
  const onAktion = vi.fn()
  rendern(
    <HeuteKontext.Provider value={k}>
      <MeetingKarte item={item} onAktion={onAktion} kontext="heute" />
    </HeuteKontext.Provider>,
  )
  return { k, onAktion, item }
}

/** Den zuletzt per sonnerToast.custom gezeigten Vorschlag-Toast rendern; liefert Text + Optionen. */
function letzterVorschlag() {
  const calls = vi.mocked(sonnerToast.custom).mock.calls as unknown as [() => ReactElement, { duration: number }][]
  const [renderFn, opts] = calls[calls.length - 1]!
  const r = render(renderFn())
  return { ...r, opts }
}

describe('MeetingKarte', () => {
  beforeEach(() => {
    zuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'liste', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: ICH })
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(sonnerToast.custom).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('zeigt „Erstgespräch · … · Stattgefunden? Status setzen“ mit vier Buttons und Tasten 1–4', async () => {
    const lead = leadMitBezug(1, { email: 'max@beispiel.de' })
    karte({ ...lead, meetings: [meeting(lead.id)] })
    expect(await screen.findByText(/Erstgespräch · .* · Stattgefunden\? Status setzen/)).toBeInTheDocument()
    for (const [label, kbd] of [
      ['Stattgefunden', '1'],
      ['No-Show', '2'],
      ['Abgesagt', '3'],
      ['Verschoben', '4'],
    ])
      expect(screen.getByRole('button', { name: new RegExp(`${label}.*${kbd}`) })).toBeInTheDocument()
  })

  it('`1` setzt „stattgefunden“ (meetings.update), Erledigt-Zeile, kein Vorschlag-Toast', async () => {
    const lead = leadMitBezug(1, { email: 'max@beispiel.de' })
    const { k } = karte({ ...lead, meetings: [meeting(lead.id)] })
    await screen.findByText(/Stattgefunden\? Status setzen/)
    await waitFor(() => expect(screen.getByText(/Google Meet/)).toBeInTheDocument())
    taste('1')
    await waitFor(() => expect(k.onErledigt).toHaveBeenCalled())
    expect(ANTWORTEN.schreiben).toContainEqual({ tabelle: 'meetings', art: 'update', arg: { status: 'stattgefunden' } })
    expect(k.markiereEigen).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Erstgespräch stattgefunden.')
    expect(sonnerToast.custom).not.toHaveBeenCalled()
  })

  it('H-24: No-Show eines Erstgesprächs → Vorschlag-Toast 6 s, ↵ startet email_noshow_erstgespraech', async () => {
    const lead = leadMitBezug(1, { email: 'max@beispiel.de' })
    karte({ ...lead, meetings: [meeting(lead.id)] })
    await waitFor(() => expect(screen.getByText(/Google Meet/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /No-Show/ }))
    await waitFor(() => expect(sonnerToast.custom).toHaveBeenCalled())
    const v = letzterVorschlag()
    expect(v.getByText(NOSHOW_SEQUENZ_TEXT)).toBeInTheDocument()
    expect(v.opts.duration).toBe(6000)
    fireEvent.keyDown(document, { key: 'Enter' })
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'enroll',
        { p_lead_id: lead.id, p_sequence_key: SEQUENZ.email_noshow_erstgespraech },
      ]),
    )
    // ein zweites ↵ startet nicht noch einmal
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(rpcAufrufe(supabase.rpc).filter((a) => a[0] === 'enroll')).toHaveLength(1)
  })

  it('No-Show ohne E-Mail-Adresse → „Rückruf planen?“, Klick legt einen Rückruf morgen 10:00 an', async () => {
    const lead = leadMitBezug(1, { email: null })
    karte({ ...lead, meetings: [meeting(lead.id)] })
    await waitFor(() => expect(screen.getByText(/Google Meet/)).toBeInTheDocument())
    taste('2')
    await waitFor(() => expect(sonnerToast.custom).toHaveBeenCalled())
    const v = letzterVorschlag()
    expect(v.getByText(NOSHOW_RUECKRUF_TEXT)).toBeInTheDocument()
    fireEvent.click(v.getByRole('button', { name: /Rückruf/ }))
    await waitFor(() => expect(ANTWORTEN.schreiben.some((s) => s.tabelle === 'tasks')).toBe(true))
    const t = ANTWORTEN.schreiben.find((s) => s.tabelle === 'tasks')!
    expect(t.arg).toMatchObject({
      lead_id: lead.id,
      member_id: ICH.user_id,
      kind: 'rueckruf',
      due_at: tagZuDate(tagPlus(HEUTE, 1), '10:00').toISOString(),
    })
    expect(rpcAufrufe(supabase.rpc).map((a) => a[0])).not.toContain('enroll')
  })

  it('No-Show eines Strategiegesprächs: kein Vorschlag (Sequenz nur nach Erstgespräch)', async () => {
    const lead = leadMitBezug(1, { email: 'max@beispiel.de' })
    karte({ ...lead, meetings: [meeting(lead.id, { type: 'strategiegespraech' })] })
    await screen.findByText(/Strategiegespräch · /)
    taste('2')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Strategiegespräch No-Show.'))
    expect(sonnerToast.custom).not.toHaveBeenCalled()
  })

  it('`4` öffnet „Verschieben auf“ mit Datum/Uhrzeit', async () => {
    const lead = leadMitBezug(1)
    karte({ ...lead, meetings: [meeting(lead.id)] })
    await screen.findByText(/Stattgefunden\? Status setzen/)
    taste('4')
    expect(await screen.findByRole('group', { name: 'Verschieben auf' })).toBeInTheDocument()
  })
})
