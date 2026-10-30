// Rechercheseite (29.10.2026): „Vernetzungsanfrage gesendet“ erst nach „Prüfen“ = frei für genau diese URL, Dublette mit dem
// Grund aus der Prüfung, Sperre bei fälligem Kontrollpunkt und nach Laufende. Datenhooks sind gemockt – die Regeln selbst
// prüft supabase/tests/recherche_test.sql gegen die echte Datenbank.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { RechercheLauf } from '@/data/recherche'

const m = vi.hoisted(() => ({
  lauf: null as unknown as Record<string, unknown>,
  pruefen: vi.fn(),
  eintragen: vi.fn(),
  status: vi.fn(),
  kontrolle: vi.fn(),
  agent: vi.fn(),
  antworten: vi.fn(),
  ersatz: vi.fn(),
  einrichten: vi.fn(),
  dienste: [{ zuletzt_gesehen: new Date().toISOString(), rechner: 'MacBook Pro' }] as unknown[],
}))

vi.mock('@/data/members', () => ({
  useMe: () => ({ id: 'me', display_name: 'Vincent' }),
  useMeId: () => 'me',
}))
vi.mock('@/data/recherche', () => ({
  useLauf: () => ({ data: m.lauf, isLoading: false, isError: false, refetch: vi.fn() }),
  useLaufProfile: () => ({ data: [] }),
  useAnfragenWoche: () => ({ data: 12 }),
  useAusgangspunkte: () => ({ data: [] }),
  useRechercheStatus: () => ({ mutate: m.status, isPending: false }),
  useRechercheStarten: () => ({ mutate: vi.fn(), isPending: false }),
  useRechercheKontrolle: () => ({ mutate: m.kontrolle, isPending: false }),
  useRechercheAgentStarten: () => ({ mutate: m.agent, isPending: false }),
  useRechercheAgentAntworten: () => ({ mutate: m.antworten, isPending: false }),
  useRechercheDienste: () => ({ data: m.dienste }),
  useRechercheDienstEinrichten: () => ({ mutate: m.einrichten, isPending: false }),
  useRechercheClaudeErsatz: () => ({ mutate: m.ersatz, isPending: false }),
  useRechercheEintragen: () => ({ mutate: m.eintragen, isPending: false }),
  recherchePruefen: m.pruefen,
}))

import { Component as RechercheSeite } from './RechercheSeite'

const LAUF: RechercheLauf = {
  id: 'lauf-1',
  member_id: 'me',
  status: 'laeuft',
  ziel: 30,
  geprueft: 3,
  qualifiziert: 1,
  gesendet: 1,
  dubletten: 1,
  abgelehnt: 1,
  unklar: 0,
  fehler: 0,
  kontrollen: 0,
  aktuelles_profil: 'Max Muster',
  meldung: null,
  batch_id: 'b1',
  started_at: '2026-10-29T10:00:00Z',
  finished_at: null,
  updated_at: '2026-10-29T10:05:00Z',
  agent_status: 'arbeitet',
  agent_angefordert: '2026-10-29T10:00:00Z',
  agent_heartbeat: new Date().toISOString(),
  agent_rechner: 'MacBook Pro',
  agent_meldung: null,
  agent_starts: 1,
  agent_auftrag: 'Auftrag',
  agent_sitzung: null,
  agent_frage: null,
  agent_antwort: null,
  agent_anbieter: 'chatgpt',
}

function rendern(p: Partial<RechercheLauf> = {}) {
  m.lauf = { ...LAUF, ...p }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/auftrag/recherche/lauf-1']}>
          <Routes>
            <Route path="/auftrag/recherche/:id" element={<RechercheSeite />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const feld = (label: string, wert: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: wert } })
const gesendet = () => screen.getByRole('button', { name: /Vernetzungsanfrage gesendet/ })

beforeEach(() => {
  m.pruefen.mockReset()
  m.eintragen.mockReset()
  m.status.mockReset()
  m.kontrolle.mockReset()
  m.agent.mockReset()
  m.antworten.mockReset()
  m.ersatz.mockReset()
  m.dienste = [{ zuletzt_gesehen: new Date().toISOString(), rechner: 'MacBook Pro' }]
})

describe('RechercheSeite', () => {
  it('„gesendet“ erst nach „Prüfen“ = frei, und nur für dieselbe URL', async () => {
    m.pruefen.mockResolvedValue({ frei: true, art: 'neu', grund: 'Nicht im CRM.' })
    rendern()
    expect(gesendet()).toBeDisabled()
    feld('LinkedIn-Profil-URL', 'https://www.linkedin.com/in/max-muster')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Prüfen' })))
    expect(m.pruefen).toHaveBeenCalledWith(expect.objectContaining({ lauf: 'lauf-1' }))
    expect(screen.getByText(/Frei – Nicht im CRM/)).toBeInTheDocument()
    expect(gesendet()).toBeEnabled()

    // Pflichtangaben fehlen → Formularfehler statt Aufruf
    fireEvent.click(gesendet())
    expect(m.eintragen).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Für „gesendet“ fehlt')

    feld('Vorname', 'Max')
    feld('Nachname', 'Muster')
    feld('Firma (aktueller Arbeitgeber)', 'Muster Solar GmbH')
    feld('Aktuelle Position', 'Leiter Kundenservice')
    fireEvent.click(screen.getByRole('button', { name: 'A · Führung' }))
    feld('Qualifizierungsgrund / Grund', 'PV für Privathaushalte, ca. 30 MA')
    fireEvent.click(gesendet())
    expect(m.eintragen).toHaveBeenCalledWith(
      expect.objectContaining({ ergebnis: 'gesendet', kategorie: 'A', vorname: 'Max', firma: 'Muster Solar GmbH' }),
      expect.anything(),
    )

    // andere URL → wieder gesperrt
    feld('LinkedIn-Profil-URL', 'https://www.linkedin.com/in/andere-person')
    expect(gesendet()).toBeDisabled()
  })

  it('Treffer im CRM: nicht anfragen, Dublette mit dem Grund der Prüfung eintragen', async () => {
    m.pruefen.mockResolvedValue({ frei: false, art: 'verbindung', grund: 'Schon vernetzt (angenommen).' })
    rendern()
    feld('LinkedIn-Profil-URL', 'https://www.linkedin.com/in/max-muster')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Prüfen' })))
    expect(screen.getByText(/Nicht anfragen – Schon vernetzt/)).toBeInTheDocument()
    expect(gesendet()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Als Dublette eintragen' }))
    expect(m.eintragen).toHaveBeenCalledWith(
      expect.objectContaining({ ergebnis: 'dublette', grund: 'Schon vernetzt (angenommen).', lauf: 'lauf-1' }),
      expect.anything(),
    )
  })

  it('„Nicht qualifiziert“ verlangt einen Grund', () => {
    rendern()
    feld('LinkedIn-Profil-URL', 'https://www.linkedin.com/in/max-muster')
    fireEvent.click(screen.getByRole('button', { name: 'Nicht qualifiziert' }))
    expect(m.eintragen).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Grund')
    feld('Qualifizierungsgrund / Grund', 'Großhandel, keine B2C-Installation')
    fireEvent.click(screen.getByRole('button', { name: 'Nicht qualifiziert' }))
    expect(m.eintragen).toHaveBeenCalledWith(
      expect.objectContaining({ ergebnis: 'nicht_qualifiziert', grund: 'Großhandel, keine B2C-Installation' }),
      expect.anything(),
    )
  })

  it('Kontrollpunkt nach 10 Profilen sperrt das Formular, bis alle Punkte bestätigt sind', () => {
    rendern({ geprueft: 10, kontrollen: 0 })
    expect(screen.getByRole('region', { name: 'Kontrollpunkt' })).toBeInTheDocument()
    expect(screen.getByLabelText('LinkedIn-Profil-URL')).toBeDisabled()
    const weiter = screen.getByRole('button', { name: /Kriterien geprüft/ })
    fireEvent.click(weiter)
    expect(m.kontrolle).not.toHaveBeenCalled()
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(weiter)
    expect(m.kontrolle).toHaveBeenCalledWith('lauf-1')
  })

  it('beendeter Lauf: nur ansehen, neuer Lauf möglich', () => {
    rendern({ status: 'abgeschlossen', gesendet: 30, meldung: 'Ziel erreicht: 30 Vernetzungsanfragen gesendet.' })
    expect(screen.getByLabelText('LinkedIn-Profil-URL')).toBeDisabled()
    expect(screen.getByText(/Ziel erreicht: 30/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neuen Lauf starten' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausieren' })).toBeNull()
  })

  it('Agent-Zustand oben: arbeitet ohne Knopf, beendet mit „Agent neu starten“', () => {
    rendern()
    const panel = screen.getByRole('region', { name: 'Agent' })
    expect(panel).toHaveTextContent('ChatGPT arbeitet auf MacBook Pro')
    expect(screen.queryByRole('button', { name: /Agent (neu )?starten/ })).toBeNull()
  })

  it('beendeter Agent zeigt seinen Bericht und lässt sich neu starten', () => {
    rendern({ agent_status: 'beendet', agent_meldung: 'Fertig: 4 gesendet, 12 geprüft' })
    expect(screen.getByRole('region', { name: 'Agent' })).toHaveTextContent('Fertig: 4 gesendet, 12 geprüft')
    fireEvent.click(screen.getByRole('button', { name: 'Agent neu starten' }))
    expect(m.agent).toHaveBeenCalledWith({ lauf: 'lauf-1', auftrag: expect.stringContaining('profil_pruefen') })
  })

  it('Freigabe: Liste sichtbar, „Freigeben“ mit Anmerkung und „Nicht freigeben“ antworten dem Agenten', () => {
    rendern({
      agent_status: 'frage',
      agent_frage:
        'Freigabe nötig: 2 Vernetzungsanfragen\nAnna Beispiel · GF · Sonne GmbH · A · B2C · https://www.linkedin.com/in/x',
    })
    const panel = screen.getByRole('region', { name: 'Agent' })
    expect(panel).toHaveTextContent('Freigabe nötig: 2 Vernetzungsanfragen')
    expect(panel).toHaveTextContent('Anna Beispiel · GF · Sonne GmbH')
    feld('Anmerkung an den Agenten (optional)', 'nur die erste')
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }))
    expect(m.antworten).toHaveBeenCalledWith({ lauf: 'lauf-1', freigabe: true, text: 'nur die erste' })
    fireEvent.click(screen.getByRole('button', { name: 'Nicht freigeben' }))
    expect(m.antworten).toHaveBeenLastCalledWith({ lauf: 'lauf-1', freigabe: false, text: 'nur die erste' })
  })

  it('andere Frage: freie Antwort oder „Weitermachen“', () => {
    rendern({ agent_status: 'frage', agent_frage: 'Frage: Zählen Großhändler mit Montage?' })
    expect(screen.getByRole('button', { name: 'Antworten' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Weitermachen' }))
    expect(m.antworten).toHaveBeenCalledWith({ lauf: 'lauf-1', freigabe: null, text: 'Weiter so.' })
  })

  it('ohne eingerichteten Recherche-Dienst: Hinweis und „Recherche-Dienst einrichten“', () => {
    m.dienste = []
    rendern({ agent_status: 'wartet', agent_angefordert: new Date().toISOString() })
    expect(screen.getByRole('region', { name: 'Agent' })).toHaveTextContent('Kein Recherche-Dienst verbunden')
    expect(screen.getByRole('button', { name: 'Recherche-Dienst einrichten' })).toBeInTheDocument()
  })

  it('Schalter „Bei ChatGPT-Limit mit Claude weitermachen“ nur, wenn ein Dienst Claude meldet', () => {
    m.dienste = [
      { zuletzt_gesehen: new Date().toISOString(), rechner: 'MacBook Pro', claude: null, claude_ersatz: true },
    ]
    rendern()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('Schalter schaltet Claude als Ersatz aus', () => {
    m.dienste = [
      { zuletzt_gesehen: new Date().toISOString(), rechner: 'MacBook Pro', claude: '2.1.309', claude_ersatz: true },
    ]
    rendern({ agent_anbieter: 'claude' })
    expect(screen.getByRole('region', { name: 'Agent' })).toHaveTextContent('Claude arbeitet auf MacBook Pro')
    const schalter = screen.getByRole('switch', { name: 'Bei ChatGPT-Limit mit Claude weitermachen' })
    expect(schalter).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(schalter)
    expect(m.ersatz).toHaveBeenCalledWith(false)
  })

  it('Einrichten für Windows: geführte Schritte mit „Warum?“, PowerShell-Befehl mit dem neuen Schlüssel', () => {
    const k = `rd_${'b'.repeat(64)}`
    m.einrichten.mockImplementation((_: unknown, o: { onSuccess: (k: string) => void }) => o.onSuccess(k))
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Weiteren Rechner einrichten' }))
    fireEvent.click(screen.getByRole('button', { name: 'Windows' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Schritt 1 von 5: Worum es geht')
    expect(dialog).toHaveTextContent('Warum?')
    fireEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
    fireEvent.click(screen.getByRole('button', { name: 'Befehl erzeugen und kopieren' }))
    expect(document.querySelector('[data-befehl]')).toHaveTextContent(`/recherche-dienst/einrichten.ps1))) ${k}`)
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(dialog).toHaveTextContent('PowerShell öffnen und einfügen')
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(dialog).toHaveTextContent('Computer Use')
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(dialog).toHaveTextContent('Recherche-Dienst verbunden – alles bereit.')
    // zurück zum Anfang, Mac zeigt denselben Schlüssel als Terminal-Befehl
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mac' }))
    expect(document.querySelector('[data-befehl]')).toHaveTextContent(
      `/recherche-dienst/einrichten.sh | bash -s -- ${k}`,
    )
  })

  it('LinkedIn-Einschränkung melden hält den Lauf mit Wortlaut an', () => {
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn-Einschränkung melden' }))
    feld('Wortlaut der LinkedIn-Meldung', 'Sie haben das wöchentliche Limit erreicht')
    fireEvent.click(screen.getByRole('button', { name: 'Lauf anhalten' }))
    expect(m.status).toHaveBeenCalledWith(
      { lauf: 'lauf-1', status: 'fehler', meldung: 'Sie haben das wöchentliche Limit erreicht' },
      expect.anything(),
    )
  })
})
