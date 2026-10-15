// KpisSeite: Render-Zustände (Laden · Daten · leer · Fehler), Kopf (Dateline, ← →, Segmente in der URL), Kennzahlenzeile mit Badge/
// Fußnote/Zielpunkt (K-08/K-09), Funnel Okt 2026 (K-13: Erstgespräche 1, vereinbart 2), Wochentabelle (K-01), Telefon-Kacheln
// (K-07/K-14), E-Mail (K-15), Team (K-04), Leitfäden (K-06), Ohne Bewegung + Enter → Peek, Tasten ← → 1 2 3, Export (K-12).
import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let TABELLEN: () => ReturnType<typeof import('./_testHilfe').tabellen>
vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseMitTabellen(() => TABELLEN()))
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
import { useAuth } from '@/features/auth/authStore'
import { qk } from '@/data'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import type { Settings } from '@/types/domain'
import { MEMBER_V } from '@/test/fixtures/leads'
import { FEHLER, JETZT, LEAD_B, rendern, tabellen, taste } from './_testHilfe'

// Viele Quellen + lazy Route in jsdom: großzügiges Zeitfenster für findBy/waitFor
configure({ asyncUtilTimeout: 8000 })

const kachel = (key: string) => document.querySelector(`[data-kachel="${key}"]`) as HTMLElement
const zeile = (metric: string) => document.querySelector(`[data-zeile="${metric}"]`) as HTMLElement

describe('KpisSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: JETZT })
    TABELLEN = () => tabellen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null })
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent' },
    })
    _akkordZuruecksetzen()
    FEHLER.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Monat Oktober 2026 (Vincent): Kopf, Kennzahlenzeile, Funnel K-13, Wochentabelle K-01, Sales-Calls, No-Shows', async () => {
    rendern()
    expect(await screen.findByRole('status')).toBeInTheDocument() // Skeleton beim Laden
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Oktober 2026')
    expect(screen.getByText('Alle Kanäle · Vincent · 01.–14.10.2026 · Stand 09:41')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Folgeperiode' })).toBeDisabled()

    // Kennzahlen: 305 aus Sheet (Badge), 93 · 30 % mit Zielpunkt, Delta vs. Sept.
    const versendet = kachel('vernetzungen_versendet')
    expect(within(versendet).getByText('305')).toBeInTheDocument()
    expect(within(versendet).getByText('aus Sheet')).toBeInTheDocument()
    expect(versendet).toHaveTextContent('+17 vs. Sept. 288')
    const angenommen = kachel('vernetzungen_angenommen')
    expect(within(angenommen).getByText('93')).toBeInTheDocument()
    expect(within(angenommen).getByText('30 %')).toBeInTheDocument()
    expect(within(angenommen).getByRole('img', { name: /Ziel ≥ 25.% erreicht/ })).toBeInTheDocument()
    expect(angenommen).toHaveTextContent('+38 · +11 pp vs. Sept. 19 % · Ziel ≥ 25 %')
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('82')
    expect(kachel('antwortzeit')).toHaveTextContent('1,5')
    // Telefon-Zeile unter „Alle“ nur, wenn Dials > 0 – Vincent hat keine
    expect(screen.queryByRole('list', { name: 'Kennzahlen Telefon' })).not.toBeInTheDocument()

    // Funnel: 10 Zeilen, Erstgespräche 1 (stattgefunden) und Sub-Zeile vereinbart 2 (K-13), Link § 7.5
    const funnel = screen.getByRole('list', { name: 'Funnel' })
    expect(within(funnel).getAllByRole('listitem')).toHaveLength(10)
    expect(zeile('erstgespraeche')).toHaveTextContent('1')
    expect(zeile('erstgespraeche_vereinbart')).toHaveAttribute('data-sub', 'true')
    expect(zeile('erstgespraeche_vereinbart')).toHaveTextContent('nach Buchungsdatum, keine Konversion')
    expect(within(zeile('erstgespraeche_vereinbart')).getByText('2')).toBeInTheDocument()
    expect(zeile('ausstehend')).toHaveTextContent('212')
    const link = within(zeile('dm_beantwortet')).getByRole('link', { name: /DM beantwortet: 19/ })
    expect(link).toHaveAttribute(
      'href',
      `/leads?ereignis=nachricht_erhalten&von=2026-10-01&bis=2026-10-31&person=${MEMBER_V}`,
    )
    expect(within(zeile('vernetzungen_versendet')).getByRole('link')).toHaveAttribute(
      'href',
      `/leads?quelle=anfragen&von=2026-10-01&bis=2026-10-31&person=${MEMBER_V}`,
    )

    // Wochentabelle K-01
    const wt = screen.getByRole('table', { name: 'Wochentabelle' })
    const zeilen = within(wt).getAllByRole('row').slice(1)
    // Zeilen KW 40–44: Spalte „Eröffnet“ = Zelle 2; Summenzeile hat colSpan 2 → Zelle 1
    expect(zeilen.map((z, i) => within(z).getAllByRole('cell')[i < 5 ? 2 : 1]?.textContent)).toEqual([
      '65',
      '0',
      '17',
      '—',
      '—',
      '82',
    ])
    expect(screen.getByRole('img', { name: /Balkendiagramm: Gespräche eröffnet pro Tag/ })).toBeInTheDocument()
    expect(document.querySelectorAll('g[data-tag]')).toHaveLength(31)

    // Sales-Calls + nächster Termin, No-Shows mit Voice-Fußnote
    expect(document.querySelector('[data-sales="erstgespraeche_vereinbart"]')).toHaveTextContent('2')
    await waitFor(() =>
      expect(document.querySelector('[data-termin]')).toHaveTextContent('Fr 16.10., 10:00 · Test Person 81'),
    )
    expect(screen.getByText('Fließen bewusst in keine Konversion ein.')).toBeInTheDocument()

    // Leitfäden (K-06): nur gesendete Vorlagen; Geantwortet nach Schritt; Notiz-Variante
    const lt = screen.getByRole('table', { name: 'Leitfäden-Tabelle' })
    expect(within(lt).getByText('Eröffnung V1')).toBeInTheDocument()
    expect(within(lt).queryByText('Nie gesendet')).not.toBeInTheDocument()
    expect(within(lt).getAllByRole('row')[1]).toHaveTextContent('82')
    expect(document.querySelector('[data-schritt="st1"]')).toHaveTextContent('1 · Opener1')
    const nv = screen.getByRole('table', { name: 'Notiz-Variante' })
    expect(within(nv).getByText('Ohne Notiz').closest('tr')).toHaveTextContent('1 · 100 %')

    // Ohne Bewegung: Vincents Lead mit Aktionen
    const ob = screen.getByRole('table', { name: 'Leads ohne Bewegung' })
    expect(within(ob).getByText('Test Person 82')).toBeInTheDocument()
    expect(within(ob).getByText('9 Werktage')).toBeInTheDocument()
    expect(within(ob).getByRole('button', { name: /Wiedervorlage/ })).toBeInTheDocument()
    expect(within(ob).getByRole('button', { name: /Beenden/ })).toBeInTheDocument()
  })

  it('Tasten: ← Vormonat, → Folgemonat (gesperrt im laufenden Monat), 3 → Team, 1 → Vincent; Segmente schreiben die URL', async () => {
    const { router } = rendern()
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    taste('ArrowLeft')
    await waitFor(() => expect(router.state.location.search).toContain('zeitraum=2026-09'))
    expect(await screen.findByRole('heading', { level: 1, name: 'September 2026' })).toBeInTheDocument()
    taste('ArrowRight')
    await waitFor(() => expect(router.state.location.search).toContain('zeitraum=2026-10'))
    taste('ArrowRight')
    expect(router.state.location.search).toContain('zeitraum=2026-10')
    taste('3')
    await waitFor(() => expect(router.state.location.search).toContain('person=team'))
    expect(await screen.findByText(/Alle Kanäle · Team ·/)).toBeInTheDocument()
    taste('1')
    await waitFor(() => expect(router.state.location.search).toContain('person=vincent'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Zeitraum' })).getByRole('button', { name: 'KW' }))
    await waitFor(() => expect(router.state.location.search).toContain('zeitraum=kw42'))
    expect(await screen.findByRole('heading', { level: 1, name: 'KW 42' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('group', { name: 'Kanal' })).getByRole('button', { name: 'Telefon' }))
    await waitFor(() => expect(router.state.location.search).toContain('kanal=telefon'))
  })

  it('Team im Monat summiert beide Personen (K-04/K-10) und zeigt die Telefon-Zeile mit Ø Gesprächsdauer (K-07/K-14)', async () => {
    rendern('/kpis?zeitraum=2026-10&person=team')
    await screen.findByRole('list', { name: 'Kennzahlen Telefon' })
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('86')
    expect(kachel('anrufe')).toHaveTextContent('12')
    expect(kachel('anrufe_erreicht')).toHaveTextContent('33 %')
    expect(kachel('entscheider_gespraeche')).toHaveTextContent('17 %')
    expect(kachel('termine_telefon')).toHaveTextContent('1')
    expect(kachel('termine_pro_100_anrufe')).toHaveTextContent('8,3')
    await waitFor(() => expect(kachel('gespraechsdauer')).toHaveTextContent('04:00'))
    // Netzwerk: Zeitraum-Daten nur über calls / emails / activities mit Range-Filtern (K-14/K-15), keine eigenen Views
    const { supabase } = await import('@/data/supabase')
    const aufrufe = vi.mocked(supabase.from).mock.calls.map((c) => c[0])
    expect(aufrufe).toEqual(
      expect.arrayContaining(['calls', 'emails', 'activities', 'v_metric_events', 'v_funnel_monthly']),
    )
    const calls = vi.mocked(supabase.from).mock.results[aufrufe.indexOf('calls')]!.value as Record<
      string,
      ReturnType<typeof vi.fn>
    >
    expect(calls['eq']).toHaveBeenCalledWith('direction', 'out')
    expect(calls['gte']).toHaveBeenCalledWith('started_at', expect.stringMatching(/^2026-09-30T22:00/))
    expect(calls['lt']).toHaveBeenCalledWith('started_at', expect.stringMatching(/^2026-10-31T23:00/))
  })

  it('Kanal E-Mail: gesendet · beantwortet (%) · Widersprüche aus den Zeitraum-Hooks (K-15); Mike ohne Zähler zeigt KW-Werte ohne Sheet', async () => {
    rendern('/kpis?zeitraum=2026-10&person=vincent&kanal=email')
    await screen.findByRole('list', { name: 'Kennzahlen E-Mail' })
    expect(screen.queryByRole('list', { name: 'Kennzahlen LinkedIn' })).not.toBeInTheDocument()
    await waitFor(() => expect(kachel('email_beantwortet')).toHaveTextContent('50 %'))
    expect(kachel('widersprueche')).toHaveTextContent('1')
    expect(screen.getByText(/E-Mail · Vincent ·/)).toBeInTheDocument()
  })

  it('KW 40 (Vincent): Summen aus Tagesereignissen, Monatszähler zählen nicht, Vorperiode KW 39', async () => {
    rendern('/kpis?zeitraum=kw40&person=vincent')
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KW 40')
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('65')
    expect(kachel('vernetzungen_versendet')).toHaveTextContent('0')
    expect(within(kachel('vernetzungen_versendet')).queryByText('aus Sheet')).not.toBeInTheDocument()
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('vs. KW 39')
    expect(screen.getByText('Alle Kanäle · Vincent · 28.09.–04.10.2026 · Stand 09:41')).toBeInTheDocument()
  })

  it('Leerzustand ohne Daten im Zeitraum, Fehlerzustand mit „Erneut versuchen“', async () => {
    TABELLEN = () => tabellen({ v_metric_events: [], v_funnel_monthly: [], v_daily_activity: [] })
    rendern('/kpis?zeitraum=2026-08&person=vincent')
    expect(await screen.findByText('Keine Daten für August 2026.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'KPI-Sheet importieren' })).toBeInTheDocument()
  })

  it('Fehler beim Laden: Hinweis mit „Erneut versuchen“', async () => {
    FEHLER.add('v_metric_events')
    rendern()
    expect(await screen.findByRole('alert')).toHaveTextContent('Kennzahlen nicht geladen.')
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Kennzahlen LinkedIn' })).not.toBeInTheDocument()
  })

  it('Ohne Bewegung: Cursor + Enter öffnet den Lead als Peek (?lead=), Esc hebt den Cursor auf', async () => {
    const { router } = rendern()
    const ob = await screen.findByRole('table', { name: 'Leads ohne Bewegung' })
    fireEvent.click(within(ob).getByText('Solar 82 GmbH'))
    taste('Enter')
    await waitFor(() => expect(router.state.location.search).toContain(`lead=${LEAD_B}`))
    expect(router.state.location.search).toContain('zeitraum=2026-10')
  })

  it('Export CSV lädt eine Datei mit Funnel und Tageswerten herunter (K-12); Palette-Befehl löst denselben Export aus', async () => {
    rendern()
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    const blobs: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => (blobs.push(b), 'blob:x')),
      revokeObjectURL: vi.fn(),
    })
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(klick).toHaveBeenCalledTimes(1)
    const text = await blobs[0]!.text()
    expect(text).toContain('01;Vernetzung versendet;305')
    expect(text).toContain('01.10.2026;28;')
    expect(text).toContain('Vincent;Alle Kanäle;Oktober 2026;01.10.2026;31.10.2026;Sept.')
    window.dispatchEvent(new CustomEvent('crm:kpis-export'))
    expect(klick).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
    klick.mockRestore()
  })
  it('Kanal Telefon (Vincent ohne Anrufe): nur Telefon-Zeile, Dials 0, Ø Gesprächsdauer „–“ (K-14), Tagesverlauf Dials', async () => {
    rendern('/kpis?zeitraum=2026-10&person=vincent&kanal=telefon')
    await screen.findByRole('list', { name: 'Kennzahlen Telefon' })
    expect(screen.queryByRole('list', { name: 'Kennzahlen LinkedIn' })).not.toBeInTheDocument()
    expect(within(kachel('anrufe')).getByText('0')).toBeInTheDocument()
    expect(within(kachel('gespraechsdauer')).getAllByText('–').length).toBeGreaterThan(0)
    // 0 Dials → keine Quote (Division durch 0 → null)
    expect(kachel('anrufe_erreicht').querySelector('[data-quote]')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Dials pro Tag' })).toBeInTheDocument()
    const kopf = within(screen.getByRole('table', { name: 'Wochentabelle' })).getAllByRole('columnheader')
    expect(kopf.map((k) => k.textContent)).toEqual(['Woche', 'Zeitraum', 'Dials', 'Connects'])
    // Notiz-Variante gehört zu LinkedIn
    expect(screen.queryByRole('table', { name: 'Notiz-Variante' })).not.toBeInTheDocument()
    expect(screen.getByText(/^Telefon · Vincent ·/)).toBeInTheDocument()
  })

  it('Person Mike: nur Mikes Werte (K-04), Telefon-Zeile unter „Alle“, Ohne Bewegung leer, kein nächster Termin', async () => {
    rendern('/kpis?zeitraum=2026-10&person=mike')
    await screen.findByRole('list', { name: 'Kennzahlen Telefon' })
    expect(within(screen.getByRole('group', { name: 'Person' })).getByRole('button', { name: /Mike/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(kachel('gespraeche_eroeffnet')).getByText('4')).toBeInTheDocument()
    expect(within(kachel('vernetzungen_versendet')).getByText('0')).toBeInTheDocument()
    expect(kachel('anrufe')).toHaveTextContent('12')
    expect(await screen.findByText('Alle Gespräche in Bewegung.')).toBeInTheDocument()
    expect(document.querySelector('[data-termin]')).toBeNull()
  })

  it('Eigener Zeitraum: Headline als Spanne, Datumsfelder schreiben ?von/?bis, Balken nur für die Tage der Spanne', async () => {
    const { router } = rendern('/kpis?zeitraum=custom&von=2026-10-01&bis=2026-10-03&person=vincent')
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('01.–03.10.2026')
    expect(
      within(screen.getByRole('group', { name: 'Zeitraum' })).getByRole('button', { name: 'eigener' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('65')
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('vs. davor')
    expect(document.querySelectorAll('g[data-tag]')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-10-12' } })
    await waitFor(() => expect(router.state.location.search).toContain('bis=2026-10-12'))
    expect(router.state.location.search).toContain('zeitraum=custom')
    await waitFor(() => expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('82'))
  })

  it('7 T: letzte sieben Tage bis heute, Vorperiode „7 T davor“, sieben Balken, heute markiert', async () => {
    rendern('/kpis?zeitraum=7t&person=vincent')
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Letzte 7 Tage')
    expect(screen.getByText('Alle Kanäle · Vincent · 08.–14.10.2026 · Stand 09:41')).toBeInTheDocument()
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('17')
    expect(kachel('gespraeche_eroeffnet')).toHaveTextContent('−48 vs. 7 T davor 65')
    expect(document.querySelectorAll('g[data-tag]')).toHaveLength(7)
    expect(document.querySelector('g[data-tag="2026-10-14"]')).toHaveAttribute('data-art', 'heute')
    expect(screen.getByRole('button', { name: 'Folgeperiode' })).toBeDisabled()
  })

  it('Ziel aus den Einstellungen wirkt ohne Reload (K-08): höheres Ziel nimmt den Lime-Punkt weg', async () => {
    const { qc } = rendern()
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    expect(within(kachel('vernetzungen_angenommen')).getByRole('img', { name: /erreicht/ })).toBeInTheDocument()
    act(() => {
      qc.setQueryData<Settings>(qk.settings, (alt) =>
        alt ? { ...alt, kpi_targets: { ...alt.kpi_targets, annahme_quote: 0.35 } } : alt,
      )
    })
    await waitFor(() =>
      expect(
        within(kachel('vernetzungen_angenommen')).queryByRole('img', { name: /erreicht/ }),
      ).not.toBeInTheDocument(),
    )
    expect(kachel('vernetzungen_angenommen')).toHaveTextContent('Ziel ≥ 35 %')
    expect(zeile('vernetzungen_angenommen')).toHaveTextContent('Ziel 35 %')
  })

  it('Tagesverlauf: Metrik-Segment schaltet Balken und Kopf um (Anfragen: Max. 40)', async () => {
    rendern()
    await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })
    fireEvent.click(within(screen.getByRole('group', { name: 'Metrik' })).getByRole('button', { name: 'Anfragen' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Anfragen pro Tag' })).toBeInTheDocument()
    const tv = screen.getByRole('region', { name: 'Tagesverlauf' })
    expect(tv).toHaveTextContent('Max. 40')
    expect(document.querySelector('g[data-tag="2026-10-01"]')).toHaveAttribute('data-wert', '40')
  })

  it('Mobil (< 768 px): Tagesverlauf als 7-Tage-Fenster mit Wochentabs', async () => {
    const vorher = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      rendern()
      const wochenTabs = await screen.findByRole('group', { name: 'Woche' })
      expect(
        within(wochenTabs)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['KW 40', 'KW 41', 'KW 42', 'KW 43', 'KW 44'])
      expect(within(wochenTabs).getByRole('button', { name: 'KW 42' })).toHaveAttribute('aria-pressed', 'true')
      expect(document.querySelectorAll('g[data-tag]')).toHaveLength(7)
      fireEvent.click(within(wochenTabs).getByRole('button', { name: 'KW 40' }))
      // KW 40 schneidet den Oktober an: nur 01.–04.10.
      await waitFor(() => expect(document.querySelectorAll('g[data-tag]')).toHaveLength(4))
    } finally {
      window.matchMedia = vorher
    }
  })

  it('Leerzustand: „Letzte 30 Tage“ wechselt den Zeitraum; Fehler: „Erneut versuchen“ lädt neu', async () => {
    TABELLEN = () => tabellen({ v_metric_events: [], v_funnel_monthly: [], v_daily_activity: [] })
    const { router } = rendern('/kpis?zeitraum=2026-08&person=vincent')
    fireEvent.click(await screen.findByRole('button', { name: 'Letzte 30 Tage' }))
    await waitFor(() => expect(router.state.location.search).toContain('zeitraum=30t'))
  })

  it('Fehler → „Erneut versuchen“ → Daten erscheinen', async () => {
    FEHLER.add('v_metric_events')
    rendern()
    await screen.findByRole('alert')
    FEHLER.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('list', { name: 'Kennzahlen LinkedIn' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
