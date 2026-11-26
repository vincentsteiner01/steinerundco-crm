// Hilfe-Seite nach dem Neustart (25.11.2026): Übersicht mit höchstens drei Fragen, acht kurze Themen aus themen.ts (seit
// 26.11.2026 mit KPIs), Suche (Enter öffnet den ersten Treffer), unbekanntes oder entferntes Thema → /hilfe. Keine Touren, kein
// Feedback, keine Tastenhinweise.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { TooltipProvider } from '@/components/ui/Tooltip'
import { useAuth } from '@/features/auth/authStore'
import { Component as HilfeSeite } from './HilfeSeite'
import { HAEUFIGE_FRAGEN, THEMEN } from './themen'

function rendern(start: string) {
  const router = createMemoryRouter(
    [
      { path: '/hilfe', element: <HilfeSeite /> },
      { path: '/hilfe/:thema', element: <HilfeSeite /> },
      { path: '*', element: <p>andere Seite</p> },
    ],
    { initialEntries: [start] },
  )
  const { unmount } = render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
  return { router, unmount }
}

/** Der Lesetext rechts – die Themenliste links trägt seit dem Wegfall der Nummern dieselben Link-Namen. */
const text = () => within(screen.getByRole('article'))

const themenLinks = () =>
  within(screen.getByRole('navigation', { name: 'Hilfe-Themen' }))
    .getAllByRole('link')
    .map((a) => a.textContent)

beforeEach(() => {
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: 'u1', email: 'vincent@steinerundco.de', display_name: 'Vincent' },
  } as never)
})

describe('Hilfe', () => {
  it('Übersicht: Titel, drei häufige Fragen mit Link zum Thema, Themenliste mit den acht Themen', () => {
    rendern('/hilfe')
    expect(screen.getByRole('heading', { level: 1, name: 'Hilfe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'So funktioniert das CRM.' })).toBeInTheDocument()
    expect(HAEUFIGE_FRAGEN).toHaveLength(3)
    for (const f of HAEUFIGE_FRAGEN) expect(screen.getByText(f.frage, { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Weiterlesen' }).map((a) => a.getAttribute('href'))).toEqual([
      '/hilfe/archiv',
      '/hilfe/leads',
      '/hilfe/email',
    ])
    // am Telefon steht das Themenverzeichnis unter Einleitung und Fragen
    expect(screen.getByRole('complementary', { name: 'Themen' })).toHaveClass('max-md:order-last')
    // ohne Nummern davor
    expect(themenLinks()).toEqual([
      'Erste Schritte',
      'Leads',
      'Leitfäden',
      'E-Mail',
      'E-Mail-Kampagnen',
      'KPIs',
      'Team & Einstellungen',
      'Wo ist das alte CRM?',
    ])
    expect(THEMEN).toHaveLength(8)
    const liste = screen.getByRole('navigation', { name: 'Hilfe-Themen' })
    expect(within(liste).getByRole('link', { name: /Wo ist das alte CRM/ })).toHaveAttribute('href', '/hilfe/archiv')
  })

  it('Kopf wie auf den anderen Seiten: nur der Titel – keine Datumszeile, keine Themen-Nummern, kein „02 / 07“', () => {
    const { unmount } = rendern('/hilfe')
    expect(screen.getByRole('heading', { level: 1, name: 'Hilfe' })).toHaveClass('headline', 'min-h-11')
    expect(document.body).not.toHaveTextContent(/KW \d|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag/)
    unmount()
    rendern('/hilfe/leads')
    expect(screen.getByRole('heading', { level: 1, name: 'Hilfe' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/\d\d \/ \d\d/)
    expect(themenLinks()).toContain('Leads')
  })

  it('keine Touren, kein Feedback, keine Tastenhinweise – auf der Übersicht und in jedem Thema', () => {
    for (const start of ['/hilfe', ...THEMEN.map((t) => `/hilfe/${t.key}`)]) {
      const { unmount } = rendern(start)
      expect(screen.queryByRole('button', { name: /Tour erneut starten|Zeig’s mir/ }), start).toBeNull()
      expect(document.querySelector('a[href="/feedback"]'), start).toBeNull()
      expect(document.querySelector('kbd'), start).toBeNull()
      expect(document.body.textContent, start).not.toMatch(/[⌘⌥⇧↵]|Tastenk|Feedback geben/)
      unmount()
    }
  })

  it('jedes Thema zeigt Titel, Kurztext und nur interne Links', () => {
    for (const t of THEMEN) {
      const { unmount } = rendern(`/hilfe/${t.key}`)
      expect(screen.getByRole('heading', { level: 2, name: t.titel })).toBeInTheDocument()
      const text = screen.getByRole('article')
      for (const a of within(text).getAllByRole('link')) expect(a.getAttribute('href'), t.key).toMatch(/^\/[a-z]/)
      // Auszeichnung ist aufgelöst: keine Sternchen, keine Link-Klammern im Lesetext
      expect(text.textContent, t.key).not.toMatch(/\*\*|\]\(/)
      unmount()
    }
  })

  it('Thema Leads: Listen fett, Schritte zum Hinzufügen, Link aufs Board, Weiter zu den Leitfäden', () => {
    rendern('/hilfe/leads')
    expect(screen.getByRole('heading', { level: 2, name: 'Leads' })).toBeInTheDocument()
    for (const liste of ['Angeschrieben', 'Gespräch vereinbart', 'Im Geschäft', 'Verloren'])
      expect(screen.getByText(liste, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Karte hinzufügen',
      'Karte verschieben',
      'Karte finden und öffnen',
    ])
    expect(screen.getByText(/oben rechts auf den blauen Knopf „Lead hinzufügen“/)).toBeInTheDocument()
    expect(text().getByRole('link', { name: 'Leads' })).toHaveAttribute('href', '/leads')
    const weiter = screen.getByRole('navigation', { name: 'Weitere Themen' })
    expect(weiter).toHaveTextContent('Erste Schritte')
    expect(weiter).toHaveTextContent('Leitfäden')
  })

  it('Thema Leitfäden: der Platzhalter [Vorname] bleibt als Text stehen', () => {
    rendern('/hilfe/leitfaeden')
    expect(screen.getByText(/Ein Klick setzt einen Platzhalter wie \[Vorname\] an die Stelle/)).toBeInTheDocument()
    expect(text().getByRole('link', { name: 'Leitfäden' })).toHaveAttribute('href', '/leitfaeden')
  })

  it('Thema KPIs: Link auf den Reiter, zwei Abschnitte, zwischen Kampagnen und Team & Einstellungen', () => {
    rendern('/hilfe/kpis')
    expect(screen.getByRole('heading', { level: 2, name: 'KPIs' })).toBeInTheDocument()
    expect(text().getByRole('link', { name: 'KPIs' })).toHaveAttribute('href', '/kpis')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Vernetzungen eintragen',
      'Alles andere zählt von selbst',
    ])
    expect(screen.getByText(/Oben steht „Meine Vernetzungen“/)).toBeInTheDocument()
    expect(screen.getByText(/Die kleine Prozentzahl daneben ist der Anteil an der Stufe davor/)).toBeInTheDocument()
    expect(screen.getByText('Zahlen bis 24.11.2026 stammen aus dem alten CRM.')).toBeInTheDocument()
    const weiter = screen.getByRole('navigation', { name: 'Weitere Themen' })
    expect(weiter).toHaveTextContent('E-Mail-Kampagnen')
    expect(weiter).toHaveTextContent('Team & Einstellungen')
  })

  it('Thema Team & Einstellungen verlinkt die fünf Bereiche', () => {
    rendern('/hilfe/team-einstellungen')
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/team')
    for (const [name, bereich] of [
      ['Profil', 'profil'],
      ['Passcode', 'passcode'],
      ['Sperrliste', 'sperrliste'],
      ['Feiertage', 'feiertage'],
      ['Export & Backup', 'export'],
    ] as const)
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/einstellungen/${bereich}`)
  })

  it('Thema „Wo ist das alte CRM?“: nichts gelöscht, Stand vom 25.11.2026', () => {
    rendern('/hilfe/archiv')
    expect(screen.getByRole('heading', { level: 2, name: 'Wo ist das alte CRM?' })).toBeInTheDocument()
    expect(screen.getByText('nichts gelöscht', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/Am 25\.11\.2026 wurde das CRM neu und einfach aufgebaut/)).toBeInTheDocument()
    // 26.11.2026: die KPIs sind zurück – der Absatz „Die alten Seiten“ verweist darauf
    expect(text().getByRole('link', { name: 'KPIs' })).toHaveAttribute('href', '/kpis')
    // letztes Thema: nur „Zurück“
    const weiter = screen.getByRole('navigation', { name: 'Weitere Themen' })
    expect(weiter).toHaveTextContent('Team & Einstellungen')
    expect(weiter).not.toHaveTextContent('Weiter')
  })

  it('Thema E-Mail: Erlaubnis und Widerspruch stehen in der Lead-Karte, Verweis auf die Kampagnen', () => {
    rendern('/hilfe/email')
    expect(
      screen.getByText(/„Erlaubnis erfassen“ und „Widerspruch erfassen“ stehen in der Lead-Karte/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Einzelmails' })).toHaveAttribute('href', '/email')
    expect(text().getByRole('link', { name: 'E-Mail-Kampagnen' })).toHaveAttribute('href', '/hilfe/kampagnen')
  })

  it('Suche filtert über den ganzen Text, Enter öffnet den ersten Treffer, nichts gefunden → Hinweis', () => {
    const { router } = rendern('/hilfe')
    const feld = screen.getByRole('searchbox', { name: 'Hilfe durchsuchen' })
    fireEvent.change(feld, { target: { value: 'postfach verbinden' } })
    expect(themenLinks()).toEqual(['E-Mail', 'E-Mail-Kampagnen'])
    // Zähler ohne Tastenhinweis
    expect(screen.getByText('2 Themen')).toBeInTheDocument()
    fireEvent.change(feld, { target: { value: 'passcode' } })
    expect(themenLinks()).toEqual(['Team & Einstellungen'])
    expect(screen.getByText('1 Thema')).toBeInTheDocument()
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(router.state.location.pathname).toBe('/hilfe/team-einstellungen')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hilfe durchsuchen' }), { target: { value: 'xyzzy' } })
    expect(screen.getByText(/Nichts gefunden/)).toBeInTheDocument()
  })

  it('unbekanntes oder entferntes Thema → Übersicht', () => {
    for (const alt of ['gibt-es-nicht', 'dein-tag', 'feedback', 'noch-nicht', 'verbindungen', 'kpis-team']) {
      const { router, unmount } = rendern(`/hilfe/${alt}`)
      expect(router.state.location.pathname, alt).toBe('/hilfe')
      unmount()
    }
  })
})
