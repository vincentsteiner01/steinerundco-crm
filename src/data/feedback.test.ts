import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

const {
  aendereFeedback,
  bildEndung,
  FEEDBACK_KEY,
  gesehenInitialisieren,
  GESEHEN_KEY,
  istNeueAntwort,
  liesGesehen,
  markiereGesehen,
  sendeFeedback,
  ungeseheneAntworten,
  verarbeite,
} = await import('./feedback')
type Feedback = import('./feedback').Feedback
type FeedbackNeu = import('./feedback').FeedbackNeu

const VINCENT = '11111111-1111-4111-8111-111111111111'
const MIKE = '22222222-2222-4222-8222-222222222222'

function fb(teil: Partial<Feedback>): Feedback {
  return {
    id: 'f1',
    member_id: VINCENT,
    art: 'fehler',
    titel: null,
    beschreibung: 'Karte bricht um',
    route: '/pipeline',
    url: 'http://localhost:8768/pipeline',
    viewport: '1440×900 @2x',
    user_agent: 'UA',
    app_version: 'test',
    konsole: [],
    screenshot_path: null,
    status: 'neu',
    antwort: null,
    antwort_at: null,
    notiz: null,
    notiz_at: null,
    notiz_von: null,
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
    ...teil,
  }
}

/** Minimaler Client: from('feedback').insert().select().single() / update().eq().select().single() + storage. */
function client(opts: { uploadFehler?: unknown; insertFehler?: unknown } = {}) {
  const single = vi.fn(async () =>
    opts.insertFehler ? { data: null, error: opts.insertFehler } : { data: { id: 'neu' }, error: null },
  )
  const kette: Record<string, unknown> = {}
  for (const m of ['insert', 'update', 'select', 'eq']) kette[m] = vi.fn(() => kette)
  kette['single'] = single
  const upload = vi.fn(async () =>
    opts.uploadFehler ? { data: null, error: opts.uploadFehler } : { data: {}, error: null },
  )
  const storageFrom = vi.fn(() => ({ upload }))
  const c = { from: vi.fn(() => kette), storage: { from: storageFrom } }
  return { c: c as never, kette, upload, storageFrom }
}

const neu = (teil: Partial<FeedbackNeu> = {}): FeedbackNeu => ({
  id: '3f2a9c1e-1b2c-4d5e-8f90-123456789abc',
  art: 'fehler',
  titel: '  Pipeline  ',
  beschreibung: '  Datum doppelt  ',
  route: '/pipeline',
  url: 'http://localhost:8768/pipeline',
  viewport: '1440×900 @2x',
  user_agent: 'UA',
  app_version: 'test',
  konsole: [{ zeit: 'z', art: 'error', text: 'x' }],
  bild: null,
  ...teil,
})

describe('feedback – Senden', () => {
  it('lädt den Screenshot zuerst hoch (<id>.webp, ohne Überschreiben) und legt dann die Zeile mit screenshot_path an', async () => {
    const { c, kette, upload, storageFrom } = client()
    const bild = new Blob(['x'], { type: 'image/webp' })
    const r = await sendeFeedback(neu({ bild }), c)
    expect(storageFrom).toHaveBeenCalledWith('crm-feedback')
    expect(upload).toHaveBeenCalledWith('3f2a9c1e-1b2c-4d5e-8f90-123456789abc.webp', bild, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '3600',
    })
    expect(kette['insert']).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '3f2a9c1e-1b2c-4d5e-8f90-123456789abc',
        titel: 'Pipeline',
        beschreibung: 'Datum doppelt',
        screenshot_path: '3f2a9c1e-1b2c-4d5e-8f90-123456789abc.webp',
        route: '/pipeline',
        viewport: '1440×900 @2x',
        konsole: [{ zeit: 'z', art: 'error', text: 'x' }],
      }),
    )
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      (kette['insert'] as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!,
    )
    expect(r).toEqual({ id: '3f2a9c1e-1b2c-4d5e-8f90-123456789abc', mitBild: true, bildFehler: false })
  })

  it('scheitert nur der Upload, wird die Meldung ohne Bild gespeichert (bildFehler)', async () => {
    const { c, kette } = client({ uploadFehler: { message: 'Payload too large' } })
    const r = await sendeFeedback(neu({ bild: new Blob(['x'], { type: 'image/png' }) }), c)
    expect(kette['insert']).toHaveBeenCalledWith(expect.objectContaining({ screenshot_path: null }))
    expect(r).toMatchObject({ mitBild: false, bildFehler: true })
  })

  it('zweiter Versuch: Bild liegt schon im Bucket („already exists“) → Pfad trotzdem gesetzt', async () => {
    const { c, kette } = client({ uploadFehler: { message: 'The resource already exists', statusCode: '409' } })
    const r = await sendeFeedback(neu({ bild: new Blob(['x'], { type: 'image/webp' }) }), c)
    expect(kette['insert']).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot_path: '3f2a9c1e-1b2c-4d5e-8f90-123456789abc.webp' }),
    )
    expect(r).toMatchObject({ mitBild: true, bildFehler: false })
  })

  it('ohne Bild kein Upload; leerer Titel wird null', async () => {
    const { c, kette, upload } = client()
    await sendeFeedback(neu({ titel: '   ' }), c)
    expect(upload).not.toHaveBeenCalled()
    expect(kette['insert']).toHaveBeenCalledWith(expect.objectContaining({ titel: null, screenshot_path: null }))
  })

  it('falscher Bildtyp wird nicht hochgeladen', async () => {
    const { c, upload } = client()
    const r = await sendeFeedback(neu({ bild: new Blob(['x'], { type: 'image/gif' }) }), c)
    expect(upload).not.toHaveBeenCalled()
    expect(r.bildFehler).toBe(true)
  })

  it('Fehler beim Anlegen wird geworfen (Toast über mutationFehler)', async () => {
    const { c } = client({ insertFehler: { code: '42501', message: 'denied' } })
    await expect(sendeFeedback(neu(), c)).rejects.toMatchObject({ code: '42501' })
  })

  it('bildEndung: png · jpg · webp, sonst null', () => {
    expect(bildEndung('image/png')).toBe('png')
    expect(bildEndung('image/jpeg')).toBe('jpg')
    expect(bildEndung('image/webp')).toBe('webp')
    expect(bildEndung('image/heic')).toBeNull()
  })
})

describe('feedback – Status und Notiz', () => {
  it('schickt nur die geänderten Felder; leere Notiz wird null', async () => {
    const { c, kette } = client()
    await aendereFeedback({ id: 'f1', status: 'erledigt' }, c)
    expect(kette['update']).toHaveBeenLastCalledWith({ status: 'erledigt' })
    await aendereFeedback({ id: 'f1', notiz: '  ' }, c)
    expect(kette['update']).toHaveBeenLastCalledWith({ notiz: null })
    expect(kette['eq']).toHaveBeenCalledWith('id', 'f1')
  })
})

describe('feedback – Antworten von Claude (gesehen-Merkliste, Realtime)', () => {
  beforeEach(() => localStorage.removeItem(GESEHEN_KEY))

  it('erster Start: vorhandene Antworten werden still als gesehen gemerkt', () => {
    const liste = [fb({ id: 'a', antwort: 'ok', antwort_at: 't1' }), fb({ id: 'b' })]
    gesehenInitialisieren(liste)
    expect(liesGesehen()).toEqual({ a: 't1' })
    expect(ungeseheneAntworten(liste, VINCENT, liesGesehen())).toEqual([])
  })

  it('ungesehen = eigene Meldung mit Antwort, deren antwort_at nicht gemerkt ist (fremde zählen nicht)', () => {
    markiereGesehen('a', 't1')
    const liste = [
      fb({ id: 'a', antwort: 'ok', antwort_at: 't2' }),
      fb({ id: 'b', antwort: 'ok', antwort_at: 't1' }),
      fb({ id: 'c', member_id: MIKE, antwort: 'ok', antwort_at: 't1' }),
    ]
    expect(ungeseheneAntworten(liste, VINCENT, liesGesehen()).map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('Realtime: invalidiert die Liste und meldet eine neue Antwort genau einmal', () => {
    const qc = new QueryClient()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const beiAntwort = vi.fn()
    const neu = fb({ id: 'x', status: 'erledigt', antwort: 'Behoben', antwort_at: '2026-10-15T11:00:00Z' })
    verarbeite(qc, { eventType: 'UPDATE', new: neu as never }, VINCENT, beiAntwort)
    verarbeite(qc, { eventType: 'UPDATE', new: neu as never }, VINCENT, beiAntwort)
    expect(inv).toHaveBeenCalledWith({ queryKey: FEEDBACK_KEY })
    expect(beiAntwort).toHaveBeenCalledTimes(1)
    expect(beiAntwort).toHaveBeenCalledWith(expect.objectContaining({ id: 'x', antwort: 'Behoben' }))
  })

  it('Realtime: Antwort auf Mikes Meldung oder Statuswechsel ohne Antwort → kein Toast', () => {
    const qc = new QueryClient()
    const beiAntwort = vi.fn()
    verarbeite(
      qc,
      { eventType: 'UPDATE', new: fb({ member_id: MIKE, antwort: 'a', antwort_at: 't' }) as never },
      VINCENT,
      beiAntwort,
    )
    verarbeite(qc, { eventType: 'UPDATE', new: fb({ status: 'in_arbeit' }) as never }, VINCENT, beiAntwort)
    verarbeite(qc, { eventType: 'DELETE', new: {} as never }, VINCENT, beiAntwort)
    expect(beiAntwort).not.toHaveBeenCalled()
  })

  it('istNeueAntwort: neue antwort_at nach einer Korrektur zählt wieder', () => {
    expect(istNeueAntwort(fb({ antwort: 'a', antwort_at: 't2' }), VINCENT, { f1: 't1' })).toBe(true)
    expect(istNeueAntwort(fb({ antwort: 'a', antwort_at: 't1' }), VINCENT, { f1: 't1' })).toBe(false)
  })
})
