// BAUPLAN § 3.9 Sperrliste.test.tsx / E-08: alle Einträge sichtbar, Suche, Hinzufügen braucht mind. einen Schlüssel + Grund,
// Entfernen fragt Bestätigung + Grund und schreibt eine Notiz-Aktivität am Lead.
// Neustart 25.11.2026: keine Tasten und Tastenhinweise, neuer Dialogtext, ruhiger Leerzustand; schlichte Liste statt der
// Tabelle (Name bzw. Adresse, Grund, Datum, „Entfernen“ in 44 px), kein Zähler, im Dialog keine Kanal-Auswahl mehr.
// 26.11.2026: Link, E-Mail und Grund stehen je in einer eigenen Zeile und brechen um (nichts endet mit „…“), im Chip steht
// nur das Stichwort, und der Dialog „Entfernen“ nennt den Eintrag.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { supabase } from '@/data/supabase'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { Sperrliste } from './Sperrliste'
import { anzahlAufrufe, letzterAufruf, MEMBER_V, SPERRLISTE, testZustand, testZustandZuruecksetzen } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)

// Erfundener Eintrag mit allem, was lang werden kann: Name, LinkedIn-Link, E-Mail, Telefon und 68 Zeichen Notiz
const LANG_LINK = 'linkedin.com/in/petra-pruefstein-beispiel-solartechnik-und-elektroanlagen-0123456789'
const LANG_MAIL = 'petra.pruefstein@beispiel-solartechnik-und-elektroanlagen.example.test'
const LANG_NOTIZ = 'Widerspruch per Telefon am 20.11.2026, möchte keine Nachrichten mehr'
const LANGER_EINTRAG: (typeof SPERRLISTE)[number] = {
  id: '50000000-0000-4000-8000-000000000003',
  name: 'Petra Prüfstein',
  company: 'Mustersolar GmbH',
  channels: ['linkedin', 'telefon', 'email'],
  reason: 'widerspruch',
  created_at: '2026-11-20T10:00:00+01:00',
  created_by: MEMBER_V,
  email: LANG_MAIL,
  phone_e164: '+4940123456789',
  linkedin_url_norm: LANG_LINK,
  lead_id: null,
  note: LANG_NOTIZ,
}
const ANZAHL = SPERRLISTE.length

describe('Sperrliste', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    vonMock().mockClear()
    testZustandZuruecksetzen()
    Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: vi.fn() })
  })
  // der lange Eintrag gilt nur in seinem Test – danach wieder die zwei Ausgangszeilen
  afterEach(() => {
    SPERRLISTE.length = ANZAHL
  })

  it('E-08: zeigt alle Einträge als schlichte Liste – Name bzw. Adresse, Grund, Datum und „Entfernen“ in 44 px', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const liste = await screen.findByRole('list', { name: 'Sperrliste' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(liste.querySelectorAll('li[data-id]')).toHaveLength(2)
    const erste = liste.querySelector(`li[data-id="${SPERRLISTE[0]!.id}"]`) as HTMLElement
    expect(erste).toHaveTextContent('Test Gesperrt')
    // Link und E-Mail je in einer eigenen Zeile, der Grund als Text – im Chip nur das Stichwort
    expect(within(erste).getByText('linkedin.com/in/test-gesperrt')).toBeInTheDocument()
    expect(within(erste).getByText('gesperrt@example.test')).toBeInTheDocument()
    expect(within(erste).getByText('Widerspruch per Telefon').tagName).toBe('P')
    expect(within(erste).getByText('Widerspruch')).toBeInTheDocument()
    expect(erste.textContent).not.toMatch(/ · /)
    expect(erste).toHaveTextContent('05.10.2026')
    expect(within(erste).getByRole('button', { name: 'Entfernen' })).toHaveClass('h-11')
    // ohne Namen steht die Adresse vorn – einmal, nicht doppelt
    const zweite = liste.querySelector(`li[data-id="${SPERRLISTE[1]!.id}"]`) as HTMLElement
    expect(zweite).toHaveTextContent('info@example.test')
    expect(zweite.textContent?.match(/info@example\.test/g)).toHaveLength(1)
    expect(within(zweite).getByText('Manuell')).toBeInTheDocument()
    expect(within(zweite).getByText('Sammeladresse')).toBeInTheDocument()
    // entfallen: Unternehmen, Kanal-Umfang, „Erfasst von“, Quelle, Zähler, Spaltenköpfe
    expect(liste).not.toHaveTextContent(/Solar 99 GmbH|alle Kanäle|Mike|Lead/)
    expect(screen.queryByText('2 von 2')).toBeNull()
    expect(screen.queryByRole('columnheader')).toBeNull()
  })

  it('langer Eintrag: Link, E-Mail, Telefon und Grund stehen vollständig da – je eine Zeile, die umbricht, nichts mit „…“', async () => {
    SPERRLISTE.push(LANGER_EINTRAG)
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const liste = await screen.findByRole('list', { name: 'Sperrliste' })
    const zeile = liste.querySelector(`li[data-id="${LANGER_EINTRAG.id}"]`) as HTMLElement
    const kopf = within(zeile).getByText('Petra Prüfstein')
    const link = within(zeile).getByText(LANG_LINK)
    const mail = within(zeile).getByText(LANG_MAIL)
    const telefon = within(zeile).getByText('+49 40 123456789')
    const grund = within(zeile).getByText(LANG_NOTIZ)
    // je ein eigenes Element (eigene Zeile), in dieser Reihenfolge: Grund, Link, E-Mail, Telefon
    expect(new Set([link, mail, telefon, grund]).size).toBe(4)
    expect([...link.parentElement!.children]).toEqual([grund, link, mail, telefon])
    // Umbruch statt Abschneiden: kein einzeiliges „…“ mehr, kein title als Ersatz für den vollen Text
    for (const el of [kopf, link.parentElement!]) expect(el.className).toContain('[overflow-wrap:anywhere]')
    expect(liste.querySelector('.truncate-1, [title]')).toBeNull()
    // im Chip nur das Stichwort
    expect(within(zeile).getByText('Widerspruch')).toBeInTheDocument()
    expect(within(zeile).getByRole('button', { name: 'Entfernen' })).toHaveClass('h-11')
  })

  it('Suche filtert clientseitig', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const suche = await screen.findByLabelText('Sperrliste durchsuchen')
    fireEvent.change(suche, { target: { value: 'solar' } })
    expect(screen.getByRole('list', { name: 'Sperrliste' }).querySelectorAll('li[data-id]')).toHaveLength(1)
    // kein Zähler
    expect(screen.queryByText(/\d von \d/)).toBeNull()
    fireEvent.change(suche, { target: { value: 'gibtesnicht' } })
    expect(screen.getByText('Nichts gefunden für ‚gibtesnicht‘.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Sperrliste' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }))
    expect(screen.getByRole('list', { name: 'Sperrliste' }).querySelectorAll('li[data-id]')).toHaveLength(2)
  })

  it('Hinzufügen: ohne Schlüssel und Grund → Fehler, kein Insert; mit E-Mail + Grund → Insert mit Normalisierung', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    fireEvent.click(await screen.findByRole('button', { name: /Eintrag hinzufügen/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eintragen' }))
    expect(within(dialog).getByText(/Mindestens eine Angabe/)).toBeInTheDocument()
    expect(within(dialog).getByText('Grund eingeben')).toBeInTheDocument()
    expect(anzahlAufrufe(vonMock(), 'sperrliste', 'insert')).toBe(0)

    fireEvent.change(within(dialog).getByLabelText('E-Mail', { selector: 'input[type=email]' }), {
      target: { value: 'Neu@Example.test' },
    })
    fireEvent.change(within(dialog).getByLabelText('Telefon', { selector: 'input[type=tel]' }), {
      target: { value: '040 999 888' },
    })
    fireEvent.change(within(dialog).getByLabelText('LinkedIn-Link'), {
      target: { value: 'https://www.linkedin.com/in/Test-Neu/' },
    })
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Bitte nicht kontaktieren' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eintragen' }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'sperrliste', 'insert')).not.toBeNull())
    const i = letzterAufruf(vonMock(), 'sperrliste', 'insert') as Record<string, unknown>
    expect(i.email).toBe('neu@example.test')
    expect(i.phone_e164).toBe('+4940999888')
    expect(i.linkedin_url_norm).toBe('linkedin.com/in/test-neu')
    // keine Auswahl mehr: ein Eintrag gilt immer für alle Kanäle
    expect(i.channels).toEqual(['linkedin', 'telefon', 'email'])
    // `reason` ist ein Enum (DB-Check) – der Freitext-Grund steht in `note` (Review-Korrektur)
    expect(i.reason).toBe('manuell')
    expect(i.note).toBe('Bitte nicht kontaktieren')
    expect(i.created_by).toBe(MEMBER_V)
  })

  it('Neustart: keine Tastenhinweise, die Taste N öffnet nichts, ein Klick auf den Namen auch nicht', async () => {
    const { container } = rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const liste = await screen.findByRole('list', { name: 'Sperrliste' })
    expect(container.querySelector('kbd')).toBeNull()
    fireEvent.keyDown(document.body, { key: 'n' })
    fireEvent.click(within(liste).getByText('Test Gesperrt'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Dialog „Eintrag hinzufügen“ sagt, wann geprüft wird – ohne Verweis auf den Import', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    fireEvent.click(await screen.findByRole('button', { name: 'Eintrag hinzufügen' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Wird vor jeder E-Mail und beim Hinzufügen einer Karte geprüft.')
    expect(dialog.textContent).not.toMatch(/Import/)
    expect(dialog.querySelector('kbd')).toBeNull()
    // keine Kanal-Auswahl mehr (LinkedIn/Telefon/E-Mail als Kästchen)
    expect(within(dialog).queryByRole('group', { name: 'Kanäle' })).toBeNull()
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
    expect(within(dialog).getByLabelText('LinkedIn-Link')).toBeInTheDocument()
  })

  it('leere Sperrliste: ein Satz und ein Knopf – keine leere Tabelle, keine Suche', async () => {
    testZustand.sperrlisteLeer = true
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    expect(await screen.findByText('Die Sperrliste ist leer.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Sperrliste' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sperrliste durchsuchen')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Eintrag hinzufügen' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Eintrag hinzufügen')
  })

  it('E-08: Entfernen fragt nach Bestätigung und Grund; dann Delete + Notiz-Aktivität am Lead', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const liste = await screen.findByRole('list', { name: 'Sperrliste' })
    const erste = liste.querySelector(`li[data-id="${SPERRLISTE[0]!.id}"]`) as HTMLElement
    fireEvent.click(within(erste).getByRole('button', { name: /Entfernen/ }))
    const dialog = await screen.findByRole('dialog')
    // der Dialog nennt, wen er entfernt
    expect(dialog).toHaveTextContent(
      'Test Gesperrt von der Sperrliste entfernen? Die Person könnte wieder kontaktiert werden.',
    )
    const bestaetigen = within(dialog).getByRole('button', { name: 'Entfernen' })
    expect(bestaetigen).toBeDisabled()
    expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(0)
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Versehen beim Import' } })
    expect(bestaetigen).toBeEnabled()
    fireEvent.click(bestaetigen)
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(1))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'activities', 'insert')).not.toBeNull())
    const a = letzterAufruf(vonMock(), 'activities', 'insert') as Record<string, unknown>
    expect(a.lead_id).toBe(SPERRLISTE[0]!.lead_id)
    expect(a.type).toBe('notiz')
    expect(a.note).toContain('Versehen beim Import')
    expect(a.member_id).toBe(MEMBER_V)
  })

  it('Entfernen eines manuellen Eintrags (ohne lead_id) schreibt keine Aktivität', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const liste = await screen.findByRole('list', { name: 'Sperrliste' })
    const zweite = liste.querySelector(`li[data-id="${SPERRLISTE[1]!.id}"]`) as HTMLElement
    fireEvent.click(within(zweite).getByRole('button', { name: /Entfernen/ }))
    const dialog = await screen.findByRole('dialog')
    // ohne Namen nennt der Dialog die gesperrte Adresse
    expect(dialog).toHaveTextContent('info@example.test von der Sperrliste entfernen?')
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Adresse gehört jetzt uns' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen' }))
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(1))
    expect(anzahlAufrufe(vonMock(), 'activities', 'insert')).toBe(0)
  })
})
