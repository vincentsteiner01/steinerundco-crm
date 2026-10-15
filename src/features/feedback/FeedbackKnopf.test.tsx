import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blobUrlsStubben, meldung, MEMBER_M, MEMBER_V, MEMBERS, rendere, storageMock } from './_testHilfe'

let liste: unknown[] = []
vi.mock('@/data/supabase', async () =>
  (await import('@/test/supabaseMock')).supabaseMock((tabelle) =>
    tabelle === 'feedback'
      ? { data: liste, error: null }
      : tabelle === 'members'
        ? { data: MEMBERS, error: null }
        : { data: [], error: null },
  ),
)
vi.mock('./aufnahme', async (orig) => ({
  ...(await orig<typeof import('./aufnahme')>()),
  nimmAuf: vi.fn(),
}))
vi.mock('@/components/toast', async (orig) => {
  const echt = await orig<typeof import('@/components/toast')>()
  return { ...echt, toast: vi.fn(), sonnerToast: Object.assign(vi.fn(), { custom: vi.fn(() => 1), dismiss: vi.fn() }) }
})

const { supabase } = await import('@/data/supabase')
const { sonnerToast } = await import('@/components/toast')
const { useAuth } = await import('@/features/auth/authStore')
const { nimmAuf } = await import('./aufnahme')
const { FeedbackKnopf } = await import('./FeedbackKnopf')
const { GESEHEN_KEY } = await import('@/data/feedback')

beforeEach(() => {
  vi.clearAllMocks()
  blobUrlsStubben()
  liste = []
  localStorage.removeItem(GESEHEN_KEY)
  ;(supabase as unknown as { storage: unknown }).storage = { from: storageMock().from }
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent' },
  })
})

/** Text des zuletzt gezeigten sonner.custom-Toasts. */
function letzterToastText(): string {
  const aufrufe = vi.mocked(sonnerToast.custom).mock.calls
  const fabrik = aufrufe[aufrufe.length - 1]?.[0] as (() => React.ReactElement) | undefined
  if (!fabrik) return ''
  const { container, unmount } = render(fabrik())
  const t = container.textContent ?? ''
  unmount()
  return t
}

describe('FeedbackKnopf', () => {
  it('Runde 2: kein schwebender Knopf mehr über dem Inhalt – der Einstieg sitzt in der Navigation (⌥F bleibt)', () => {
    rendere(<FeedbackKnopf />)
    expect(screen.queryByRole('button', { name: 'Feedback geben (⌥F)' })).toBeNull()
    expect(document.querySelector('[data-feedback-knopf]')).toBeNull()
  })

  it('„crm:feedback“ (⌥F) nimmt erst den Screenshot auf, dann erscheint der Dialog mit Vorschau', async () => {
    let fertig: (b: Blob | null) => void = () => {}
    let dialogWaehrendAufnahme: Element | null = document.body
    vi.mocked(nimmAuf).mockImplementation(() => {
      dialogWaehrendAufnahme = document.querySelector('[role="dialog"]')
      return new Promise((ok) => (fertig = ok))
    })
    rendere(<FeedbackKnopf />)
    act(() => void window.dispatchEvent(new CustomEvent('crm:feedback')))
    expect(nimmAuf).toHaveBeenCalledTimes(1)
    expect(dialogWaehrendAufnahme).toBeNull()
    await act(async () => fertig(new Blob(['x'], { type: 'image/webp' })))
    expect(await screen.findByRole('dialog', { name: 'Feedback an Claude' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Screenshot der aktuellen Seite' })).toBeInTheDocument()
    // offen: weiteres ⌥F nimmt nicht erneut auf
    act(() => void window.dispatchEvent(new CustomEvent('crm:feedback')))
    expect(nimmAuf).toHaveBeenCalledTimes(1)
  })

  it('ohne Screenshot (Aufnahme scheitert) öffnet der Dialog trotzdem – mit Hinweis zum Einfügen', async () => {
    vi.mocked(nimmAuf).mockResolvedValue(null)
    rendere(<FeedbackKnopf />)
    act(() => void window.dispatchEvent(new CustomEvent('crm:feedback')))
    expect(await screen.findByText(/Kein Screenshot – Bild einfügen/)).toBeInTheDocument()
  })

  it('Start: ungesehene Antwort von Claude auf eine eigene Meldung → Toast mit „Ansehen“ (nur einmal)', async () => {
    localStorage.setItem(GESEHEN_KEY, JSON.stringify({}))
    liste = [
      meldung({
        id: 'a1',
        titel: 'Datum doppelt',
        antwort: 'Behoben.',
        antwort_at: '2026-10-15T11:00:00Z',
        status: 'erledigt',
      }),
      meldung({ id: 'm1', member_id: MEMBER_M, antwort: 'x', antwort_at: '2026-10-15T11:00:00Z' }),
    ]
    rendere(<FeedbackKnopf />)
    await waitFor(() => expect(sonnerToast.custom).toHaveBeenCalledTimes(1))
    expect(letzterToastText()).toBe('Claude hat geantwortet: „Datum doppelt“Ansehen')
    expect(JSON.parse(localStorage.getItem(GESEHEN_KEY) ?? '{}')).toEqual({ a1: '2026-10-15T11:00:00Z' })
  })

  it('erster Start auf dem Gerät: vorhandene Antworten still merken, kein Toast-Schwall', async () => {
    liste = [meldung({ id: 'a1', antwort: 'Behoben.', antwort_at: '2026-10-15T11:00:00Z' })]
    rendere(<FeedbackKnopf />)
    await waitFor(() => expect(localStorage.getItem(GESEHEN_KEY)).toBe(JSON.stringify({ a1: '2026-10-15T11:00:00Z' })))
    expect(sonnerToast.custom).not.toHaveBeenCalled()
  })

  it('Realtime: eigener Kanal crm:feedback auf crm.feedback; neue Antwort → Toast', async () => {
    localStorage.setItem(GESEHEN_KEY, JSON.stringify({}))
    rendere(<FeedbackKnopf />)
    const kanaele = (
      supabase as unknown as { __kanaele: { name: string; handler: { filter: unknown; cb: (p: unknown) => void }[] }[] }
    ).__kanaele
    await waitFor(() => expect(kanaele.some((k) => k.name === 'crm:feedback')).toBe(true))
    const kanal = kanaele.find((k) => k.name === 'crm:feedback')!
    expect(kanal.handler[0]?.filter).toEqual({ event: '*', schema: 'crm', table: 'feedback' })
    act(() =>
      kanal.handler[0]!.cb({
        eventType: 'UPDATE',
        new: meldung({
          id: 'r1',
          beschreibung: 'Leitfäden überlappen',
          antwort: 'Ist behoben.',
          antwort_at: '2026-10-15T12:00:00Z',
        }),
        old: { id: 'r1' },
      }),
    )
    expect(letzterToastText()).toBe('Claude hat geantwortet: „Leitfäden überlappen“Ansehen')
  })
})

describe('FeedbackKnopf – Runde 2: verdeckt nichts', () => {
  it('auch auf dem Anruf-Screen öffnet ⌥F den Dialog', async () => {
    vi.mocked(nimmAuf).mockResolvedValue(null)
    rendere(<FeedbackKnopf />, '/telefon/anruf/lead-1')
    act(() => void window.dispatchEvent(new CustomEvent('crm:feedback')))
    expect(await screen.findByRole('dialog', { name: 'Feedback an Claude' })).toBeInTheDocument()
  })
})
