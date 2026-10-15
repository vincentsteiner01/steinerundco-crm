// @vitest-environment jsdom
// Nachrichten-Block: Kopieren gesperrt bei offenen Platzhaltern, Platzhalter direkt editierbar, „Gesendet“ erst nach dem Kopieren.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NaechsteNachricht } from '../src/ui/panel/NaechsteNachricht'

const VORLAGE = { id: 't-fu1', key: 'li_fu_kurz_1', name: 'Kurzfristig 1', body: 'Hallo [Vorname], zu [Reaktion] – passt es?', phase: 'follow_up' as const }
const LEAD = { first_name: 'Tilda', last_name: 'Testfall', salutation: 'frau' as const }

describe('NaechsteNachricht', () => {
  const writeText = vi.fn(async () => {})
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    writeText.mockClear()
  })
  afterEach(() => cleanup())

  it('sperrt Kopieren, bis der offene Platzhalter gefüllt ist; Gesendet erst nach dem Kopieren', async () => {
    const onGesendet = vi.fn(async () => true)
    render(<NaechsteNachricht vorlage={VORLAGE} lead={LEAD} me={null} kopf="Vorlage · Kurzfristig 1" gesperrt={null} tastenAktiv onGesendet={onGesendet} />)
    expect(screen.getByText(/Platzhalter 1\/2/)).toBeTruthy()
    const gesendet = screen.getByRole('button', { name: /Gesendet/ }) as HTMLButtonElement
    expect(gesendet.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Kopieren/ }))
    await screen.findByText('Erst [Reaktion] eintragen.')
    expect(writeText).not.toHaveBeenCalled()

    const feld = screen.getByLabelText('Platzhalter Reaktion') as HTMLInputElement
    fireEvent.change(feld, { target: { value: 'deine Nachricht' } })
    // Feld bleibt beim Tippen ein Eingabefeld (kein Fokusverlust)
    expect(screen.getByLabelText('Platzhalter Reaktion')).toBe(feld)

    fireEvent.click(screen.getByRole('button', { name: /Kopieren/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hallo Tilda, zu deine Nachricht – passt es?'))
    await waitFor(() => expect((screen.getByRole('button', { name: /Gesendet/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByText(/jetzt in LinkedIn einfügen/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Gesendet/ }))
    await waitFor(() => expect(onGesendet).toHaveBeenCalledWith('t-fu1'))
  })

  it('Tasten C und E', async () => {
    const onGesendet = vi.fn(async () => true)
    render(
      <NaechsteNachricht
        vorlage={{ ...VORLAGE, body: 'Hallo [Vorname].' }}
        lead={LEAD}
        me={null}
        kopf="Vorlage"
        gesperrt={null}
        tastenAktiv
        onGesendet={onGesendet}
      />,
    )
    fireEvent.keyDown(window, { key: 'e' })
    expect(onGesendet).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hallo Tilda.'))
    await waitFor(() => expect((screen.getByRole('button', { name: /Gesendet/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.keyDown(window, { key: 'e' })
    await waitFor(() => expect(onGesendet).toHaveBeenCalledTimes(1))
  })

  it('Gate: Kopieren und Gesendet gesperrt, Grund sichtbar', () => {
    render(<NaechsteNachricht vorlage={VORLAGE} lead={LEAD} me={null} kopf="Vorlage" gesperrt="Widerspruch – nicht kontaktieren" tastenAktiv onGesendet={vi.fn()} />)
    expect((screen.getByRole('button', { name: /Kopieren/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Widerspruch – nicht kontaktieren – kein Kontakt.')).toBeTruthy()
  })

  it('Text bearbeiten: freier Text, offene Platzhalter darin zählen weiter', async () => {
    render(<NaechsteNachricht vorlage={VORLAGE} lead={LEAD} me={null} kopf="Vorlage" gesperrt={null} tastenAktiv onGesendet={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Text bearbeiten' }))
    const ta = screen.getByLabelText('Nachricht bearbeiten') as HTMLTextAreaElement
    expect(ta.value).toBe('Hallo Tilda, zu [Reaktion] – passt es?')
    fireEvent.change(ta, { target: { value: 'Hallo Tilda, alles klar.' } })
    fireEvent.click(screen.getByRole('button', { name: /Kopieren/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hallo Tilda, alles klar.'))
  })
})
