// KPI-Seite mit den echten Daten-Hooks gegen einen gemockten Supabase-Client, der v_kpi_tage nach Zeitraum und Person
// beantwortet: Zahlen in Kacheln und Funnel, Person/Team und Zeitraum in URL und Abfrage, ←/→, alte Monatszähler nur in der
// Monatsansicht (sonst kein Vergleich für ihre Kennzahlen), Laden, Fehler mit „Erneut versuchen“, „Meine Vernetzungen“ immer da
// (Speichern führt zur eigenen Person, nach Mitternacht gilt der neue Tag), keine Tastenmarken. Dazu: beim Blättern bleiben die
// bisherigen Zahlen stehen, ein gescheitertes Neuladen im Hintergrund lässt sie stehen, Monatszähler anderer Personen.
// „Heute“ ist Donnerstag, der 26.11.2026 (KW 48). Nur erfundene Personen und Zahlen; die Rechenlogik prüft kennzahlen.test.ts.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { kette, type Antwort } from '@/test/supabaseMock'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toast: vi.fn(), toastFehler: vi.fn(), toastUndo: vi.fn() }))

import { toast } from '@/components/toast'
import { qk } from '@/data/queryKeys'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { fmtAnteil } from '@/lib/format'
import { leereSummen, type KpiZeile, type Summen } from './kennzahlen'
import { Component as KpisSeite } from './KpisSeite'

const JETZT = new Date('2026-11-26T09:00:00+01:00')
const KAPUTT: Antwort = { data: null, error: { message: 'Verbindung unterbrochen', code: 'XX000' } }
const SATZ = 'Die KPIs konnten nicht geladen werden.'

// Karla Kennzahl ist angemeldet; Bodo Beispiel ist die zweite Person
const MITGLIEDER = [
  { id: MEMBER_M, display_name: 'Bodo Beispiel', short_name: 'BB', email: 'bodo@beispiel.test' },
  { id: MEMBER_V, display_name: 'Karla Kennzahl', short_name: 'KK', email: 'karla@beispiel.test' },
]

const zeile = (
  member_id: string,
  tag: string,
  werte: Partial<Summen>,
  period: KpiZeile['period'] = 'tag',
): KpiZeile => ({ member_id, tag, period, ...leereSummen(), ...werte })

/** Der Ersatz für crm.v_kpi_tage. */
const ZEILEN: KpiZeile[] = [
  // alter Monatszähler Oktober und ein Tag im Oktober
  zeile(MEMBER_V, '2026-10-01', { vernetzungen_versendet: 300, vernetzungen_angenommen: 90 }, 'monat'),
  zeile(MEMBER_V, '2026-10-20', { angeschrieben: 5 }),
  // November, Karla: 30 versendet · 9 angenommen · 10 angeschrieben · 2 Gespräche · 1 im Geschäft · 1 verloren · 8 Mails · 2 Antworten
  zeile(MEMBER_V, '2026-11-02', { vernetzungen_versendet: 20, vernetzungen_angenommen: 5, angeschrieben: 4 }),
  zeile(MEMBER_V, '2026-11-24', {
    vernetzungen_versendet: 10,
    vernetzungen_angenommen: 4,
    angeschrieben: 6,
    gespraech: 2,
    emails_gesendet: 8,
    email_antworten: 2,
  }),
  zeile(MEMBER_V, '2026-11-25', { im_geschaeft: 1, verloren: 1 }),
  // Bodo: kein eigener Monatszähler, im Oktober nur ein später Tageswert; November
  zeile(MEMBER_M, '2026-10-26', { vernetzungen_versendet: 14, angeschrieben: 2 }),
  zeile(MEMBER_M, '2026-11-24', { vernetzungen_versendet: 40, angeschrieben: 3, gespraech: 1 }),
]

type Abfrage = { member: unknown; von: string; bis: string }
/** Jede Abfrage der Zahlen an v_kpi_tage: Zeitraum und – falls gesetzt – der Filter auf die Person. */
let abfragen: Abfrage[]
/** Die Abfragen nur der alten Monatszähler (`period = 'monat'`, alle Personen) – sie begleiten die Ansicht einer Person. */
let zaehlerAbfragen: Abfrage[]
let kpisKaputt: boolean
/** Gesetzt: v_kpi_tage antwortet erst, wenn der Test `antworte()` aufruft. */
let kpisWarten: (() => void)[] | null
const antworte = () => {
  const offen = kpisWarten ?? []
  kpisWarten = null
  for (const weiter of offen) weiter()
}
let qc: QueryClient
let mitgliederAntwort: Antwort
/** Für wen „Meine Vernetzungen“ die Zähler lädt – und für welche Tage. */
let zaehlerFuer: unknown[]
let zaehlerTage: unknown[]
/** Die set_counter-Aufrufe als [Zähler, Wert, Tag]. */
const gespeichert = () =>
  vi
    .mocked(supabase.rpc)
    .mock.calls.map((c) => c as unknown as [string, { p_metric: string; p_value: number; p_date: string }])
    .filter(([name]) => name === 'set_counter')
    .map(([, a]) => [a.p_metric, a.p_value, a.p_date])

/** from('v_kpi_tage'): antwortet nach den gesetzten Filtern (tag von/bis, member_id, period). */
function kpiKette() {
  const k = kette()
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => {
    const von = (k['gte'] as Mock).mock.calls[0]?.[1] as string
    const bis = (k['lte'] as Mock).mock.calls[0]?.[1] as string
    const filter = new Map((k['eq'] as Mock).mock.calls.map(([spalte, wert]) => [spalte as string, wert as unknown]))
    const member = filter.get('member_id')
    const period = filter.get('period')
    ;(period === 'monat' ? zaehlerAbfragen : abfragen).push({ member, von, bis })
    const antwort: Antwort = kpisKaputt
      ? KAPUTT
      : {
          data: ZEILEN.filter(
            (z) =>
              z.tag >= von &&
              z.tag <= bis &&
              (member === undefined || z.member_id === member) &&
              (period === undefined || z.period === period),
          ),
          error: null,
        }
    const fertig = kpisWarten ? new Promise<void>((r) => kpisWarten?.push(r)) : Promise.resolve()
    return fertig.then(() => antwort).then(res, rej)
  }
  return k
}

function zaehlerKette() {
  const k = kette()
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => {
    zaehlerFuer.push((k['eq'] as Mock).mock.calls.find(([spalte]) => spalte === 'member_id')?.[1])
    zaehlerTage.push((k['eq'] as Mock).mock.calls.find(([spalte]) => spalte === 'date')?.[1])
    return Promise.resolve({ data: [], error: null }).then(res, rej)
  }
  return k
}

function Ort() {
  const { pathname, search } = useLocation()
  // bewusst kein <output>: das trüge die Rolle „status“ wie der Lade-Platzhalter
  return <span data-testid="ort">{pathname + search}</span>
}

function zeigen(url = '/kpis') {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/kpis" element={<KpisSeite />} />
        </Routes>
        <Ort />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ort = () => screen.getByTestId('ort').textContent
const titel = () => screen.getByRole('heading', { level: 1 }).textContent
const klick = (gruppe: string, knopf: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: gruppe })).getByRole('button', { name: knopf }))
const gedrueckt = (gruppe: string) =>
  within(screen.getByRole('group', { name: gruppe }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)
const zurueck = () => screen.getByRole('button', { name: 'Früher' })
const vor = () => screen.getByRole('button', { name: 'Später' })
const geladen = () => screen.findByRole('list', { name: 'Kennzahlen' })

/** Eine Kachel als Text; wirft, solange sie (noch) nicht da ist – so wartet `waitFor` darauf. */
function kachel(key: string) {
  const el = document.querySelector(`[data-kachel="${key}"]`)
  if (!el) throw new Error(`Kachel „${key}“ fehlt`)
  return {
    wert: el.querySelector('[data-wert]')?.textContent,
    quote: el.querySelector('[data-quote]')?.textContent ?? null,
    delta: el.querySelector('[data-delta]')?.textContent,
    sheet: !!el.querySelector('[data-badge="sheet"]'),
  }
}
const funnel = () =>
  Array.from(document.querySelectorAll('[data-zeile]')).map((li) => [
    li.getAttribute('data-zeile'),
    li.querySelector('[data-wert]')?.getAttribute('data-wert'),
    li.querySelector('[data-konversion]')?.textContent ?? null,
  ])
/** Personenfilter der jüngsten Abfragen (Zeitraum und Vorperiode). */
const letzteFilter = () => abfragen.slice(-2).map((a) => a.member)

beforeEach(() => {
  // „heute“ fest: Titel, Dateline, laufende Woche und die Sperre von → hängen daran
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  abfragen = []
  zaehlerAbfragen = []
  kpisWarten = null
  zaehlerFuer = []
  zaehlerTage = []
  kpisKaputt = false
  mitgliederAntwort = { data: MITGLIEDER, error: null }
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: MEMBER_V, email: 'karla@beispiel.test', display_name: 'Karla Kennzahl' },
  })
  vi.mocked(supabase.from)
    .mockReset()
    .mockImplementation(((tabelle: string) =>
      tabelle === 'v_kpi_tage'
        ? kpiKette()
        : tabelle === 'daily_counters'
          ? zaehlerKette()
          : kette(mitgliederAntwort)) as never)
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValue({ data: null, error: null } as never)
})

afterEach(() => {
  vi.useRealTimers()
  useAuth.setState({ status: 'anonym', session: null, member: null })
})

describe('KPIs', () => {
  it('ohne Wahl: die angemeldete Person im laufenden Monat – Zahlen in Kacheln, Funnel und E-Mail', async () => {
    zeigen()
    await geladen()
    expect(titel()).toBe('November 2026')
    expect(screen.getByText('Karla · 01.–26.11.2026')).toBeInTheDocument()
    expect(gedrueckt('Person')).toEqual(['Karla'])
    expect(gedrueckt('Zeitraum')).toEqual(['Monat'])
    expect(ort()).toBe('/kpis')
    // Zeitraum und Vormonat, beide nur für Karla
    expect(abfragen).toEqual(
      expect.arrayContaining([
        { member: MEMBER_V, von: '2026-11-01', bis: '2026-11-30' },
        { member: MEMBER_V, von: '2026-10-01', bis: '2026-10-31' },
      ]),
    )
    expect(abfragen).toHaveLength(2)
    // dazu die Monatszähler aller Personen über beide Monate
    expect(zaehlerAbfragen).toEqual([{ member: undefined, von: '2026-10-01', bis: '2026-11-30' }])

    const kacheln = within(screen.getByRole('list', { name: 'Kennzahlen' })).getAllByRole('listitem')
    expect(kacheln.map((k) => k.getAttribute('data-kachel'))).toEqual([
      'vernetzungen_versendet',
      'vernetzungen_angenommen',
      'angeschrieben',
      'gespraech',
      'im_geschaeft',
      'verloren',
    ])
    expect(kachel('vernetzungen_versendet').wert).toBe('30')
    expect(kachel('vernetzungen_angenommen')).toMatchObject({ wert: '9', quote: fmtAnteil(0.3) })
    expect(kachel('angeschrieben').wert).toBe('10')
    expect(kachel('angeschrieben').delta).toContain('+5')
    expect(kachel('angeschrieben').delta).toContain('vs. Okt. 5')
    expect(kachel('gespraech')).toMatchObject({ wert: '2', quote: fmtAnteil(0.2) })
    expect(kachel('im_geschaeft')).toMatchObject({ wert: '1', quote: fmtAnteil(0.5) })
    expect(kachel('verloren').wert).toBe('1')

    const funnelBlock = screen.getByRole('region', { name: 'Funnel' })
    expect(within(funnelBlock).getByRole('heading', { level: 2 }).parentElement).toHaveTextContent(
      'FunnelAnteil zur Vorstufe · Vergleich Okt.',
    )
    expect(funnel()).toEqual([
      ['vernetzungen_versendet', '30', null],
      ['vernetzungen_angenommen', '9', fmtAnteil(0.3)],
      // Board-Karten sind keine Teilmenge der Annahmen: keine Quote
      ['angeschrieben', '10', null],
      ['gespraech', '2', fmtAnteil(0.2)],
      ['im_geschaeft', '1', fmtAnteil(0.5)],
    ])

    const mail = within(screen.getByRole('region', { name: 'E-Mail' }))
    expect(mail.getAllByRole('listitem').map((k) => k.getAttribute('data-kachel'))).toEqual([
      'emails_gesendet',
      'email_antworten',
    ])
    expect(kachel('emails_gesendet').wert).toBe('8')
    expect(kachel('email_antworten')).toMatchObject({ wert: '2', quote: fmtAnteil(0.25) })
  })

  it('Blöcke in fester Reihenfolge; Tagesverlauf mit drei Kennzahlen, Wochentabelle mit den Spalten des Boards', async () => {
    zeigen()
    await geladen()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Meine Vernetzungen',
      'Funnel',
      'Angeschrieben pro Tag',
      'Wochen',
      'E-Mail',
    ])
    const metrik = within(screen.getByRole('group', { name: 'Metrik' }))
    expect(metrik.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Angeschrieben',
      'Vernetzungen',
      'Gespräche',
    ])
    expect(gedrueckt('Metrik')).toEqual(['Angeschrieben'])
    const tabelle = within(screen.getByRole('table', { name: 'Wochentabelle' }))
    expect(tabelle.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Woche',
      'Zeitraum',
      'Vernetzungen',
      'Angenommen',
      'Angeschrieben',
      'Gespräche',
      'Im Geschäft',
      'Verloren',
    ])
    expect(tabelle.getByText('Monat gesamt')).toBeInTheDocument()

    klick('Metrik', 'Gespräche')
    expect(screen.getByRole('heading', { level: 2, name: 'Gespräch vereinbart pro Tag' })).toBeInTheDocument()
  })

  it('Personenwechsel und „Team“ stehen in der URL und ändern die Abfrage', async () => {
    zeigen()
    await geladen()
    expect(
      within(screen.getByRole('group', { name: 'Person' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Bodo', 'Karla', 'Team'])

    klick('Person', 'Bodo')
    expect(ort()).toBe('/kpis?person=bodo')
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('3'))
    expect(kachel('gespraech').wert).toBe('1')
    expect(kachel('vernetzungen_versendet').wert).toBe('40')
    expect(gedrueckt('Person')).toEqual(['Bodo'])
    expect(screen.getByText('Bodo · 01.–26.11.2026')).toBeInTheDocument()
    expect(letzteFilter()).toEqual([MEMBER_M, MEMBER_M])

    klick('Person', 'Team')
    expect(ort()).toBe('/kpis?person=team')
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('13'))
    expect(kachel('gespraech').wert).toBe('3')
    expect(kachel('vernetzungen_versendet').wert).toBe('70')
    expect(gedrueckt('Person')).toEqual(['Team'])
    expect(screen.getByText('Team · 01.–26.11.2026')).toBeInTheDocument()
    // Team = kein Filter auf die Person
    expect(letzteFilter()).toEqual([undefined, undefined])
    expect(abfragen).toHaveLength(6)
    // die Monatszähler aller: einmal geladen (für beide Personen dieselbe Spanne), für das Team gar nicht
    expect(zaehlerAbfragen).toHaveLength(1)
  })

  it('Zeitraumwechsel und ←/→ ändern Titel, URL und Abfrage; → ist gesperrt, wenn nichts mehr folgt', async () => {
    zeigen()
    await geladen()
    expect(vor()).toBeDisabled()

    klick('Zeitraum', 'Woche')
    expect(titel()).toBe('KW 48')
    expect(ort()).toBe('/kpis?zeitraum=kw48')
    expect(gedrueckt('Zeitraum')).toEqual(['Woche'])
    expect(vor()).toBeDisabled()
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('6'))
    expect(kachel('angeschrieben').delta).toContain('vs. KW 47 0')
    expect(screen.getByText('Karla · 23.–26.11.2026')).toBeInTheDocument()
    // geladen wird ab dem Monatsersten (dort stünden alte Monatszähler), gezählt nur die Woche
    expect(abfragen).toContainEqual({ member: MEMBER_V, von: '2026-11-01', bis: '2026-11-29' })
    expect(abfragen).toContainEqual({ member: MEMBER_V, von: '2026-11-01', bis: '2026-11-22' })

    fireEvent.click(zurueck())
    expect(titel()).toBe('KW 47')
    expect(ort()).toBe('/kpis?zeitraum=kw47')
    expect(vor()).toBeEnabled()
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('0'))

    fireEvent.click(vor())
    expect(titel()).toBe('KW 48')
    expect(ort()).toBe('/kpis?zeitraum=kw48')

    klick('Zeitraum', '7 Tage')
    expect(titel()).toBe('Letzte 7 Tage')
    expect(ort()).toBe('/kpis?zeitraum=7t')
    await waitFor(() => expect(kachel('angeschrieben').delta).toContain('vs. davor 0'))

    // Blättern aus „7 Tage“: die sieben Tage davor als eigene Spanne – „7 Tage“ bleibt markiert
    fireEvent.click(zurueck())
    expect(titel()).toBe('13.–19.11.2026')
    expect(ort()).toBe('/kpis?zeitraum=custom&von=2026-11-13&bis=2026-11-19')
    expect(gedrueckt('Zeitraum')).toEqual(['7 Tage'])
    expect(vor()).toBeEnabled()
    // und wieder vor: zurück bei den letzten sieben Tagen
    fireEvent.click(vor())
    expect(titel()).toBe('Letzte 7 Tage')
    expect(ort()).toBe('/kpis?zeitraum=7t')
    expect(gedrueckt('Zeitraum')).toEqual(['7 Tage'])
    expect(vor()).toBeDisabled()

    klick('Zeitraum', '30 Tage')
    expect(titel()).toBe('Letzte 30 Tage')
    expect(ort()).toBe('/kpis?zeitraum=30t')

    klick('Zeitraum', 'Monat')
    expect(titel()).toBe('November 2026')
    expect(ort()).toBe('/kpis?zeitraum=2026-11')
  })

  it('liest Person und Zeitraum aus der URL; beides bleibt beim Wechsel des anderen stehen', async () => {
    zeigen('/kpis?person=bodo&zeitraum=7t')
    await geladen()
    expect(titel()).toBe('Letzte 7 Tage')
    expect(gedrueckt('Person')).toEqual(['Bodo'])
    expect(gedrueckt('Zeitraum')).toEqual(['7 Tage'])
    expect(kachel('angeschrieben').wert).toBe('3')
    expect(abfragen).toContainEqual({ member: MEMBER_M, von: '2026-11-01', bis: '2026-11-26' })

    klick('Zeitraum', 'Woche')
    expect(ort()).toBe('/kpis?person=bodo&zeitraum=kw48')
    klick('Person', 'Team')
    expect(ort()).toBe('/kpis?person=team&zeitraum=kw48')
  })

  it('unbekannte Person in der URL: die angemeldete Person', async () => {
    zeigen('/kpis?person=niemand')
    await geladen()
    expect(gedrueckt('Person')).toEqual(['Karla'])
    expect(kachel('angeschrieben').wert).toBe('10')
  })

  it('alte Monatszähler zählen nur in der Monatsansicht – dort mit der Marke „aus Sheet“', async () => {
    const { unmount } = zeigen('/kpis?zeitraum=2026-10')
    await geladen()
    expect(titel()).toBe('Oktober 2026')
    expect(vor()).toBeEnabled()
    expect(kachel('vernetzungen_versendet')).toMatchObject({ wert: '300', sheet: true })
    expect(kachel('vernetzungen_angenommen')).toMatchObject({ wert: '90', quote: fmtAnteil(0.3), sheet: true })
    expect(kachel('angeschrieben')).toMatchObject({ wert: '5', sheet: false })
    // Tagesverlauf und Wochentabelle kennen die Monatszähler nicht: die Spalte bleibt leer und fällt weg
    const tabelle = within(screen.getByRole('table', { name: 'Wochentabelle' }))
    expect(tabelle.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Woche',
      'Zeitraum',
      'Angeschrieben',
    ])
    expect(tabelle.queryByText('300')).toBeNull()
    // … und ihre Summe ist deshalb nicht der ganze Monat
    expect(tabelle.getByText('Gesamt')).toBeInTheDocument()
    expect(tabelle.queryByText('Monat gesamt')).toBeNull()
    unmount()

    // KW 40 (28.09.–04.10.) enthält den 01.10. – der Monatszähler liegt im Zeitraum und zählt trotzdem nicht
    zeigen('/kpis?zeitraum=kw40')
    await geladen()
    expect(titel()).toBe('KW 40')
    expect(kachel('vernetzungen_versendet')).toMatchObject({ wert: '0', sheet: false })
    expect(kachel('vernetzungen_angenommen')).toMatchObject({ wert: '0', quote: null, sheet: false })
    // ohne die Monatszähler stimmt der Vergleich nicht: er bleibt leer, die Board-Zahlen behalten ihn
    expect(kachel('vernetzungen_versendet').delta).toBe('–')
    expect(kachel('vernetzungen_angenommen').delta).toBe('–')
    expect(kachel('angeschrieben').delta).toContain('vs. KW 39 0')

    // November: der Monatszähler des Vormonats ist der Vergleich
    klick('Zeitraum', 'Monat')
    await waitFor(() => expect(kachel('vernetzungen_versendet').wert).toBe('30'))
    expect(kachel('vernetzungen_versendet').delta).toContain('vs. Okt. 300')
  })

  it('„30 Tage“ über einen Monat mit alten Monatszählern: kein Vergleich für diese Kennzahlen, auch nicht im Funnel', async () => {
    // 28.10.–26.11. gegen 28.09.–27.10.; im Oktober stehen die Vernetzungen nur im Monatszähler
    zeigen('/kpis?zeitraum=30t')
    await geladen()
    expect(abfragen).toContainEqual({ member: MEMBER_V, von: '2026-10-01', bis: '2026-11-26' })
    expect(abfragen).toContainEqual({ member: MEMBER_V, von: '2026-09-01', bis: '2026-10-27' })
    expect(kachel('vernetzungen_versendet')).toMatchObject({ wert: '30', delta: '–' })
    expect(kachel('vernetzungen_angenommen')).toMatchObject({ wert: '9', quote: fmtAnteil(0.3), delta: '–' })
    // Angeschrieben stand immer als Tageswert da (5 am 20.10.)
    expect(kachel('angeschrieben').delta).toBe('+5 vs. davor 5')
    const versendet = document.querySelector('[data-zeile="vernetzungen_versendet"] [data-delta]')
    expect(versendet?.textContent).toBe('–')
    expect(document.querySelector('[data-zeile="angeschrieben"] [data-delta]')?.textContent).toBe('+5davor 5')
    expect(document.body.textContent).not.toMatch(/\bpp\b/)
  })

  it('ohne Daten stehen Nullen da – keine Sonderseite', async () => {
    zeigen('/kpis?zeitraum=2026-08')
    await geladen()
    expect(titel()).toBe('August 2026')
    expect(kachel('angeschrieben').wert).toBe('0')
    expect(funnel().map(([, wert]) => wert)).toEqual(['0', '0', '0', '0', '0'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Laden: „Meine Vernetzungen“ steht schon da, die Zahlen folgen', async () => {
    zeigen()
    expect(screen.getByRole('region', { name: 'Meine Vernetzungen' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Kennzahlen' })).toBeNull()
    expect(titel()).toBe('November 2026')
    await geladen()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('„Meine Vernetzungen“ gehört immer der angemeldeten Person – auch in der Ansicht Team oder einer anderen Person', async () => {
    zeigen('/kpis?person=team')
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    expect(block.getByLabelText('Vernetzungen versendet')).toBeInTheDocument()
    expect(block.getByLabelText('Vernetzungen angenommen')).toBeInTheDocument()
    expect(block.getByRole('button', { name: 'Speichern' })).toBeInTheDocument()

    klick('Person', 'Bodo')
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('3'))
    expect(screen.getByRole('region', { name: 'Meine Vernetzungen' })).toBeInTheDocument()
    expect(zaehlerFuer.length).toBeGreaterThan(0)
    expect(new Set(zaehlerFuer)).toEqual(new Set([MEMBER_V]))
  })

  it('Speichern, während eine andere Person gezeigt wird: die Seite wechselt zur angemeldeten Person', async () => {
    zeigen('/kpis?person=bodo&zeitraum=kw48')
    await geladen()
    expect(gedrueckt('Person')).toEqual(['Bodo'])
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    fireEvent.change(block.getByLabelText('Vernetzungen versendet'), { target: { value: '48' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(ort()).toBe('/kpis?person=karla&zeitraum=kw48'))
    expect(gespeichert()).toEqual([['vernetzungen_versendet', 48, '2026-11-26']])
    expect(gedrueckt('Person')).toEqual(['Karla'])
  })

  it('Speichern in der Ansicht Team oder der eigenen: die Wahl bleibt', async () => {
    zeigen('/kpis?person=team')
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    fireEvent.change(block.getByLabelText('Vernetzungen angenommen'), { target: { value: '7' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(gespeichert()).toEqual([['vernetzungen_angenommen', 7, '2026-11-26']]))
    await waitFor(() => expect(block.getByRole('button', { name: 'Speichern' })).toBeDisabled())
    expect(ort()).toBe('/kpis?person=team')
  })

  it('bleibt der Reiter über Nacht offen, gilt nach Mitternacht der neue Tag – der Eintrag landet nicht am Vortag', async () => {
    zeigen()
    await geladen()
    expect(screen.getByText('Karla · 01.–26.11.2026')).toBeInTheDocument()
    expect(new Set(zaehlerTage)).toEqual(new Set(['2026-11-26']))

    // am nächsten Morgen bekommt das Fenster wieder den Fokus
    vi.setSystemTime(new Date('2026-11-27T08:00:00+01:00'))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.getByText('Karla · 01.–27.11.2026')).toBeInTheDocument()
    await waitFor(() => expect(zaehlerTage).toContain('2026-11-27'))

    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    fireEvent.change(block.getByLabelText('Vernetzungen versendet'), { target: { value: '30' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(gespeichert()).toEqual([['vernetzungen_versendet', 30, '2026-11-27']]))
  })

  it('Mitternacht ohne jedes Ereignis: der erste Klick auf „Speichern“ übernimmt nur den neuen Tag – die Eingabe bleibt bei ihrem Tag', async () => {
    zeigen()
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    const feld = () => block.getByLabelText<HTMLInputElement>('Vernetzungen versendet')
    vi.setSystemTime(new Date('2026-11-27T00:00:20+01:00'))
    fireEvent.change(feld(), { target: { value: '30' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    expect(gespeichert()).toEqual([])
    expect(await screen.findByText('Karla · 01.–27.11.2026')).toBeInTheDocument()
    // getippt wurde unter „Heute“ = 26.11. – das ist jetzt „Gestern“, die Zahl landet nicht am 27.
    expect(feld()).toHaveValue('30')
    expect(gedrueckt('Tag')).toEqual(['Gestern'])

    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(gespeichert()).toEqual([['vernetzungen_versendet', 30, '2026-11-26']]))
  })

  it('Speichern dauert, inzwischen ein anderer Zeitraum gewählt: der Wechsel zur eigenen Person behält ihn', async () => {
    let antwort: (a: unknown) => void = () => {}
    vi.mocked(supabase.rpc).mockImplementation((() => new Promise((r) => (antwort = r))) as never)
    zeigen('/kpis?person=bodo')
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    fireEvent.change(block.getByLabelText('Vernetzungen versendet'), { target: { value: '48' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(gespeichert()).toHaveLength(1))

    klick('Zeitraum', 'Woche')
    expect(ort()).toBe('/kpis?person=bodo&zeitraum=kw48')
    antwort({ data: null, error: null })
    await waitFor(() => expect(ort()).toBe('/kpis?person=karla&zeitraum=kw48'))
    expect(titel()).toBe('KW 48')
  })

  it('Speichern dauert, inzwischen „Team“ gewählt: Team bleibt', async () => {
    let antwort: (a: unknown) => void = () => {}
    vi.mocked(supabase.rpc).mockImplementation((() => new Promise((r) => (antwort = r))) as never)
    zeigen('/kpis?person=bodo&zeitraum=kw48')
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Meine Vernetzungen' }))
    fireEvent.change(block.getByLabelText('Vernetzungen versendet'), { target: { value: '48' } })
    fireEvent.click(block.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(gespeichert()).toHaveLength(1))

    klick('Person', 'Team')
    expect(ort()).toBe('/kpis?person=team&zeitraum=kw48')
    antwort({ data: null, error: null })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(ort()).toBe('/kpis?person=team&zeitraum=kw48')
    expect(gedrueckt('Person')).toEqual(['Team'])
  })

  it('Monatszähler einer anderen Person: auch ohne eigenen gibt es für diese Kennzahlen keinen Vergleich', async () => {
    // Bodo hat keinen Monatszähler; seine Tageswerte beginnen im Oktober genauso spät (14 am 26.10.)
    zeigen('/kpis?person=bodo&zeitraum=30t')
    await geladen()
    // die Monatszähler aller Personen über beide Spannen, ab dem Monatsersten
    expect(zaehlerAbfragen).toEqual([{ member: undefined, von: '2026-09-01', bis: '2026-11-26' }])
    // statt „+26 vs. davor 14“
    expect(kachel('vernetzungen_versendet')).toMatchObject({ wert: '40', delta: '–' })
    expect(document.querySelector('[data-zeile="vernetzungen_versendet"] [data-delta]')?.textContent).toBe('–')
    expect(kachel('angeschrieben').delta).toBe('+1 vs. davor 2')

    // Monatsansicht: der Oktober ist für Bodo ebenso unvollständig – statt „+26 vs. Okt. 14“
    klick('Zeitraum', 'Monat')
    await waitFor(() => expect(kachel('angeschrieben').delta).toBe('+1 vs. Okt. 2'))
    expect(kachel('vernetzungen_versendet')).toMatchObject({ wert: '40', delta: '–' })

    // Karla hat den Monatszähler selbst, das Team alle Zeilen: dort stimmt der Monatsvergleich und bleibt
    klick('Person', 'Karla')
    await waitFor(() => expect(kachel('vernetzungen_versendet').delta).toBe('−270 vs. Okt. 300'))
    klick('Person', 'Team')
    await waitFor(() => expect(kachel('vernetzungen_versendet').delta).toBe('−244 vs. Okt. 314'))
  })

  it('Blättern und Personenwechsel: die bisherigen Zahlen bleiben stehen, bis die neuen geladen sind – kein Platzhalter', async () => {
    zeigen()
    await geladen()
    kpisWarten = []
    fireEvent.click(zurueck())
    expect(titel()).toBe('Oktober 2026')
    // der Oktober lädt noch: die Zahlen des Novembers stehen weiter da, mit ihren Beschriftungen
    expect(screen.queryByRole('status')).toBeNull()
    expect(kachel('angeschrieben')).toMatchObject({ wert: '10', delta: '+5 vs. Okt. 5' })
    expect(screen.getByRole('list', { name: 'Kennzahlen' }).parentElement?.parentElement).toHaveAttribute(
      'aria-busy',
      'true',
    )
    antworte()
    await waitFor(() => expect(kachel('angeschrieben')).toMatchObject({ wert: '5', delta: '+5 vs. Sept. 0' }))
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()

    kpisWarten = []
    klick('Person', 'Bodo')
    expect(screen.queryByRole('status')).toBeNull()
    expect(kachel('angeschrieben').wert).toBe('5')
    antworte()
    await waitFor(() => expect(kachel('angeschrieben').wert).toBe('2'))
  })

  it('scheitert ein Neuladen im Hintergrund, bleiben die geladenen Zahlen stehen – der nächste Anlass lädt wieder', async () => {
    zeigen()
    await geladen()
    expect(kachel('angeschrieben').wert).toBe('10')
    const vorher = abfragen.length

    // so wie nach jedem Board-Zug, Realtime-Ereignis oder Fensterfokus; TanStack meldet das Ergebnis im nächsten Takt
    const neuLaden = () =>
      act(async () => {
        await qc.invalidateQueries({ queryKey: qk.kpis.all })
        await new Promise((weiter) => setTimeout(weiter, 0))
      })
    // diesmal ohne Netz
    kpisKaputt = true
    await neuLaden()
    expect(abfragen.length).toBe(vorher + 2)
    expect(
      qc.getQueryCache().findAll({ queryKey: qk.kpis.all, predicate: (q) => q.state.status === 'error' }),
    ).toHaveLength(3)
    expect(kachel('angeschrieben').wert).toBe('10')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    kpisKaputt = false
    ZEILEN.push(zeile(MEMBER_V, '2026-11-26', { angeschrieben: 1 }))
    try {
      await neuLaden()
      await waitFor(() => expect(kachel('angeschrieben').wert).toBe('11'))
    } finally {
      ZEILEN.pop()
    }
  })

  it('Fehler: ein Satz und „Erneut versuchen“ – „Meine Vernetzungen“ bleibt; der zweite Versuch lädt', async () => {
    kpisKaputt = true
    const { container } = zeigen()
    expect(await screen.findByRole('alert')).toHaveTextContent(SATZ)
    expect(screen.queryByRole('list', { name: 'Kennzahlen' })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('region', { name: 'Meine Vernetzungen' })).toBeInTheDocument()
    expect(container.querySelector('kbd')).toBeNull()

    kpisKaputt = false
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await geladen()
    expect(kachel('angeschrieben').wert).toBe('10')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(abfragen).toHaveLength(4)
  })

  it('Fehler beim Laden der Personen: derselbe Satz; „Erneut versuchen“ lädt sie nach', async () => {
    mitgliederAntwort = KAPUTT
    zeigen()
    expect(await screen.findByRole('alert')).toHaveTextContent(SATZ)
    expect(screen.queryByRole('group', { name: 'Person' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Zeitraum' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Meine Vernetzungen' })).toBeInTheDocument()

    mitgliederAntwort = { data: MITGLIEDER, error: null }
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await geladen()
    expect(gedrueckt('Person')).toEqual(['Karla'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keine Tastenmarken, kein Export, kein Kanal, keine Ziele', async () => {
    const { container } = zeigen()
    await geladen()
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Kanal' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
    expect(container.textContent).not.toMatch(/Ziel|CSV/)
    expect(container.querySelector('[data-ziel]')).toBeNull()
    // Tasten tun nichts: weder Zeitraum noch Person wechseln
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    fireEvent.keyDown(document.body, { key: '2' })
    fireEvent.keyDown(document.body, { key: '3' })
    expect(titel()).toBe('November 2026')
    expect(ort()).toBe('/kpis')
  })
})
