// Profil (Neustart 25.11.2026): Name und E-Mail nur zum Lesen, dazu Kürzel, E-Mail-Signatur, Calendly-Link. Gespeichert wird die
// ganze member_profiles-Zeile – die Werte der entfallenen Felder (Plan, Budget, Tagesziel, Rufnummer, preferences) bleiben stehen.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { Profil } from './Profil'
import {
  anzahlAufrufe,
  letzterAufruf,
  MEMBER_M,
  MEMBER_V,
  MEMBERS,
  testZustand,
  testZustandZuruecksetzen,
} from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)
const speichernKnopf = () => screen.getByRole('button', { name: 'Speichern' })

describe('Profil', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    vonMock().mockClear()
    vi.mocked(toast).mockClear()
    testZustandZuruecksetzen()
  })

  it('zeigt Name und E-Mail nur zum Lesen, dazu Kürzel, E-Mail-Signatur und Calendly-Link', async () => {
    rendern(<Profil />)
    expect(await screen.findByLabelText('Kürzel')).toHaveValue('VS')
    expect(screen.getByLabelText('E-Mail-Signatur')).toHaveValue('Vincent Muster\nMusterfirma')
    expect(screen.getByLabelText('Calendly-Link')).toHaveValue('')
    // Name und Adresse stehen als Text da – es gibt dafür kein Eingabefeld
    expect(screen.getByText('Vincent')).toBeInTheDocument()
    expect(screen.getByText('v@example.test')).toBeInTheDocument()
    expect(screen.queryByLabelText('Anzeigename')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
  })

  it('die entfallenen Felder sind weg: Plan, Wochenbudget, Tagesziel, Rufnummer, Kanäle, Benachrichtigungen', async () => {
    const { container } = rendern(<Profil />)
    await screen.findByLabelText('Kürzel')
    for (const label of ['LinkedIn-Plan', 'Wochenbudget Anfragen', 'Tagesziel Anfragen', 'Rufnummer'])
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Kanäle aktiv|Benachrichtigungen|Realtime/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1)
    expect(container.querySelector('kbd')).toBeNull()
  })

  it('kein Text nennt den Entwickler „Lead“ – das Wort meint im CRM den Kontakt', async () => {
    const { container } = rendern(<Profil />)
    await screen.findByLabelText('Kürzel')
    expect(container.textContent).not.toMatch(/Lead/)
    expect(container.textContent).not.toMatch(/v1\b|Heute/)
  })

  it('Speichern verliert nichts: die alten Werte der entfallenen Felder stehen unverändert im Upsert', async () => {
    rendern(<Profil />)
    fireEvent.change(await screen.findByLabelText('E-Mail-Signatur'), {
      target: { value: '  Vincent Muster\nMusterweg 1, Musterstadt  ' },
    })
    fireEvent.change(screen.getByLabelText('Calendly-Link'), { target: { value: 'https://calendly.com/muster/30min' } })
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    // die drei Felder des Formulars
    expect(u.short_name).toBe('VS')
    expect(u.signature).toBe('Vincent Muster\nMusterweg 1, Musterstadt')
    expect(u.calendly_url).toBe('https://calendly.com/muster/30min')
    // alles andere genau wie in der Datenbank
    const alt = MEMBERS[0]!
    expect(u.member_id).toBe(MEMBER_V)
    expect(u.linkedin_plan).toBe('premium')
    expect(u.weekly_budget).toBe(150)
    expect(u.daily_target).toBe(30)
    expect(u.caller_number_e164).toBe('+4940123456')
    expect(u.email_address).toBe('absender@example.test')
    expect(u.linkedin_url).toBe('https://www.linkedin.com/in/test-vincent/')
    expect(u.preferences).toEqual(alt.preferences)
    expect(u.preferences).toMatchObject({ onboarding_v1: '2026-10-14', realtime_toasts: false })
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Profil gespeichert.'))
  })

  // Fund 34 (25.11.2026): Nach „Speichern“ stand kurz wieder der alte Stand im Formular (der Entwurf wurde auf die Quelle aus
  // dem Render des Klicks zurückgesetzt) – wer in dem Moment weiterschrieb, überschrieb beim nächsten Speichern das eben Gespeicherte.
  it('speichern → neu geladen → das Formular zeigt den neuen Stand → zweites Speichern enthält beide Änderungen', async () => {
    rendern(<Profil />)
    const signatur = await screen.findByLabelText('E-Mail-Signatur')
    fireEvent.change(signatur, { target: { value: 'Vincent Muster\nNeue Musterfirma' } })
    // das Neuladen nach dem Speichern anhalten: dazwischen darf nie der alte Stand erscheinen
    let weiter = () => {}
    testZustand.membersHalt = new Promise<void>((ok) => (weiter = ok))
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Profil gespeichert.'))
    expect(screen.getByLabelText('E-Mail-Signatur')).toHaveValue('Vincent Muster\nNeue Musterfirma')
    expect(speichernKnopf()).toBeDisabled()
    // die Quelle ändert sich (Neuladen fertig): weiter der neue Stand
    testZustand.membersHalt = null
    weiter()
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'members', 'select')).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(speichernKnopf()).toBeDisabled())
    expect(screen.getByLabelText('E-Mail-Signatur')).toHaveValue('Vincent Muster\nNeue Musterfirma')
    // zweite Änderung an einem anderen Feld
    fireEvent.change(screen.getByLabelText('Calendly-Link'), { target: { value: 'https://calendly.com/muster/30min' } })
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(2))
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    expect(u.signature).toBe('Vincent Muster\nNeue Musterfirma')
    expect(u.calendly_url).toBe('https://calendly.com/muster/30min')
    expect(u.short_name).toBe('VS')
  })

  it('gleich weiterschreiben, während das Neuladen noch läuft: das zweite Speichern überschreibt das erste nicht', async () => {
    rendern(<Profil />)
    fireEvent.change(await screen.findByLabelText('E-Mail-Signatur'), { target: { value: 'Neue Signatur' } })
    let weiter = () => {}
    testZustand.membersHalt = new Promise<void>((ok) => (weiter = ok))
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Profil gespeichert.'))
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'VM' } })
    testZustand.membersHalt = null
    weiter()
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'members', 'select')).toBeGreaterThanOrEqual(2))
    // die eigene Eingabe bleibt, die gespeicherte Signatur auch
    expect(screen.getByLabelText('Kürzel')).toHaveValue('VM')
    expect(screen.getByLabelText('E-Mail-Signatur')).toHaveValue('Neue Signatur')
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(2))
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    expect(u.signature).toBe('Neue Signatur')
    expect(u.short_name).toBe('VM')
  })

  it('leere Signatur und leerer Link werden als null gespeichert', async () => {
    rendern(<Profil />)
    fireEvent.change(await screen.findByLabelText('E-Mail-Signatur'), { target: { value: '   ' } })
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    expect(u.signature).toBeNull()
    expect(u.calendly_url).toBeNull()
    expect(u.weekly_budget).toBe(150)
  })

  it('Calendly-Link muss mit https://calendly.com/ beginnen – sonst Fehler und kein Upsert', async () => {
    rendern(<Profil />)
    fireEvent.change(await screen.findByLabelText('Calendly-Link'), {
      target: { value: 'http://beispiel.test/termin' },
    })
    fireEvent.click(speichernKnopf())
    expect(screen.getByRole('alert')).toHaveTextContent('Link beginnt mit https://calendly.com/')
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(0)
  })

  it('altes Kürzel mit vier Zeichen (früher der Vorname) blockiert das Speichern der Signatur nicht und bleibt stehen', async () => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_M, email: 'm@example.test', display_name: 'Mike' },
    })
    rendern(<Profil />)
    expect(await screen.findByLabelText('Kürzel')).toHaveValue('Mike')
    fireEvent.change(screen.getByLabelText('E-Mail-Signatur'), { target: { value: 'Mike Muster' } })
    fireEvent.click(speichernKnopf())
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(u.member_id).toBe(MEMBER_M)
    expect(u.short_name).toBe('Mike')
    expect(u.signature).toBe('Mike Muster')
    expect(u.linkedin_plan).toBe('basic')
    expect(u.weekly_budget).toBe(100)
  })

  it('Speichern ist ohne Änderung deaktiviert; das Kürzel wird groß geschrieben', async () => {
    rendern(<Profil />)
    const kuerzel = await screen.findByLabelText('Kürzel')
    expect(speichernKnopf()).toBeDisabled()
    fireEvent.change(kuerzel, { target: { value: 'vs' } })
    expect(kuerzel).toHaveValue('VS')
    expect(speichernKnopf()).toBeDisabled()
    fireEvent.change(kuerzel, { target: { value: 'v' } })
    expect(kuerzel).toHaveValue('V')
    expect(speichernKnopf()).toBeEnabled()
  })

  it.each([
    ['alle Zeilen', 'alle' as const],
    ['die Zeile „linkedin“', ['linkedin']],
  ])('stürzt nicht ab, wenn in crm.settings %s fehlen', async (_name, ohne) => {
    testZustand.settingsOhne = ohne
    rendern(<Profil />)
    expect(await screen.findByLabelText('Kürzel')).toHaveValue('VS')
    expect(screen.getByLabelText('E-Mail-Signatur')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument()
  })

  it('ohne eigene Zeile in crm.members: ein Satz und „Erneut versuchen“ statt endloser Ladebalken', async () => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: '99999999-0000-4000-8000-000000000009', email: 'x@example.test', display_name: 'Fremd' },
    })
    rendern(<Profil />)
    expect(await screen.findByText('Dein Profil konnte nicht geladen werden.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
  })
})
