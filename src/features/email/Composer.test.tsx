// Composer.test.tsx (BAUPLAN § 3.5): Erlaubnis-Badge mit Zitat (M-01), Vorlagen-Filter nach Grundlage, Pflichtbausteine nicht
// editierbar (M-07), Platzhalter sperren (M-04), Warnung + „Trotzdem öffnen“ (M-02), Sperrliste (M-09), Prompt nach Rückkehr,
// transaktional ohne Grundlage (M-12), Zeichenzähler, ⌘↵.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
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
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import type { SperrlisteEintrag } from '@/types/domain'
import {
  ANTWORTEN,
  LEAD_ID,
  leadMitErlaubnis,
  letzterEmailZugriff,
  rendern,
  taste,
  VORLAGE_INFO,
  VORLAGE_NOSHOW,
  VORLAGE_ZUSAMMENFASSUNG,
  zuruecksetzen,
} from './_testHilfe'
import { Composer } from './Composer'

const gmailButton = () => screen.getByRole('button', { name: /In Gmail öffnen|Trotzdem öffnen/ })
const textKopieren = () => screen.getByRole('button', { name: /^Text kopieren/ })
const mailto = () => screen.getByRole('button', { name: /mailto/ })

async function bereit(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  const r = rendern(<Composer leadId={LEAD_ID} {...props} />)
  await waitFor(() => expect(screen.getByTestId('composer')).toHaveAttribute('data-status', 'bearbeiten'))
  await waitFor(() => expect(screen.getByTestId('von')).toHaveTextContent('vincent@steinerundco.de'))
  return r
}

describe('Composer', () => {
  beforeEach(() => {
    zuruecksetzen()
    useUiStore.setState({ hotkeyScope: 'formular', scopeStack: ['formular'] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: {}, error: null } as never)
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('zeigt Empfänger, Von, Erlaubnis-Badge mit Zitat; Pflichtbausteine stehen nicht im Textfeld (M-01, M-07)', async () => {
    await bereit()
    expect(screen.getByRole('textbox', { name: 'An' })).toHaveValue('tobias.lindner@beispiel.de')
    expect(screen.getByTestId('erlaubnis-chip')).toHaveTextContent('Per LinkedIn gebeten · Mo 05.10.')
    expect(screen.getByTestId('erlaubnis-badge')).toHaveTextContent('Hat gebeten um: ‚kurze Infos zu Solvio‘')
    const bausteine = screen.getByTestId('bausteine')
    expect(bausteine).toHaveTextContent(SETTINGS.email.objection_sentence)
    expect(bausteine).toHaveTextContent('Steiner & Co.')
    expect(bausteine).toHaveTextContent(SETTINGS.email.privacy_url)
    expect(within(bausteine).queryByRole('textbox')).toBeNull()
    const text = screen.getByRole('textbox', { name: 'Text' })
    expect(text).toHaveValue('Hallo Herr Lindner,\n\nhier die Infos.\n\nViele Grüße\nVincent')
    expect(screen.getByRole('textbox', { name: 'Betreff' })).toHaveValue('Kurzinfo für Solar 01 GmbH')
    expect(gmailButton()).toBeEnabled()
    expect(screen.getByTestId('zeichen')).toHaveTextContent(/\d+ \/ 1\.400/)
  })

  it('Vorlage-Select listet nur Vorlagen, die zur Grundlage passen (plus transaktional)', async () => {
    await bereit()
    const select = screen.getByRole('combobox', { name: 'Vorlage' })
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(labels).toEqual(['Infomail', 'No-Show · transaktional'])
    expect(labels.some((l) => l?.includes('Zusammenfassung'))).toBe(false)
    expect(labels.some((l) => l?.includes('LinkedIn'))).toBe(false)
  })

  it('ohne Grundlage: Öffnen, mailto und Kopieren deaktiviert, Grund sichtbar; nur transaktionale Vorlage (M-01, M-12)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none' })
    ANTWORTEN.templates = [VORLAGE_INFO, VORLAGE_ZUSAMMENFASSUNG]
    await bereit()
    expect(screen.getByTestId('erlaubnis-chip')).toHaveTextContent('Keine Erlaubnis')
    expect(gmailButton()).toBeDisabled()
    expect(textKopieren()).toBeDisabled()
    expect(mailto()).toBeDisabled()
    expect(screen.getByTestId('gate-grund')).toHaveTextContent(
      /Keine Erlaubnis-Grundlage\. Trag ein, wann und wie Tobias/,
    )
    expect(screen.getByText('Keine Vorlage passt zur Grundlage – erst Erlaubnis erfassen.')).toBeInTheDocument()
  })

  it('transaktionale Vorlage ohne Grundlage, aber mit Adresse, lässt sich öffnen – ohne Widerspruchssatz (M-12, M-07)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none' })
    ANTWORTEN.templates = [VORLAGE_NOSHOW]
    await bereit()
    expect(gmailButton()).toBeEnabled()
    expect(screen.getByTestId('bausteine')).not.toHaveTextContent(SETTINGS.email.objection_sentence)
    expect(screen.getByText('Transaktions-Vorlage: kein Widerspruchssatz, keine Produktabsätze.')).toBeInTheDocument()
    fireEvent.click(gmailButton())
    await waitFor(() => expect(window.open).toHaveBeenCalled())
  })

  it('[Punkt 1–3] als Pflichtfelder: Öffnen erst, wenn alle drei gefüllt sind (M-04)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'meeting_held' })
    await bereit({ vorlageId: VORLAGE_ZUSAMMENFASSUNG.id })
    const felder = screen.getByTestId('pflichtfelder')
    expect(within(felder).getByRole('textbox', { name: '[Punkt 1]' })).toBeInTheDocument()
    expect(gmailButton()).toBeDisabled()
    expect(textKopieren()).toBeDisabled()
    expect(screen.getByTestId('gate-grund')).toHaveTextContent('Erst alle Platzhalter eintragen.')
    fireEvent.change(within(felder).getByRole('textbox', { name: '[Punkt 1]' }), { target: { value: 'Eins' } })
    fireEvent.change(within(felder).getByRole('textbox', { name: '[Punkt 2]' }), { target: { value: 'Zwei' } })
    expect(gmailButton()).toBeDisabled()
    fireEvent.change(within(felder).getByRole('textbox', { name: '[Punkt 3]' }), { target: { value: 'Drei' } })
    expect(screen.getByTestId('offen-automatisch')).toHaveTextContent('[Gesprächsdatum]')
    fireEvent.change(screen.getByRole('textbox', { name: 'Betreff' }), { target: { value: 'Unser Gespräch' } })
    await waitFor(() => expect(gmailButton()).toBeEnabled())
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
      'Hallo Herr Lindner,\n\nEins\nZwei\nDrei\n\nViele Grüße',
    )
  })

  it('Warnung > 12 Monate: erster Klick macht „Trotzdem öffnen“, zweiter öffnet (M-02)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_at: '2025-01-05T09:00:00+01:00' })
    await bereit()
    expect(screen.getByRole('note')).toHaveTextContent('Erlaubnis älter als 12 Monate')
    expect(screen.getByTestId('erlaubnis-chip')).toHaveAttribute('title', 'Erlaubnis älter als 12 Monate')
    expect(gmailButton()).toHaveTextContent('In Gmail öffnen')
    fireEvent.click(gmailButton())
    await waitFor(() => expect(gmailButton()).toHaveTextContent('Trotzdem öffnen'))
    expect(window.open).not.toHaveBeenCalled()
    fireEvent.click(gmailButton())
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1))
  })

  it('Sperrlisten-Treffer blockiert jeden Versandweg ohne Override (M-09)', async () => {
    ANTWORTEN.sperrliste = [
      { id: 's1', email: 'tobias.lindner@beispiel.de', lead_id: null, channels: ['email'] },
    ] as unknown as SperrlisteEintrag[]
    await bereit()
    expect(gmailButton()).toBeDisabled()
    expect(textKopieren()).toBeDisabled()
    expect(mailto()).toBeDisabled()
    expect(screen.getByTestId('gate-grund')).toHaveTextContent('Auf der Sperrliste – kein Versand, kein Override.')
    expect(screen.queryByText(/Trotzdem/)).toBeNull()
  })

  it('⌘↵ öffnet Gmail; Rückkehr zeigt „Mail an Herrn Lindner gesendet?“; Ja ↵ bestätigt (M-05, M-06)', async () => {
    await bereit()
    taste('Enter', { metaKey: true })
    await waitFor(() => expect(window.open).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('composer')).toHaveAttribute('data-status', 'geoeffnet'))
    expect(screen.getByText(/Entwurf gespeichert · in Gmail geöffnet/)).toBeInTheDocument()
    fireEvent(window, new Event('focus'))
    const prompt = await screen.findByRole('alertdialog', { name: 'Mail an Herrn Lindner gesendet?' })
    const ja = within(prompt).getByRole('button', { name: /^Ja/ })
    expect(ja).toHaveFocus()
    fireEvent.click(ja)
    await waitFor(() => expect(letzterEmailZugriff('update')).toMatchObject({ status: 'sent_confirmed' }))
  })

  it('„Nein“ schließt den Prompt, Entwurf bleibt (M-10)', async () => {
    await bereit()
    fireEvent.click(gmailButton())
    await waitFor(() => expect(screen.getByTestId('composer')).toHaveAttribute('data-status', 'geoeffnet'))
    fireEvent(window, new Event('focus'))
    const prompt = await screen.findByRole('alertdialog')
    fireEvent.click(within(prompt).getByRole('button', { name: 'Nein' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText(/Entwurf gespeichert · Tab Entwürfe/)).toBeInTheDocument()
    expect(letzterEmailZugriff('update')).toMatchObject({ status: 'opened_in_client' })
  })

  it('Zeichenzähler: über 1 400 Amber + Hinweis, Gmail gesperrt, Kopieren frei', async () => {
    await bereit()
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), { target: { value: 'x'.repeat(1500) } })
    expect(screen.getByTestId('zeichen')).toHaveClass('text-overdue')
    expect(screen.getByText('Zu lang für den Gmail-Link – Kopieren nutzen.')).toBeInTheDocument()
    expect(gmailButton()).toBeDisabled()
    expect(textKopieren()).toBeEnabled()
  })

  it('Vorschau zeigt den Versandtext mit Bausteinen', async () => {
    await bereit()
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }))
    const v = screen.getByTestId('vorschau')
    expect(v).toHaveTextContent('Hallo Herr Lindner')
    expect(v).toHaveTextContent(SETTINGS.email.objection_sentence)
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull()
  })

  it('[Anrede] bei neutral: Herr/Frau einmal wählen', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ salutation: 'neutral' })
    await bereit()
    expect((screen.getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement).value).toContain('[Anrede] Lindner')
    expect(gmailButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Frau' }))
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement).value).toContain(
        'Hallo Frau Lindner',
      ),
    )
    expect(gmailButton()).toBeEnabled()
  })

  it('„[“ im Text öffnet die Platzhalter-Liste; Enter fügt ein (und füllt sofort aus dem Lead)', async () => {
    await bereit()
    const text = screen.getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement
    fireEvent.change(text, { target: { value: 'Hallo [Vor', selectionStart: 10 } })
    const liste = await screen.findByRole('listbox', { name: 'Platzhalter' })
    expect(within(liste).getByRole('option', { name: /\[Vorname\]/ })).toBeInTheDocument()
    text.setSelectionRange(10, 10)
    fireEvent.keyDown(text, { key: 'Enter' })
    await waitFor(() => expect(text).toHaveValue('Hallo Tobias'))
    expect(screen.queryByRole('listbox', { name: 'Platzhalter' })).toBeNull()
  })
})
