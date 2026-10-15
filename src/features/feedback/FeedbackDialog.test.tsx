import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blobUrlsStubben, rendere, storageMock } from './_testHilfe'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', async (orig) => ({
  ...(await orig<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
}))

const { supabase } = await import('@/data/supabase')
const { toast } = await import('@/components/toast')
const { FeedbackDialog } = await import('./FeedbackDialog')
type FeedbackKontext = import('./kontext').FeedbackKontext

const KONTEXT: FeedbackKontext = {
  route: '/pipeline?lead=abc',
  url: 'http://localhost:8768/pipeline?lead=abc',
  viewport: '1440×900 @2x',
  breite: 1440,
  user_agent: 'UA',
  app_version: 'test',
  konsole: [
    { zeit: '2026-10-15T10:00:00.000Z', art: 'error', text: 'a' },
    { zeit: '2026-10-15T10:00:01.000Z', art: 'warn', text: 'b' },
  ],
}

let storage: ReturnType<typeof storageMock>
beforeEach(() => {
  vi.clearAllMocks()
  blobUrlsStubben()
  storage = storageMock()
  ;(supabase as unknown as { storage: unknown }).storage = { from: storage.from }
})

function oeffne(bild: Blob | null = new Blob(['bild'], { type: 'image/webp' })) {
  const onSchliessen = vi.fn()
  const r = rendere(<FeedbackDialog bild={bild} kontext={KONTEXT} onSchliessen={onSchliessen} />)
  return { ...r, onSchliessen }
}
const feld = () => screen.getByLabelText('Beschreibung') as HTMLTextAreaElement
const artKnopf = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const insertAufrufe = () =>
  vi
    .mocked(supabase.from)
    .mock.results.flatMap((r) => (r.value as { insert: ReturnType<typeof vi.fn> }).insert.mock.calls)

describe('FeedbackDialog', () => {
  it('Vorschau bleibt im StrictMode gültig: die angezeigte blob:-URL ist nicht widerrufen (Runde 2: kaputtes Bild)', async () => {
    rendere(
      <StrictMode>
        <FeedbackDialog bild={new Blob(['bild'], { type: 'image/webp' })} kontext={KONTEXT} onSchliessen={vi.fn()} />
      </StrictMode>,
    )
    const img = await screen.findByRole('img', { name: 'Screenshot der aktuellen Seite' })
    const src = img.getAttribute('src')
    expect(src).toMatch(/^blob:test\//)
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.map((c) => c[0])).not.toContain(src)
  })

  it('zeigt Titel, Art-Segment, Screenshot-Vorschau und die Kontextzeile; Fokus liegt in der Beschreibung', async () => {
    oeffne()
    expect(await screen.findByRole('dialog', { name: 'Feedback an Claude' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Screenshot der aktuellen Seite' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:test\//),
    )
    expect(screen.getByText('Automatisch aufgenommen')).toBeInTheDocument()
    expect(
      screen.getByText('Seite /pipeline · Breite 1440 px · Version test · 2 Konsolen-Einträge'),
    ).toBeInTheDocument()
    expect(artKnopf('Fehler')).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(feld()).toHaveFocus())
  })

  it('Art per Taste: 1–3 außerhalb von Feldern, ⌥1–3 auch im Feld; eine Ziffer im Feld bleibt Text', async () => {
    oeffne()
    await screen.findByRole('dialog')
    fireEvent.keyDown(feld(), { key: '2', code: 'Digit2' })
    expect(artKnopf('Fehler')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(feld(), { key: '¶', code: 'Digit3', altKey: true })
    expect(artKnopf('Frage')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(artKnopf('Fehler'), { key: '2', code: 'Digit2' })
    expect(artKnopf('Wunsch')).toHaveAttribute('aria-pressed', 'true')
    expect(feld().placeholder).toBe('Was soll das CRM können – und wofür brauchst du es?')
  })

  it('⌘↵ ohne Beschreibung: Hinweis, nichts wird gesendet', async () => {
    oeffne()
    await screen.findByRole('dialog')
    fireEvent.keyDown(feld(), { key: 'Enter', metaKey: true })
    expect(await screen.findByText('Beschreib kurz, worum es geht.')).toBeInTheDocument()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalledWith('feedback')
  })

  it('⌘↵ sendet: Screenshot in crm-feedback (<id>.webp), Zeile mit Kontext, Toast „Danke – Claude sieht es sich an.“, Dialog zu', async () => {
    const { onSchliessen } = oeffne()
    await screen.findByRole('dialog')
    fireEvent.change(feld(), { target: { value: 'Datum steht doppelt' } })
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Pipeline-Karte' } })
    fireEvent.keyDown(feld(), { key: 'Enter', metaKey: true })
    await waitFor(() => expect(onSchliessen).toHaveBeenCalled())
    expect(storage.from).toHaveBeenCalledWith('crm-feedback')
    const [pfad, blob, optionen] = storage.upload.mock.calls[0] as unknown as [string, Blob, { upsert: boolean }]
    expect(pfad).toMatch(/^[0-9a-f-]{36}\.webp$/)
    expect(blob.type).toBe('image/webp')
    expect(optionen.upsert).toBe(false)
    expect(insertAufrufe()[0]?.[0]).toMatchObject({
      id: pfad.replace('.webp', ''),
      art: 'fehler',
      titel: 'Pipeline-Karte',
      beschreibung: 'Datum steht doppelt',
      route: '/pipeline?lead=abc',
      viewport: '1440×900 @2x',
      app_version: 'test',
      screenshot_path: pfad,
      konsole: KONTEXT.konsole,
    })
    expect(toast).toHaveBeenCalledWith('Danke – Claude sieht es sich an.')
  })

  it('Bild entfernen → ohne Upload senden', async () => {
    oeffne()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot entfernen' }))
    expect(screen.getByText(/Kein Screenshot – Bild einfügen/)).toBeInTheDocument()
    fireEvent.change(feld(), { target: { value: 'Frage zur Pipeline' } })
    fireEvent.click(screen.getByRole('button', { name: /^Senden/ }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Danke – Claude sieht es sich an.'))
    expect(storage.upload).not.toHaveBeenCalled()
    expect(insertAufrufe()[0]?.[0]).toMatchObject({ screenshot_path: null })
  })

  it('eingefügtes Bild (⌘V) ersetzt den Screenshot; Text einfügen bleibt normal', async () => {
    oeffne(null)
    const dialog = await screen.findByRole('dialog')
    const datei = new File(['png'], 'bild.png', { type: 'image/png' })
    await act(async () => {
      fireEvent.paste(dialog, {
        clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => datei }], types: ['Files'] },
      })
    })
    expect(await screen.findByText('Eigenes Bild')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Screenshot der aktuellen Seite' })).toBeInTheDocument()
  })

  it('„Bild wählen“ (Telefon: Foto/Screenshot aus der Mediathek) übernimmt ein eigenes Bild', async () => {
    oeffne(null)
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Kein Screenshot.')).toBeInTheDocument()
    const eingabe = dialog.querySelector('input[type="file"]') as HTMLInputElement
    const datei = new File(['jpg'], 'foto.jpg', { type: 'image/jpeg' })
    await act(async () => {
      fireEvent.change(eingabe, { target: { files: [datei] } })
    })
    expect(await screen.findByText('Eigenes Bild')).toBeInTheDocument()
  })

  it('Abbrechen schließt ohne zu senden; Tasten wie Z bleiben im Dialog (kein globales Rückgängig dahinter)', async () => {
    const { onSchliessen } = oeffne()
    await screen.findByRole('dialog')
    const global = vi.fn()
    document.addEventListener('keydown', global)
    fireEvent.keyDown(artKnopf('Wunsch'), { key: 'z', code: 'KeyZ' })
    expect(global).not.toHaveBeenCalled()
    document.removeEventListener('keydown', global)
    fireEvent.click(screen.getByRole('button', { name: /^Abbrechen/ }))
    expect(onSchliessen).toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('scheitert der Upload, geht die Meldung trotzdem raus – Toast sagt es', async () => {
    storage.upload.mockResolvedValueOnce({ data: null as never, error: { message: 'zu groß' } })
    oeffne()
    await screen.findByRole('dialog')
    fireEvent.change(feld(), { target: { value: 'x' } })
    fireEvent.keyDown(feld(), { key: 'Enter', ctrlKey: true })
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Danke – Claude sieht es sich an. Der Screenshot ließ sich nicht hochladen.'),
    )
  })
})
