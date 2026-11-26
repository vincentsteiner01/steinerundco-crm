// „Meine Vernetzungen“ mit den echten Daten-Hooks (data/kpis) gegen einen gemockten Supabase-Client, der sich die Zähler merkt:
// Vorbelegung, Speichern (set_counter nur für geänderte Felder, mit dem Tag), leer = 0, Prüfung, Heute/Gestern, Fehler,
// Tippen vor dem Laden, Mitternacht, Tageswechsel mit ungespeicherter Eingabe. Nur erfundene Zahlen.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { kette, type Antwort } from '@/test/supabaseMock'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toast: vi.fn(), toastFehler: vi.fn(), toastUndo: vi.fn() }))

import { toast, toastFehler } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { Tageszaehler } from './Tageszaehler'

// Monatsanfang: „Gestern“ liegt im Vormonat
const HEUTE = '2026-12-01'
const GESTERN = '2026-11-30'
const KAPUTT: Antwort = { data: null, error: { message: 'Verbindung unterbrochen', code: 'XX000' } }
const FEHLER = 'Bitte eine ganze Zahl eingeben.'

type Zeile = { member_id: string; date: string; metric: string; value: number }
/** Der Ersatz für crm.daily_counters – set_counter schreibt hinein, die Abfrage liest daraus. */
let zaehler: Zeile[]
/** Welche Tage (und für wen) abgefragt wurden. */
let abfragen: { tag: unknown; member: unknown; period: unknown }[]
let ladenKaputt: boolean
let speichernKaputt: boolean
/** Gesetzt: die Abfrage der Zähler antwortet erst, wenn der Test `antworte()` aufruft. */
let warten: (() => void)[] | null
const antworte = () => {
  const offen = warten ?? []
  warten = null
  for (const weiter of offen) weiter()
}

const zeile = (date: string, metric: string, value: number, member_id = MEMBER_V): Zeile => ({
  member_id,
  date,
  metric,
  value,
})

/** from('daily_counters'): antwortet nach den gesetzten Filtern (member_id, date). */
function zaehlerKette() {
  const k = kette()
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => {
    const filter = new Map((k['eq'] as Mock).mock.calls.map(([spalte, wert]) => [spalte as string, wert as unknown]))
    abfragen.push({ tag: filter.get('date'), member: filter.get('member_id'), period: filter.get('period') })
    const antwort: Antwort = ladenKaputt
      ? KAPUTT
      : {
          data: zaehler
            .filter((z) => z.date === filter.get('date') && z.member_id === filter.get('member_id'))
            .map(({ metric, value }) => ({ metric, value })),
          error: null,
        }
    const fertig = warten ? new Promise<void>((r) => warten?.push(r)) : Promise.resolve()
    return fertig.then(() => antwort).then(res, rej)
  }
  return k
}

/** Die set_counter-Aufrufe als [Zähler, Wert, Tag]. */
const gespeichert = () =>
  vi
    .mocked(supabase.rpc)
    .mock.calls.map((c) => c as unknown as [string, { p_metric: string; p_value: number; p_date: string }])
    .filter(([name]) => name === 'set_counter')
    .map(([, a]) => [a.p_metric, a.p_value, a.p_date])

function zeigen(onGespeichert?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <Tageszaehler meId={MEMBER_V} heute={HEUTE} onGespeichert={onGespeichert} />
    </QueryClientProvider>,
  )
}

/** Wie `zeigen`; die Rückgabe stellt die Uhr auf kurz nach Mitternacht des genannten Tages und übergibt ihn als „heute“. */
function zeigenMitTageswechsel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const baum = (heute: string) => (
    <QueryClientProvider client={qc}>
      <Tageszaehler meId={MEMBER_V} heute={heute} />
    </QueryClientProvider>
  )
  const { rerender } = render(baum(HEUTE))
  return (heute: string) => {
    vi.setSystemTime(new Date(`${heute}T00:00:30+01:00`))
    rerender(baum(heute))
  }
}

const block = () => screen.getByRole('region', { name: 'Meine Vernetzungen' })
const tagGewaehlt = () =>
  within(within(block()).getByRole('group', { name: 'Tag' }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)
const versendet = () => screen.getByLabelText<HTMLInputElement>('Vernetzungen versendet')
const angenommen = () => screen.getByLabelText<HTMLInputElement>('Vernetzungen angenommen')
const knopf = () => screen.getByRole('button', { name: 'Speichern' })
const tippe = (feld: HTMLInputElement, wert: string) => fireEvent.change(feld, { target: { value: wert } })
/** Enter in einem Feld schickt im Browser das Formular ab. */
const enter = (feld: HTMLInputElement) => fireEvent.submit(feld.form as HTMLFormElement)
const geladen = (wert: string) => waitFor(() => expect(versendet()).toHaveValue(wert))

beforeEach(() => {
  // die Uhr steht auf dem Tag, den die Seite als „heute“ übergibt
  vi.useFakeTimers({ now: new Date(`${HEUTE}T09:00:00+01:00`), toFake: ['Date'] })
  warten = null
  zaehler = [
    zeile(HEUTE, 'vernetzungen_versendet', 20),
    zeile(HEUTE, 'vernetzungen_angenommen', 6),
    zeile(GESTERN, 'vernetzungen_versendet', 15),
    zeile(GESTERN, 'vernetzungen_angenommen', 4),
    // fremde Zeilen: andere Person, anderer Tag
    zeile(HEUTE, 'vernetzungen_versendet', 77, MEMBER_M),
    zeile('2026-11-29', 'vernetzungen_versendet', 88),
  ]
  abfragen = []
  ladenKaputt = false
  speichernKaputt = false
  vi.mocked(toast).mockClear()
  vi.mocked(toastFehler).mockClear()
  vi.mocked(supabase.from)
    .mockReset()
    .mockImplementation((() => zaehlerKette()) as never)
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockImplementation((async (_name: string, a: { p_metric: string; p_value: number; p_date: string }) => {
      if (speichernKaputt) return KAPUTT
      zaehler = [
        ...zaehler.filter((z) => !(z.member_id === MEMBER_V && z.date === a.p_date && z.metric === a.p_metric)),
        zeile(a.p_date, a.p_metric, a.p_value),
      ]
      return { data: null, error: null }
    }) as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Meine Vernetzungen', () => {
  it('zeigt Überschrift, Heute/Gestern, zwei beschriftete Zahlenfelder und „Speichern“', async () => {
    zeigen()
    expect(within(block()).getByRole('heading', { level: 2, name: 'Meine Vernetzungen' })).toBeInTheDocument()
    const tage = within(block()).getByRole('group', { name: 'Tag' })
    expect(within(tage).getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tage).getByRole('button', { name: 'Gestern' })).toHaveAttribute('aria-pressed', 'false')
    for (const feld of [versendet(), angenommen()]) {
      expect(feld).toHaveAttribute('type', 'text')
      expect(feld).toHaveAttribute('inputmode', 'numeric')
    }
    expect(knopf()).toHaveAttribute('type', 'submit')
    await geladen('20')
  })

  it('ist mit den gespeicherten Werten von heute vorbelegt – unverändert ist Speichern gesperrt', async () => {
    zeigen()
    expect(knopf()).toBeDisabled()
    await geladen('20')
    expect(angenommen()).toHaveValue('6')
    expect(abfragen).toEqual([{ tag: HEUTE, member: MEMBER_V, period: 'tag' }])
    expect(knopf()).toBeDisabled()
    // dieselbe Zahl noch einmal getippt ist keine Änderung
    tippe(versendet(), '020')
    expect(knopf()).toBeDisabled()
    enter(versendet())
    expect(gespeichert()).toEqual([])
  })

  it('noch nichts eingetragen: leere Felder, Speichern gesperrt, bis etwas drinsteht', async () => {
    zaehler = []
    zeigen()
    await waitFor(() => expect(abfragen).toHaveLength(1))
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('daily_counters'))
    expect(versendet()).toHaveValue('')
    expect(angenommen()).toHaveValue('')
    expect(knopf()).toBeDisabled()
    tippe(versendet(), '12')
    await waitFor(() => expect(knopf()).toBeEnabled())
  })

  it('Speichern trägt beide Zähler für den Tag ein, meldet „Gespeichert.“ und zeigt die gespeicherten Werte', async () => {
    const onGespeichert = vi.fn()
    zeigen(onGespeichert)
    await geladen('20')
    tippe(versendet(), '25')
    tippe(angenommen(), '8')
    expect(knopf()).toBeEnabled()
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(onGespeichert).toHaveBeenCalledTimes(1)
    expect(gespeichert()).toEqual([
      ['vernetzungen_versendet', 25, HEUTE],
      ['vernetzungen_angenommen', 8, HEUTE],
    ])
    expect(versendet()).toHaveValue('25')
    expect(angenommen()).toHaveValue('8')
    await waitFor(() => expect(knopf()).toBeDisabled())
    // neu geladen: derselbe Stand, weiter nichts zu speichern
    await waitFor(() => expect(abfragen.length).toBeGreaterThan(1))
    expect(versendet()).toHaveValue('25')
    expect(angenommen()).toHaveValue('8')
    expect(knopf()).toBeDisabled()
    expect(toastFehler).not.toHaveBeenCalled()
  })

  it('ein geleertes Feld zählt als 0; Enter im Feld speichert – nur das geänderte Feld', async () => {
    zeigen()
    await geladen('20')
    tippe(angenommen(), '')
    enter(angenommen())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(gespeichert()).toEqual([['vernetzungen_angenommen', 0, HEUTE]])
    await waitFor(() => expect(angenommen()).toHaveValue('0'))
    expect(versendet()).toHaveValue('20')
  })

  it('nur ein Feld geändert: das andere wird nicht angefasst', async () => {
    zeigen()
    await geladen('20')
    tippe(versendet(), '25')
    // hin und zurück getippt ist keine Änderung
    tippe(angenommen(), '9')
    tippe(angenommen(), '6')
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(gespeichert()).toEqual([['vernetzungen_versendet', 25, HEUTE]])
    expect(angenommen()).toHaveValue('6')
  })

  it('vor dem Laden getippt: das andere Feld zeigt danach den gespeicherten Wert und wird nicht mit 0 überschrieben', async () => {
    zeigen()
    await geladen('20')
    warten = []
    fireEvent.click(screen.getByRole('button', { name: 'Gestern' }))
    // die Antwort für gestern (15/4) steht noch aus
    expect(versendet()).toHaveValue('')
    tippe(versendet(), '18')
    expect(angenommen()).toHaveValue('')
    antworte()
    await waitFor(() => expect(angenommen()).toHaveValue('4'))
    expect(versendet()).toHaveValue('18')
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(gespeichert()).toEqual([['vernetzungen_versendet', 18, GESTERN]])
    expect(zaehler).toContainEqual(zeile(GESTERN, 'vernetzungen_angenommen', 4))
  })

  it('ungültige Eingabe: Fehler am Feld, Speichern gesperrt – korrigiert geht es weiter', async () => {
    zeigen()
    await geladen('20')
    for (const falsch of ['2,5', '-3', 'viele', '10000']) {
      tippe(versendet(), falsch)
      expect(versendet()).toHaveAttribute('aria-invalid', 'true')
      expect(versendet()).toHaveAccessibleDescription(FEHLER)
      expect(knopf()).toBeDisabled()
    }
    expect(within(block()).getAllByText(FEHLER)).toHaveLength(1)
    expect(angenommen()).not.toHaveAttribute('aria-invalid')
    enter(versendet())
    expect(gespeichert()).toEqual([])

    tippe(versendet(), '9999')
    expect(versendet()).not.toHaveAttribute('aria-invalid')
    expect(within(block()).queryByText(FEHLER)).not.toBeInTheDocument()
    expect(knopf()).toBeEnabled()
  })

  it('„Gestern“ lädt die Werte des Vortags, verwirft ungespeicherte Eingaben und speichert für den Vortag', async () => {
    zeigen()
    await geladen('20')
    tippe(versendet(), '99')
    fireEvent.click(screen.getByRole('button', { name: 'Gestern' }))
    await geladen('15')
    expect(angenommen()).toHaveValue('4')
    expect(abfragen.at(-1)).toEqual({ tag: GESTERN, member: MEMBER_V, period: 'tag' })
    expect(knopf()).toBeDisabled()

    tippe(angenommen(), '5')
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(gespeichert()).toEqual([['vernetzungen_angenommen', 5, GESTERN]])

    // zurück auf heute: der gespeicherte Stand, nicht die verworfene 99
    fireEvent.click(screen.getByRole('button', { name: 'Heute' }))
    await geladen('20')
    expect(angenommen()).toHaveValue('6')
    expect(knopf()).toBeDisabled()
    // und gestern zeigt, was eben gespeichert wurde
    fireEvent.click(screen.getByRole('button', { name: 'Gestern' }))
    await waitFor(() => expect(angenommen()).toHaveValue('5'))
    expect(versendet()).toHaveValue('15')
  })

  it('schlägt das Speichern fehl, meldet es die Daten-Schicht – die Eingaben bleiben stehen', async () => {
    speichernKaputt = true
    zeigen()
    await geladen('20')
    tippe(versendet(), '25')
    fireEvent.click(knopf())
    await waitFor(() => expect(toastFehler).toHaveBeenCalledTimes(1))
    expect(toast).not.toHaveBeenCalled()
    expect(versendet()).toHaveValue('25')
    expect(angenommen()).toHaveValue('6')
    await waitFor(() => expect(knopf()).toBeEnabled())
  })

  it('lässt sich der Tag nicht laden, bleibt eintragen möglich – gespeichert wird nur das getippte Feld', async () => {
    // in der Datenbank stehen 20/6, der Block kann sie nicht lesen
    ladenKaputt = true
    zeigen()
    await waitFor(() => expect(abfragen).toHaveLength(1))
    expect(versendet()).toHaveValue('')
    expect(knopf()).toBeDisabled()
    tippe(versendet(), '12')
    await waitFor(() => expect(knopf()).toBeEnabled())
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(gespeichert()).toEqual([['vernetzungen_versendet', 12, HEUTE]])
    // die 6 Annahmen sind nicht mit 0 überschrieben
    expect(zaehler).toContainEqual(zeile(HEUTE, 'vernetzungen_angenommen', 6))
    expect(versendet()).toHaveValue('12')
    expect(angenommen()).toHaveValue('')
  })

  it('nach Mitternacht, die Seite weiß es noch nicht: nichts wird unter dem alten Tag gespeichert', async () => {
    zeigen()
    await geladen('20')
    vi.setSystemTime(new Date('2026-12-02T08:00:00+01:00'))
    tippe(versendet(), '30')
    fireEvent.click(knopf())
    enter(versendet())
    expect(gespeichert()).toEqual([])
    expect(toast).not.toHaveBeenCalled()
    // die Eingabe bleibt stehen
    expect(versendet()).toHaveValue('30')
  })

  it('Tageswechsel mit Eingabe unter „Heute“: sie bleibt bei ihrem Tag – die Wahl steht dann auf „Gestern“', async () => {
    const tageswechsel = zeigenMitTageswechsel()
    await geladen('20')
    // abends getippt, nicht gespeichert; der Reiter bleibt über Mitternacht offen
    tippe(versendet(), '45')
    tageswechsel('2026-12-02')
    expect(tagGewaehlt()).toEqual(['Gestern'])
    expect(versendet()).toHaveValue('45')
    expect(angenommen()).toHaveValue('6')
    fireEvent.click(knopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    // am Tag, für den getippt wurde – nicht am neuen
    expect(gespeichert()).toEqual([['vernetzungen_versendet', 45, HEUTE]])
  })

  it('Tageswechsel mit Eingabe unter „Gestern“: ihr Tag ist nicht mehr wählbar – sie wird verworfen, nichts überschrieben', async () => {
    const tageswechsel = zeigenMitTageswechsel()
    await geladen('20')
    fireEvent.click(screen.getByRole('button', { name: 'Gestern' }))
    await geladen('15')
    tippe(versendet(), '12')
    tageswechsel('2026-12-02')
    // „Gestern“ ist jetzt der 01.12. mit seinem gespeicherten Stand (20/6) – die 12 für den 30.11. ist weg
    expect(tagGewaehlt()).toEqual(['Gestern'])
    await geladen('20')
    expect(angenommen()).toHaveValue('6')
    expect(knopf()).toBeDisabled()
    enter(versendet())
    expect(gespeichert()).toEqual([])
    expect(zaehler).toContainEqual(zeile(HEUTE, 'vernetzungen_versendet', 20))
  })

  it('Tageswechsel über mehrere Tage oder ohne Eingabe: „Heute“ bleibt und zeigt den neuen Tag', async () => {
    const tageswechsel = zeigenMitTageswechsel()
    await geladen('20')
    tageswechsel('2026-12-02')
    expect(tagGewaehlt()).toEqual(['Heute'])
    await geladen('')
    expect(abfragen.at(-1)).toEqual({ tag: '2026-12-02', member: MEMBER_V, period: 'tag' })

    // getippt, dann blieb der Rechner zwei Tage zu: der Tag der Eingabe ist weder heute noch gestern
    tippe(versendet(), '45')
    tageswechsel('2026-12-04')
    expect(tagGewaehlt()).toEqual(['Heute'])
    expect(versendet()).toHaveValue('')
    expect(knopf()).toBeDisabled()
  })

  it('zeigt keine Hinweise und keine Tastenmarken', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Tageszaehler meId={MEMBER_V} heute={HEUTE} />
      </QueryClientProvider>,
    )
    await geladen('20')
    expect(container.querySelector('kbd')).toBeNull()
    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(versendet()).toHaveAttribute('placeholder', '0')
  })
})
