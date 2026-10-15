// AntwortenKarte.test.tsx (BAUPLAN § 3.2 Unit-Tests, § 1.5 Nr. 25/26): Vorlage je Label aus PHASE2_VORLAGE_NACH_LABEL (H-09);
// `E` ruft log_outbound und je nach Label enroll(C) oder set_wiedervorlage(+60/+180) (H-22); `P` ruft log_outbound(pitch) + enroll(C)
// mit „nach Pitch“ (H-21); Pitch nur in Phase Beantwortet/Gepitcht; Später = +1 Tag (Seite).
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('./_testHilfe')).toastMock())

import { useUiStore } from '@/app/uiStore'
import { toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import type { ReplyLabel } from '@/types/domain'
import {
  ANTWORTEN,
  ICH,
  leadMitBezug,
  leadsSetzen,
  rendern,
  rpcAufrufe,
  T_JA,
  T_LF1,
  T_NEIN_MIT,
  T_PITCH_A,
  zeile,
  zuruecksetzen,
} from './_testHilfe'
import { useKartenStore } from './kartenStore'
import { HeuteKontext } from './kontext'
import { QueueKarte } from './QueueKarte'
import type { AktionenKontext } from './useQueueAktionen'

const ctx = (): AktionenKontext => ({
  heute: '2026-10-14',
  offen: () => 3,
  schritt: () => null,
  markiereEigen: vi.fn(),
  onErledigt: vi.fn(),
  onAbgehakt: vi.fn(),
  istNeu: () => false,
})

function antwortKarte(label: ReplyLabel | null, note: string | null, stage = 'dm_beantwortet') {
  const lead = leadMitBezug(1, { stage: stage as never })
  leadsSetzen(lead)
  ANTWORTEN.activities = [
    {
      id: 70,
      lead_id: lead.id,
      type: 'nachricht_erhalten',
      reply_label: label,
      note,
      occurred_at: '2026-10-13T17:52:00+02:00',
      created_at: '2026-10-13T17:52:00+02:00',
    },
  ]
  const item = zeile('antworten', 1, { enrollment_id: null, stage: stage as never, template_id: null })
  ANTWORTEN.queue = [item]
  const k = ctx()
  const onAktion = vi.fn()
  rendern(
    <HeuteKontext.Provider value={k}>
      <QueueKarte item={item} aktiv onAktion={onAktion} />
    </HeuteKontext.Provider>,
  )
  return { item, lead, k, onAktion }
}

describe('AntwortenKarte', () => {
  beforeEach(() => {
    zuruecksetzen()
    useKartenStore.setState({ karten: {} })
    useUiStore.setState({ hotkeyScope: 'liste', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: ICH })
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(toastUndo).mockClear()
  })

  it.each([
    ['interessiert', null, 'Ja (V1)'],
    ['frage', null, 'Ja (V3)'],
    ['kein_bedarf', null, 'Nein (ohne Grund)'],
    ['kein_bedarf', 'Haben wir schon gelöst', 'Nein (mit Grund)'],
    ['hat_partner', null, 'Hat Partner'],
    ['falsches_problem', null, 'Falsches Problem'],
    ['spaeter', 'Nächstes Jahr wieder', 'Nein (mit Grund)'],
    ['sonstiges', null, 'Ja (V3)'],
  ] as const)('Label %s (Zitat: %s) → Vorlage „%s“', async (label, note, name) => {
    antwortKarte(label, note)
    expect(await screen.findByText(new RegExp(`Leitfaden · ${name.replace(/[()]/g, '\\$&')}`))).toBeInTheDocument()
  })

  it('H-09: zeigt Zitat und Reaktion der letzten Antwort, Kopf „Antwort offen · seit 1 T · Beantwortet“', async () => {
    antwortKarte('interessiert', 'Ja, kommt mir bekannt vor.')
    expect(await screen.findByText(/‚Ja, kommt mir bekannt vor\.‘/)).toHaveTextContent('Antwort Di 13.10., 17:52')
    expect(screen.getByText(/^Antwort offen · seit \d+ T · Beantwortet$/)).toBeInTheDocument()
    expect(screen.getByLabelText('Reaktion eintragen')).toBeInTheDocument() // Ja (V1) hat [Reaktion]
  })

  it('H-22: E mit Label „spaeter“ → log_outbound(nachricht) + set_wiedervorlage(+60, Langfristig 1, Zitat) – ohne Sequenz C', async () => {
    const { lead, k } = antwortKarte('spaeter', 'Nächstes Jahr wieder')
    await screen.findByText(/Leitfaden · Nein \(mit Grund\)/)
    fireEvent.click(screen.getByRole('button', { name: /Gesendet/ }))
    await waitFor(() => expect(k.onErledigt).toHaveBeenCalled())
    const aufrufe = rpcAufrufe(supabase.rpc)
    expect(aufrufe[0]).toEqual([
      'log_outbound',
      { p_lead_id: lead.id, p_channel: 'linkedin', p_template_id: T_NEIN_MIT.id, p_kind: 'nachricht' },
    ])
    expect(aufrufe[1]).toEqual([
      'set_wiedervorlage',
      { p_lead_id: lead.id, p_due: '2026-12-13', p_note: 'Nächstes Jahr wieder', p_template_id: T_LF1.id },
    ])
    expect(aufrufe.map((a) => a[0])).not.toContain('enroll')
    expect(toastUndo).toHaveBeenCalledWith('Erledigt – Antwort gesendet · Wiedervorlage am 14.12.2026.', 501)
  })

  it('E mit Label „hat_partner“ → Wiedervorlage +180 Tage (settings.langfristig.hat_partner_days)', async () => {
    const { lead } = antwortKarte('hat_partner', null)
    await screen.findByText(/Leitfaden · Hat Partner/)
    fireEvent.click(screen.getByRole('button', { name: /Gesendet/ }))
    await waitFor(() => expect(rpcAufrufe(supabase.rpc).map((a) => a[0])).toContain('set_wiedervorlage'))
    expect(rpcAufrufe(supabase.rpc).find((a) => a[0] === 'set_wiedervorlage')?.[1]).toMatchObject({
      p_lead_id: lead.id,
      p_due: '2027-04-12',
    })
  })

  it('H-22: E mit Label „interessiert“ → log_outbound + enroll(Sequenz C), keine Wiedervorlage; Toast „Nachfassen am Mo 19.10.“', async () => {
    const { lead } = antwortKarte('interessiert', null)
    const feld = await screen.findByLabelText('Reaktion eintragen')
    fireEvent.change(feld, { target: { value: 'Das' } })
    fireEvent.click(screen.getByRole('button', { name: /Gesendet/ }))
    await waitFor(() => expect(rpcAufrufe(supabase.rpc)).toHaveLength(2))
    expect(rpcAufrufe(supabase.rpc)).toEqual([
      ['log_outbound', { p_lead_id: lead.id, p_channel: 'linkedin', p_template_id: T_JA.id, p_kind: 'nachricht' }],
      ['enroll', { p_lead_id: lead.id, p_sequence_key: SEQUENZ.linkedin_nachfassen_im_gespraech }],
    ])
    await waitFor(() =>
      expect(toastUndo).toHaveBeenCalledWith('Erledigt – Antwort gesendet · Nachfassen am Mo 19.10.', 501),
    )
  })

  it('H-21: P → log_outbound(pitch, Pitch A) + enroll(C, „nach Pitch“)', async () => {
    const { lead, k } = antwortKarte('interessiert', null)
    await screen.findByText(/Leitfaden · Ja \(V1\)/)
    fireEvent.click(screen.getByRole('button', { name: /Pitch/ }))
    await waitFor(() => expect(k.onErledigt).toHaveBeenCalled())
    expect(rpcAufrufe(supabase.rpc)).toEqual([
      ['log_outbound', { p_lead_id: lead.id, p_channel: 'linkedin', p_template_id: T_PITCH_A.id, p_kind: 'pitch' }],
      [
        'enroll',
        { p_lead_id: lead.id, p_sequence_key: SEQUENZ.linkedin_nachfassen_im_gespraech, p_note: 'nach Pitch' },
      ],
    ])
    expect(k.onErledigt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ text: 'Pitch A gesendet · Nachfassen am Mo 19.10.', activityId: 501 }),
    )
  })

  it('Pitch nur in Phase Beantwortet/Gepitcht', async () => {
    antwortKarte('interessiert', null, 'gespraech_eroeffnet')
    await screen.findByText(/Leitfaden · Ja \(V1\)/)
    expect(screen.getByLabelText('Nur in Phase Beantwortet/Gepitcht').querySelector('button')).toBeDisabled()
  })

  it('Später meldet „spaeter“ an die Seite (dort +1 Tag ausgeblendet)', async () => {
    const { onAktion } = antwortKarte('interessiert', null)
    await screen.findByText(/Leitfaden · Ja \(V1\)/)
    fireEvent.click(screen.getByRole('button', { name: /Später/ }))
    expect(onAktion).toHaveBeenCalledWith('spaeter')
  })
})
