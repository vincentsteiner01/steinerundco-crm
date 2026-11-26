// Feiertage (Neustart 25.11.2026, vorher ein Block in „Ziele“): Tage hinzufügen und entfernen – jede Änderung ersetzt
// settings.feiertage sofort, sortiert (kein eigener „Speichern“-Knopf: ein hinzugefügter Tag ging sonst beim Seitenwechsel
// ohne Rückfrage verloren). An diesen Tagen sendet keine Kampagne. Fehlt die Zeile in crm.settings, beginnt die Liste leer.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { Feiertage } from './Feiertage'
import { anzahlAufrufe, letzterAufruf, MEMBER_V, testZustand, testZustandZuruecksetzen } from './_testDaten'
import { rendern } from './_testHilfe'

type Upsert = { key: string; value: string[] }
const vonMock = () => vi.mocked(supabase.from)
const keinSpeichernKnopf = () => expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull()
const geschrieben = () => anzahlAufrufe(vonMock(), 'settings', 'upsert')
const zuletzt = () => letzterAufruf(vonMock(), 'settings', 'upsert') as Upsert
const liste = (jahr: string) => screen.getByRole('list', { name: `Feiertage ${jahr}` })

function eintragen(text: string) {
  const feld = screen.getByLabelText('Feiertag hinzufügen')
  fireEvent.change(feld, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
}

describe('Feiertage', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    vonMock().mockClear()
    vi.mocked(toast).mockClear()
    testZustandZuruecksetzen()
    // „heute“ fest: das vorgewählte Jahr und „vergangen/kommend“ hängen daran
    vi.useFakeTimers({ now: new Date('2026-11-25T09:00:00+01:00'), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('zeigt den einen Satz und die Tage des laufenden Jahres – ohne „Speichern“-Knopf', async () => {
    const { container } = rendern(<Feiertage />, '/einstellungen/feiertage')
    expect(await screen.findByText('An diesen Tagen sendet keine Kampagne.')).toBeInTheDocument()
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(3)
    expect(within(liste('2026')).getByText('Fr 25.12.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Jahr' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true')
    keinSpeichernKnopf()
    // Keine Texte aus dem alten CRM (Sequenzschritte, Wiedervorlagen, Fälligkeiten), keine Tastenhinweise
    expect(container.textContent).not.toMatch(/Sequenz|Wiedervorlage|Fälligkeit/)
    expect(container.querySelector('kbd')).toBeNull()
  })

  it('hinzufügen speichert sofort: settings.feiertage wird sortiert ersetzt, der Tag steht in der Liste', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    eintragen('24.12.2026')
    await waitFor(() => expect(geschrieben()).toBe(1))
    expect(zuletzt().key).toBe('feiertage')
    expect(zuletzt().value).toEqual(['2026-10-31', '2026-12-24', '2026-12-25', '2026-12-26', '2027-01-01'])
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Feiertage gespeichert.'))
    expect(await within(liste('2026')).findByText('Do 24.12.')).toBeInTheDocument()
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByLabelText('Feiertag hinzufügen')).toHaveValue('')
    keinSpeichernKnopf()
  })

  // Fund 34 (25.11.2026): nach dem Speichern stand die alte Liste da, und der nächste Tag überschrieb den eben gespeicherten
  it('zwei Tage nacheinander: nach dem ersten steht er in der Liste, das zweite Speichern enthält beide', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    eintragen('24.12.2026')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Feiertage gespeichert.'))
    // neu geladen (onSettled): die Quelle hat sich geändert, die Liste zeigt weiter den neuen Stand
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'settings', 'select')).toBeGreaterThanOrEqual(3))
    expect(within(liste('2026')).getByText('Do 24.12.')).toBeInTheDocument()
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(4)
    eintragen('31.12.2026')
    await waitFor(() => expect(geschrieben()).toBe(2))
    expect(zuletzt().value).toEqual([
      '2026-10-31',
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
      '2026-12-31',
      '2027-01-01',
    ])
    expect(await within(liste('2026')).findByText('Do 31.12.')).toBeInTheDocument()
    expect(within(liste('2026')).getByText('Do 24.12.')).toBeInTheDocument()
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(5)
  })

  it('nach dem Hinzufügen die Seite wechseln und zurückkommen: der Tag ist noch da', async () => {
    const erste = rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    eintragen('24.12.')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Feiertage gespeichert.'))
    erste.unmount()
    // frisch geladen (eigener Cache), wie nach „Profil“ und zurück
    rendern(<Feiertage />, '/einstellungen/feiertage')
    expect(
      await within(await screen.findByRole('list', { name: 'Feiertage 2026' })).findByText('Do 24.12.'),
    ).toBeInTheDocument()
    expect(geschrieben()).toBe(1)
  })

  it('Enter im Feld trägt den Tag ein und speichert ihn; ein Tag im anderen Jahr wechselt die Ansicht', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    const feld = await screen.findByLabelText('Feiertag hinzufügen')
    fireEvent.change(feld, { target: { value: '01.05.2027' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '2027' })).toHaveAttribute('aria-pressed', 'true')
    expect(await within(liste('2027')).findByText('Sa 01.05.')).toBeInTheDocument()
    await waitFor(() => expect(geschrieben()).toBe(1))
    expect(zuletzt().value).toEqual(['2026-10-31', '2026-12-25', '2026-12-26', '2027-01-01', '2027-05-01'])
  })

  it('entfernen speichert sofort: die Liste ohne den Tag', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    fireEvent.click(screen.getByRole('button', { name: '31.10.2026 entfernen' }))
    await waitFor(() => expect(geschrieben()).toBe(1))
    expect(zuletzt().key).toBe('feiertage')
    expect(zuletzt().value).toEqual(['2026-12-25', '2026-12-26', '2027-01-01'])
    await waitFor(() => expect(within(liste('2026')).queryByText('Sa 31.10.')).not.toBeInTheDocument())
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(2)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Feiertage gespeichert.'))
  })

  it('hinzufügen und wieder entfernen: zwei Schreibvorgänge, am Ende steht die alte Liste', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    eintragen('24.12.2026')
    fireEvent.click(await screen.findByRole('button', { name: '24.12.2026 entfernen' }))
    await waitFor(() => expect(geschrieben()).toBe(2))
    expect(zuletzt().value).toEqual(['2026-10-31', '2026-12-25', '2026-12-26', '2027-01-01'])
    await waitFor(() => expect(within(liste('2026')).queryByText('Do 24.12.')).not.toBeInTheDocument())
  })

  it('ungültige Eingabe und Dublette zeigen einen Fehler und schreiben nichts', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    eintragen('irgendwann')
    expect(screen.getByRole('alert')).toHaveTextContent('Datum wie 24.12.2026 oder 24.12.')
    eintragen('31.10.2026')
    expect(screen.getByRole('alert')).toHaveTextContent('31.10.2026 steht schon in der Liste')
    expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(3)
    expect(geschrieben()).toBe(0)
  })

  it('Jahr wechseln zeigt die Tage dieses Jahres; „Gesetzliche Feiertage … ergänzen“ füllt nur das gewählte Jahr und speichert', async () => {
    rendern(<Feiertage />, '/einstellungen/feiertage')
    await screen.findByLabelText('Feiertag hinzufügen')
    // 2026 fehlen nur Feiertage, die schon vorbei sind (Januar bis Mai) – dafür gibt es keinen Knopf
    expect(screen.queryByRole('button', { name: /Gesetzliche Feiertage/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2027' }))
    expect(within(liste('2027')).getAllByRole('listitem')).toHaveLength(1)
    // nur das Jahr gewechselt: noch nichts geschrieben
    expect(geschrieben()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Gesetzliche Feiertage Hamburg 2027 ergänzen' }))
    await waitFor(() => expect(geschrieben()).toBe(1))
    const u = zuletzt()
    expect(u.value.filter((t) => t.startsWith('2026'))).toEqual(['2026-10-31', '2026-12-25', '2026-12-26'])
    expect(u.value.filter((t) => t.startsWith('2027'))).toHaveLength(10)
    expect(u.value).toEqual([...u.value].sort())
    await waitFor(() => expect(within(liste('2027')).getAllByRole('listitem')).toHaveLength(10))
    // Alles da – der Knopf verschwindet
    expect(screen.queryByRole('button', { name: /Gesetzliche Feiertage/ })).not.toBeInTheDocument()
  })

  it('fehlt die Zeile „feiertage“ in crm.settings: leere Liste statt Absturz, Hinzufügen legt sie an', async () => {
    testZustand.settingsOhne = ['feiertage']
    rendern(<Feiertage />, '/einstellungen/feiertage')
    expect(await screen.findByText('Für 2026 ist kein Feiertag eingetragen.')).toBeInTheDocument()
    eintragen('24.12.')
    await waitFor(() => expect(geschrieben()).toBe(1))
    expect(zuletzt().value).toEqual(['2026-12-24'])
    await waitFor(() => expect(within(liste('2026')).getAllByRole('listitem')).toHaveLength(1))
  })

  it('ganz ohne Zeilen in crm.settings stürzt die Seite auch nicht ab', async () => {
    testZustand.settingsOhne = 'alle'
    rendern(<Feiertage />, '/einstellungen/feiertage')
    expect(await screen.findByText('Für 2026 ist kein Feiertag eingetragen.')).toBeInTheDocument()
    expect(screen.getByText('An diesen Tagen sendet keine Kampagne.')).toBeInTheDocument()
  })
})
