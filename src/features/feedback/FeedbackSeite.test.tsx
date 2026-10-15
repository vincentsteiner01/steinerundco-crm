import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blobUrlsStubben, meldung, MEMBER_M, MEMBER_V, MEMBERS, rendere, setzeBreite, storageMock } from './_testHilfe'

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

const { supabase } = await import('@/data/supabase')
const { useAuth } = await import('@/features/auth/authStore')
const { Component: FeedbackSeite } = await import('./FeedbackSeite')

const NEU = meldung({
  id: 'a0000000-0000-4000-8000-000000000001',
  titel: 'Datum doppelt',
  created_at: '2026-10-15T10:00:00Z',
})
const ERLEDIGT = meldung({
  id: 'a0000000-0000-4000-8000-000000000002',
  member_id: MEMBER_M,
  art: 'wunsch',
  beschreibung: 'Gmail verbinden\nwäre super',
  status: 'erledigt',
  antwort: 'Kommt in v1.1 – Make-Szenario Gmail → Webhook.',
  antwort_at: '2026-10-15T11:30:00Z',
  screenshot_path: 'a0000000-0000-4000-8000-000000000002.webp',
  created_at: '2026-10-15T09:00:00Z',
})
const ARBEIT = meldung({
  id: 'a0000000-0000-4000-8000-000000000003',
  status: 'in_arbeit',
  art: 'frage',
  beschreibung: 'Wie synchronisiert LinkedIn?',
  route: null,
  created_at: '2026-10-14T09:00:00Z',
})

let storage: ReturnType<typeof storageMock>
beforeEach(() => {
  vi.clearAllMocks()
  blobUrlsStubben()
  storage = storageMock()
  ;(supabase as unknown as { storage: unknown }).storage = { from: storage.from }
  globalThis.fetch = vi.fn(async () => new Response(new Blob(['bild'], { type: 'image/webp' }))) as typeof fetch
  liste = [NEU, ERLEDIGT, ARBEIT]
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent' },
  })
  setzeBreite(true)
})

const zeilen = () => within(screen.getByRole('region', { name: 'Meldungen' })).getAllByRole('button')
const updateAufrufe = () =>
  vi
    .mocked(supabase.from)
    .mock.results.flatMap((r) => (r.value as { update: ReturnType<typeof vi.fn> }).update.mock.calls)

describe('FeedbackSeite', () => {
  it('listet alle Meldungen (neueste zuerst) mit Status-Chip, Art, Seite und Datum; Kopf zählt neu · in Arbeit · erledigt', async () => {
    rendere(<FeedbackSeite />, '/feedback')
    await screen.findByText('Datum doppelt', { selector: 'span' })
    const z = zeilen()
    expect(z).toHaveLength(3)
    expect(z[0]).toHaveTextContent('neu')
    expect(z[0]).toHaveTextContent('Datum doppelt')
    expect(z[0]).toHaveTextContent('Fehler')
    expect(z[0]).toHaveTextContent('/pipeline')
    expect(z[0]).toHaveTextContent('Do 15.10. 12:00')
    expect(z[1]).toHaveTextContent('erledigt')
    expect(z[1]).toHaveTextContent('Gmail verbinden')
    expect(z[1]).toHaveTextContent('Antwort')
    expect(z[2]).toHaveTextContent('in Arbeit')
    expect(screen.getByRole('button', { name: /^Offen/ })).toHaveTextContent('2')
  })

  it('breit: Detail neben der Liste – neueste Meldung vorgewählt; J wählt die nächste', async () => {
    const { router } = rendere(<FeedbackSeite />, '/feedback')
    const detail = await screen.findByRole('complementary', { name: 'Meldung' })
    await waitFor(() => expect(router.state.location.search).toBe(`?id=${NEU.id}`))
    expect(await within(detail).findByRole('heading', { name: 'Datum doppelt' })).toBeInTheDocument()
    expect(within(detail).getByText('Chrome 141 · macOS')).toBeInTheDocument()
    expect(
      within(detail).getByText('Noch keine Antwort – Claude sieht die Meldung beim nächsten Durchgang.'),
    ).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'j', code: 'KeyJ' })
    await waitFor(() => expect(router.state.location.search).toBe(`?id=${ERLEDIGT.id}`))
  })

  it('Detail: Antwort von Claude mit Zeit, Screenshot über Signed URL (2 min) als blob:-Bild', async () => {
    rendere(<FeedbackSeite />, `/feedback?id=${ERLEDIGT.id}`)
    const detail = await screen.findByRole('complementary', { name: 'Meldung' })
    expect(within(detail).getByText('Kommt in v1.1 – Make-Szenario Gmail → Webhook.')).toBeInTheDocument()
    expect(within(detail).getByText('15.10.2026, 13:30')).toBeInTheDocument()
    expect(storage.from).toHaveBeenCalledWith('crm-feedback')
    expect(storage.createSignedUrl).toHaveBeenCalledWith(ERLEDIGT.screenshot_path, 120)
    expect(await within(detail).findByRole('img', { name: 'Screenshot von /pipeline' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    )
  })

  it('Filter „Erledigt“ zeigt nur erledigte Meldungen (URL ?status=erledigt)', async () => {
    const { router } = rendere(<FeedbackSeite />, '/feedback')
    await screen.findByText('Datum doppelt', { selector: 'span' })
    fireEvent.click(screen.getByRole('button', { name: /^Erledigt/ }))
    await waitFor(() => expect(router.state.location.search).toContain('status=erledigt'))
    expect(zeilen()).toHaveLength(1)
    expect(zeilen()[0]).toHaveTextContent('Gmail verbinden')
  })

  it('Status ändern schreibt sofort (optimistisch); Notiz speichern schreibt die Notiz', async () => {
    rendere(<FeedbackSeite />, `/feedback?id=${NEU.id}`)
    const detail = await screen.findByRole('complementary', { name: 'Meldung' })
    fireEvent.click(
      within(within(detail).getByRole('group', { name: 'Status ändern' })).getByRole('button', { name: 'erledigt' }),
    )
    await waitFor(() => expect(updateAufrufe()).toContainEqual([{ status: 'erledigt' }]))
    const notiz = within(detail).getByLabelText('Notiz')
    expect(within(detail).getByRole('button', { name: /Notiz speichern/ })).toBeDisabled()
    fireEvent.change(notiz, { target: { value: 'Passiert nur bei 184 Leads in einer Spalte' } })
    fireEvent.click(within(detail).getByRole('button', { name: /Notiz speichern/ }))
    await waitFor(() =>
      expect(updateAufrufe()).toContainEqual([{ notiz: 'Passiert nur bei 184 Leads in einer Spalte' }]),
    )
  })

  it('schmal: Klick auf eine Meldung öffnet das Detail als Blatt', async () => {
    setzeBreite(false)
    rendere(<FeedbackSeite />, '/feedback')
    await screen.findByText('Datum doppelt', { selector: 'span' })
    expect(screen.queryByRole('complementary', { name: 'Meldung' })).toBeNull()
    fireEvent.click(zeilen()[2]!)
    const blatt = await screen.findByRole('dialog', { name: 'Frage · in Arbeit' })
    expect(within(blatt).getByText('Wie synchronisiert LinkedIn?', { selector: 'p.text-body' })).toBeInTheDocument()
    expect(within(blatt).getByText('Ohne Screenshot.')).toBeInTheDocument()
  })

  it('leer: „Noch keine Meldungen.“ mit „Feedback geben ⌥F“ (öffnet den Dialog über crm:feedback)', async () => {
    liste = []
    rendere(<FeedbackSeite />, '/feedback')
    expect(await screen.findByRole('heading', { name: 'Noch keine Meldungen.' })).toBeInTheDocument()
    const h = vi.fn()
    window.addEventListener('crm:feedback', h)
    fireEvent.click(screen.getAllByRole('button', { name: /Feedback geben/ })[0]!)
    expect(h).toHaveBeenCalled()
    window.removeEventListener('crm:feedback', h)
  })
})
