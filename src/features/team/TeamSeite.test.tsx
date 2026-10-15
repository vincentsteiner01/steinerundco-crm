// TeamSeite: Kopf (Dateline, Zeitraum-Segment, Tasten 1 2 3), Vergleich Vincent | Mike (Fotos-Avatare, zuletzt aktiv, Heute-Status,
// Kennzahlen wie die KPI-Seite inkl. Sheet-Regel), Team-Protokoll (Tagesgruppen, Timeline-Wortlaut, Filter, Peek, leer, Fehler).
import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let TABELLEN: () => ReturnType<typeof import('./_testHilfe').tabellen>
vi.mock('@/data/supabase', async () =>
  (await import('@/features/kpis/_testHilfe')).supabaseMitTabellen(() => TABELLEN()),
)

import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { FEHLER } from '@/features/kpis/_testHilfe'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { AKTIVITAETEN, JETZT, LEAD_1, MEMBER_V, rendern, tabellen, taste } from './_testHilfe'

configure({ asyncUtilTimeout: 8000 })

const metrik = (key: string) => document.querySelector(`[data-metrik="${key}"]`) as HTMLElement
const werte = (key: string) =>
  [...metrik(key).querySelectorAll('[data-wert]')].map((e) => e.textContent?.replace(/\s/g, ''))
const protokoll = () => screen.getByRole('region', { name: 'Team-Protokoll' })

describe('TeamSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: JETZT })
    TABELLEN = () => tabellen()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null, peekListe: [], paletteOffen: false })
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

  it('Woche (Standard): Kopf, beide Personen mit Status, Kennzahlen nach KPI-Regel, Sheet-Hinweis', async () => {
    rendern()
    await screen.findByRole('list', { name: /Kennzahlen KW 42: Vincent und Mike/ })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team')
    expect(screen.getByText('Vincent · Mike · 12.–15.10.2026 · Stand 11:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Woche · KW 42/ })).toHaveAttribute('aria-pressed', 'true')

    // Personenköpfe: Avatare (Fotos über Avatar), zuletzt aktiv, Heute-Status aus v_today_queue + Aktivitäten
    const vincent = document.querySelector('[data-person="vincent"]') as HTMLElement
    const mike = document.querySelector('[data-person="mike"]') as HTMLElement
    expect(within(vincent).getByRole('heading', { name: 'Vincent' })).toBeInTheDocument()
    await waitFor(() => expect(within(mike).getByText(/zuletzt aktiv vor 1\sStd\./)).toBeInTheDocument())
    expect(within(vincent).getByText(/zuletzt aktiv vor 2\sStd\./)).toBeInTheDocument()
    await waitFor(() =>
      expect(within(vincent).getByLabelText('Heute: 5 fällig, 3 überfällig, 1 erledigt')).toBeInTheDocument(),
    )
    expect(within(mike).getByLabelText('Heute: 5 fällig, 4 überfällig, 1 erledigt')).toBeInTheDocument()
    expect(within(mike).getByRole('link', { name: 'Mikes Heute-Liste →' })).toHaveAttribute(
      'href',
      '/heute?person=mike',
    )
    expect(within(vincent).getByRole('link', { name: 'Deine Heute-Liste →' })).toHaveAttribute('href', '/heute')
    expect(vincent.querySelector('img')).toHaveAttribute('src', '/avatars/vincent.webp')

    // Kennzahlen: Vincents Sheet-Monatswerte zählen in der Woche nicht, Tageszähler schon; Mike aus Ereignissen
    expect(werte('anfragen')).toEqual(['0', '0'])
    expect(werte('annahmen')).toEqual(['0', '2'])
    expect(werte('eroeffnet')).toEqual(['17', '3'])
    expect(werte('followups')).toEqual(['0', '1'])
    expect(werte('anrufe')).toEqual(['0', '5'])
    expect(metrik('anrufe')).toHaveTextContent('davon 2 erreicht')
    expect(metrik('eroeffnet')).toHaveAttribute('aria-label', 'Gespräche eröffnet: Vincent 17, Mike 3')
    const balken = [...metrik('eroeffnet').querySelectorAll('[data-anteil]')].map((e) => e.getAttribute('data-anteil'))
    expect(balken).toEqual(['100', '18'])
    expect(document.querySelector('[data-hinweis="sheet"]')).toHaveTextContent(
      'Für Vincent gelten in diesem Monat die Werte aus dem KPI-Sheet',
    )
    expect(screen.getByRole('link', { name: 'In den KPIs ansehen →' })).toHaveAttribute(
      'href',
      '/kpis?zeitraum=kw42&person=team',
    )
  })

  it('Tasten 3 · 1 wechseln Monat und Heute (URL), Monat zeigt Sheet-Werte mit Badge', async () => {
    const { router } = rendern()
    await screen.findByRole('list', { name: /Kennzahlen KW 42/ })
    act(() => {
      taste('3')
    })
    await screen.findByRole('list', { name: /Kennzahlen Oktober 2026/ })
    expect(router.state.location.search).toBe('?zeitraum=monat')
    expect(werte('anfragen')).toEqual(['305', '0'])
    expect(within(metrik('anfragen')).getByText('aus Sheet')).toBeInTheDocument()
    expect(werte('antworten')).toEqual(['19', '1'])
    expect(werte('followups')).toEqual(['0', '2'])
    expect(document.querySelector('[data-hinweis="sheet"]')).toBeNull()

    act(() => {
      taste('1')
    })
    await screen.findByRole('list', { name: /Kennzahlen Heute/ })
    expect(router.state.location.search).toBe('?zeitraum=heute')
  })

  it('Heute ohne jede Zahl: ein Satz statt acht Nullzeilen, Weg zur Woche', async () => {
    TABELLEN = () =>
      tabellen({ activities: AKTIVITAETEN.filter((a) => !String(a.occurred_at).startsWith('2026-10-15')) })
    const { router } = rendern('/team?zeitraum=heute')
    const leer = await waitFor(() => {
      const el = document.querySelector('[data-leer="kennzahlen"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(leer).toHaveTextContent('Heute ist für Vincent und Mike noch nichts gezählt.')
    expect(screen.queryByRole('list', { name: /Kennzahlen Heute/ })).toBeNull()
    fireEvent.click(within(leer).getByRole('button', { name: /Woche ansehen/ }))
    await screen.findByRole('list', { name: /Kennzahlen KW 42/ })
    expect(router.state.location.search).toBe('?zeitraum=woche')
  })

  it('Ziffern-Tasten schweigen bei offenem Peek', async () => {
    const { router } = rendern()
    await screen.findByRole('list', { name: /Kennzahlen KW 42/ })
    useUiStore.setState({ peekLeadId: LEAD_1 })
    act(() => {
      taste('3')
    })
    expect(router.state.location.search).toBe('')
  })

  it('Team-Protokoll: Tagesgruppen, Timeline-Wortlaut, nur Mitglieder, Lead-Name öffnet den Peek', async () => {
    const { router } = rendern()
    const p = await waitFor(() => protokoll())
    const gruppen = await within(p).findAllByRole('group', { name: /Eintr/ })
    expect(gruppen.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Heute, 2 Einträge',
      'Gestern, 1 Eintrag',
      'Mo 12.10., 1 Eintrag',
    ])
    expect(within(p).getByText('Gesprächseröffnung gesendet · Vorlage Eröffnung V1')).toBeInTheDocument()
    expect(within(p).getByText(/^Phase geändert: /)).toBeInTheDocument()
    expect(within(p).getByText(/^Antwort erhalten/)).toBeInTheDocument()
    expect(p.querySelector('[data-eintrag="5"]')).toBeNull() // Import ohne Person
    expect(p.querySelector('[data-eintrag="6"]')).toBeNull() // außerhalb der Woche
    expect(p.querySelector('[data-protokoll-hinweis]')).toHaveTextContent(
      'KW 42 · neueste oben · aktualisiert sich live · 4 Einträge',
    )

    const eintrag = p.querySelector('[data-eintrag="9"]') as HTMLElement
    expect(within(eintrag).getByText('09:05')).toBeInTheDocument()
    expect(within(eintrag).getByText(/Windparkentwicklung Norddeutschland/)).toBeInTheDocument()
    fireEvent.click(within(eintrag).getByRole('button', { name: 'Test Person 91' }))
    expect(new URLSearchParams(router.state.location.search).get('lead')).toBe(LEAD_1)
    expect(useUiStore.getState().peekListe[0]).toBe('10000000-0000-4000-8000-000000000092')
  })

  it('Filter Person und Kanal in der URL; leerer Filter mit „Filter zurücksetzen“', async () => {
    const { router } = rendern()
    const p = await waitFor(() => protokoll())
    await within(p).findAllByRole('group', { name: /Eintr/ })
    fireEvent.click(within(within(p).getByRole('group', { name: 'Person' })).getByRole('button', { name: 'Mike' }))
    await waitFor(() => {
      expect(p.querySelector('[data-eintrag="9"]')).toBeNull()
      expect(p.querySelector('[data-eintrag="10"]')).not.toBeNull()
    })
    expect(p.querySelector('[data-eintrag="7"]')).not.toBeNull()
    expect(new URLSearchParams(router.state.location.search).get('person')).toBe('mike')

    fireEvent.click(within(within(p).getByRole('group', { name: 'Kanal' })).getByRole('button', { name: 'Telefon' }))
    await within(p).findByText('Mit diesem Filter ist in KW 42 noch nichts erfasst.')
    fireEvent.click(within(p).getByRole('button', { name: 'Filter zurücksetzen' }))
    await waitFor(() => expect(p.querySelector('[data-eintrag="9"]')).not.toBeNull())
    expect(router.state.location.search).toBe('')
  })

  it('Fehler beim Laden: Fehlerzeilen statt falscher Nullen', async () => {
    FEHLER.add('activities')
    FEHLER.add('v_metric_events')
    rendern()
    expect(await screen.findByText(/Kennzahlen konnten nicht geladen werden/)).toBeInTheDocument()
    expect(await screen.findByText(/Das Team-Protokoll konnte nicht geladen werden/)).toBeInTheDocument()
  })
})
