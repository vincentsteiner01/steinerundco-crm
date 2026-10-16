// AnrufMitte: Qualifizierung schreibt in leads.qualification (T-13), „Hinweis genannt“ (§ 8.2 Nr. 5), Timer-Korrektur, Impressum-Warnung
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_M } from '@/test/fixtures/leads'

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock((tabelle) => {
    if (tabelle === 'leads') return { data: h.LEAD_A, error: null }
    if (tabelle === 'activities') return { data: { id: 1, lead_id: h.LEAD_A.id }, error: null }
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

import { supabase } from '@/data/supabase'
import { AnrufMitte } from './AnrufMitte'
import { parseDauer } from './qualifizierung'
import type { Anruf } from './useAnruf'
import { leadMitBezug, LEAD_A, rendern } from './_testHilfe'

function fakeAnruf(p: Partial<Anruf> = {}): Anruf {
  return {
    entwurf: null,
    laeuft: false,
    dauerSec: 0,
    ergebnis: null,
    anrufen: vi.fn(),
    notizSetzen: vi.fn(),
    ergebnisSetzen: vi.fn(),
    dauerKorrigieren: vi.fn(),
    vorlageSetzen: vi.fn(),
    verwerfen: vi.fn(),
    fehlt: () => [],
    speichern: vi.fn(async () => null),
    istSpeichern: false,
    ...p,
  }
}

type Kette = Record<string, ReturnType<typeof vi.fn>>
function aufrufe(tabelle: string, methode: 'insert' | 'update'): unknown[] {
  const from = vi.mocked(supabase.from)
  return from.mock.results
    .map((r, i) => ({ k: r.value as Kette, t: from.mock.calls[i]?.[0] }))
    .filter((x) => x.t === tabelle)
    .flatMap((x) => x.k[methode]?.mock.calls.map((c) => c[0]) ?? [])
}

describe('AnrufMitte', () => {
  beforeEach(() => {
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_M, email: 'm@x', display_name: 'Mike' } })
    vi.mocked(supabase.from).mockClear()
  })

  it('T-13: Qualifizierungs-Segment schreibt sofort in leads.qualification; erneuter Klick nimmt den Wert zurück', async () => {
    const lead = leadMitBezug({ ...LEAD_A, qualification: { haeufigkeit: 'taeglich' } })
    rendern(<AnrufMitte lead={lead} anruf={fakeAnruf()} datenschutzText={null} privacyVersion="v1.0" />)
    fireEvent.click(screen.getByRole('button', { name: 'Innendienst' }))
    await waitFor(() => expect(aufrufe('leads', 'update')).toHaveLength(1))
    expect(aufrufe('leads', 'update')[0]).toEqual({
      qualification: { haeufigkeit: 'taeglich', wer_beantwortet: 'innendienst' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'täglich' }))
    await waitFor(() => expect(aufrufe('leads', 'update')).toHaveLength(2))
    expect(aufrufe('leads', 'update')[1]).toEqual({ qualification: { haeufigkeit: null } })
  })

  it('§ 8.2 Nr. 5: „Hinweis genannt“ schreibt Aktivität einwilligung/datenschutz_hinweis und privacy_notice_* am Lead', async () => {
    rendern(
      <AnrufMitte
        lead={leadMitBezug(LEAD_A)}
        anruf={fakeAnruf()}
        datenschutzText="Ihre Kontaktdaten habe ich von LinkedIn."
        privacyVersion="v1.0"
      />,
    )
    expect(screen.getByText(/Datenschutz: Ihre Kontaktdaten habe ich von LinkedIn\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hinweis genannt' }))
    await waitFor(() => expect(aufrufe('leads', 'update')).toHaveLength(1))
    expect(aufrufe('activities', 'insert')[0]).toMatchObject({
      lead_id: LEAD_A.id,
      type: 'einwilligung',
      channel: 'telefon',
      metadata: { kind: 'datenschutz_hinweis', version: 'v1.0' },
    })
    expect(aufrufe('leads', 'update')[0]).toMatchObject({ privacy_notice_version: 'v1.0' })
  })

  it('Timer-Klick korrigiert die Dauer (mm:ss) während eines Anrufs; Impressum-Quelle zeigt die Warnung', () => {
    const anruf = fakeAnruf({ laeuft: true, dauerSec: 75 })
    rendern(
      <AnrufMitte
        lead={leadMitBezug({ ...LEAD_A, phone_source: 'impressum' })}
        anruf={anruf}
        datenschutzText={null}
        privacyVersion="v1.0"
      />,
    )
    expect(screen.getByText(/Impressumsdaten nicht für Werbung/)).toBeInTheDocument()
    expect(screen.getByTestId('anrufen')).toHaveTextContent('Timer läuft')
    fireEvent.click(screen.getByTestId('timer'))
    const feld = screen.getByLabelText('Dauer korrigieren (mm:ss)')
    expect(feld).toHaveValue('01:15')
    fireEvent.change(feld, { target: { value: '03:52' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(anruf.dauerKorrigieren).toHaveBeenCalledWith(232)
    expect(parseDauer('1:02:11')).toBe(3731)
    expect(parseDauer('x')).toBeNull()
  })
})
