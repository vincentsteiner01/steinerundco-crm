// Leitfäden (Neustart 25.11.2026): Liste zeigt nur nicht archivierte Leitfäden des Kanals sonstiges; Anlegen, Bearbeiten,
// „Löschen“ = archivieren (kein delete), Text kopieren, Platzhalter-Chips im Editor, Rückfrage vor dem Verwerfen.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// je Test andere Vorlagen: supabaseAntworten liest `antworten.templates` bei jeder Abfrage neu
const antworten = vi.hoisted(() => ({ templates: { data: [] as unknown, error: null as unknown } }))
vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten(antworten))
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 1),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  undoAusfuehren: vi.fn(async () => true),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_V } from '@/test/fixtures/leads'
import { vorlage } from '@/test/fixtures/vorlagen'
import type { Template } from '@/types/domain'
import { rendern } from './_testHilfe'
import { Component as Leitfaeden } from './Leitfaeden'

const ARCHIV = '2026-11-25T08:00:00+00:00'
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const ABLAUF = vorlage('sales_ablauf_erstgespraech', {
  id: id(1),
  channel: 'sonstiges',
  phase: 'erstgespraech',
  name: 'Ablauf Erstgespräch',
  body: 'Guten Tag [Anrede] [Nachname],\n\ndanke für Ihre Zeit.',
  created_at: '2026-11-25T09:00:00+00:00',
  archiviert_at: null,
})
const EINWAND = vorlage('sales_einwand_preis', {
  id: id(2),
  channel: 'sonstiges',
  phase: 'erstgespraech',
  name: 'Einwand Preis',
  body: 'Verstehe ich. Was wäre es Ihnen wert?',
  created_at: '2026-11-25T10:00:00+00:00',
  archiviert_at: null,
})
/** Was NICHT erscheinen darf: alte Vorlagen (archiviert), ein gelöschter eigener Leitfaden, eine E-Mail-Vorlage des Composers. */
const FREMD: Template[] = [
  vorlage('alt_eroeffnung', { id: id(3), name: 'Alte Eröffnung', archiviert_at: ARCHIV }),
  vorlage('alt_skript', {
    id: id(4),
    channel: 'telefon',
    phase: 'einstieg',
    name: 'Altes Skript',
    archiviert_at: ARCHIV,
  }),
  vorlage('sales_ablauf', {
    id: id(5),
    channel: 'sonstiges',
    phase: 'erstgespraech',
    name: 'Gelöschter Leitfaden',
    archiviert_at: ARCHIV,
  }),
  vorlage('mail_info', { id: id(6), channel: 'email', phase: 'infomail', name: 'Infomail', archiviert_at: null }),
]

const setze = (zeilen: Template[]) => {
  antworten.templates = { data: zeilen, error: null }
}
const ketten = () =>
  vi.mocked(supabase.from).mock.results.map((r) => r.value as Record<string, ReturnType<typeof vi.fn> | undefined>)
const aufrufe = (methode: 'upsert' | 'delete') =>
  ketten().flatMap((k) => (k[methode] && vi.isMockFunction(k[methode]) ? k[methode].mock.calls.map((c) => c[0]) : []))
const titelDerKarten = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

describe('Leitfäden', () => {
  beforeEach(() => {
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    setze([ABLAUF, EINWAND, ...FREMD])
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('zeigt nur nicht archivierte Leitfäden des Kanals sonstiges – keine alten, keine gelöschten, keine E-Mail-Vorlagen', async () => {
    rendern(<Leitfaeden />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })
    // zuletzt geschriebener oben
    expect(titelDerKarten()).toEqual(['Einwand Preis', 'Ablauf Erstgespräch'])
    for (const fremd of ['Alte Eröffnung', 'Altes Skript', 'Gelöschter Leitfaden', 'Infomail'])
      expect(screen.queryByText(fremd)).not.toBeInTheDocument()
    // Auszug: Zeilen zusammengezogen
    expect(screen.getByText('Guten Tag [Anrede] [Nachname], danke für Ihre Zeit.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Leitfaden schreiben' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Text kopieren' })).toHaveLength(2)
  })

  it('Leerzustand: ein Satz und derselbe Knopf – genau einmal', async () => {
    setze(FREMD)
    rendern(<Leitfaeden />)
    expect(await screen.findByText('Du hast noch keinen Leitfaden geschrieben.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Leitfaden schreiben' })).toHaveLength(1)
  })

  it('Anlegen: Titel, Text, Chip an der Cursor-Position; Kanal sonstiges, feste Phase, eindeutiger Schlüssel, created_by', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Leitfaden schreiben' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
    // genau die fünf Chips aus dem Bauplan
    expect(
      within(within(fenster).getByRole('group', { name: 'Platzhalter einfügen' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Anrede', 'Vorname', 'Nachname', 'Unternehmen', 'Absender Vorname'])
    expect(within(fenster).queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument()

    fireEvent.change(within(fenster).getByLabelText('Titel'), { target: { value: ' Ablauf ' } })
    const text = within(fenster).getByLabelText('Text') as HTMLTextAreaElement
    fireEvent.change(text, { target: { value: 'Hallo , hier ist ' } })
    text.focus()
    text.setSelectionRange(6, 6)
    fireEvent.click(within(fenster).getByRole('button', { name: 'Vorname' }))
    expect(text).toHaveValue('Hallo [Vorname], hier ist ')
    expect(document.activeElement).toBe(text)
    text.setSelectionRange(text.value.length, text.value.length)
    fireEvent.click(within(fenster).getByRole('button', { name: 'Absender Vorname' }))
    expect(text).toHaveValue('Hallo [Vorname], hier ist [Absender Vorname]')

    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    const zeile = aufrufe('upsert')[0] as Record<string, unknown>
    expect(zeile).toMatchObject({
      // „sales_ablauf“ gehört dem gelöschten (archivierten) Leitfaden – auch der zählt
      key: 'sales_ablauf_2',
      channel: 'sonstiges',
      phase: 'erstgespraech',
      name: 'Ablauf',
      body: 'Hallo [Vorname], hier ist [Absender Vorname]',
      created_by: MEMBER_V,
    })
    expect('id' in zeile).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast).toHaveBeenCalledWith('Leitfaden gespeichert.')
  })

  it('ohne Titel oder Text wird nichts gespeichert – das Feld sagt, was fehlt', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Leitfaden schreiben' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
    expect(within(fenster).getByRole('alert')).toHaveTextContent('Bitte einen Titel eingeben')
    fireEvent.change(within(fenster).getByLabelText('Titel'), { target: { value: 'Ablauf' } })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
    expect(within(fenster).getByRole('alert')).toHaveTextContent('Bitte einen Text eingeben')
    expect(aufrufe('upsert')).toHaveLength(0)
  })

  it('Bearbeiten: Klick auf die Karte öffnet den Editor; Speichern behält ID und Schlüssel', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf Erstgespräch' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    expect(within(fenster).getByLabelText('Titel')).toHaveValue('Ablauf Erstgespräch')
    expect(within(fenster).getByLabelText('Text')).toHaveValue(ABLAUF.body)
    fireEvent.change(within(fenster).getByLabelText('Titel'), { target: { value: 'Ablauf Erstgespräch neu' } })
    fireEvent.change(within(fenster).getByLabelText('Text'), { target: { value: 'Neuer Text' } })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    const zeile = aufrufe('upsert')[0] as Record<string, unknown>
    expect(zeile).toMatchObject({
      id: ABLAUF.id,
      key: ABLAUF.key,
      channel: 'sonstiges',
      phase: 'erstgespraech',
      name: 'Ablauf Erstgespräch neu',
      body: 'Neuer Text',
    })
    expect(zeile['archiviert_at']).toBeNull()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('↵ im Titel springt in den Text; ⌘↵ im Text speichert', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Leitfaden schreiben' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
    const titel = within(fenster).getByLabelText('Titel')
    const text = within(fenster).getByLabelText('Text')
    // neuer Leitfaden: der Cursor steht im Titel
    await waitFor(() => expect(document.activeElement).toBe(titel))
    fireEvent.change(titel, { target: { value: 'Nachfassen' } })
    fireEvent.keyDown(titel, { key: 'Enter' })
    expect(document.activeElement).toBe(text)
    fireEvent.change(text, { target: { value: 'Kurz nachgefragt.' } })
    fireEvent.keyDown(text, { key: 'Enter' })
    expect(aufrufe('upsert')).toHaveLength(0)
    fireEvent.keyDown(text, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    expect(aufrufe('upsert')[0]).toMatchObject({
      key: 'sales_nachfassen',
      name: 'Nachfassen',
      body: 'Kurz nachgefragt.',
    })
  })

  it('vorhandener Leitfaden öffnet zum Lesen: kein Cursor in einem Feld (auf dem Telefon klappt keine Tastatur auf)', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf Erstgespräch' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    await waitFor(() => expect(document.activeElement).toBe(fenster))
  })

  it('„Löschen“ fragt nach und archiviert nur (archiviert_at) – es wird nichts gelöscht', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Einwand Preis' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }))
    const frage = await screen.findByRole('dialog', { name: 'Leitfaden löschen?' })
    expect(frage).toHaveTextContent('„Einwand Preis“ verschwindet aus deiner Liste.')
    expect(aufrufe('upsert')).toHaveLength(0)
    fireEvent.click(within(frage).getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    const zeile = aufrufe('upsert')[0] as Record<string, unknown>
    expect(zeile).toMatchObject({ id: EINWAND.id, key: EINWAND.key, name: 'Einwand Preis', body: EINWAND.body })
    expect(Number.isNaN(Date.parse(String(zeile['archiviert_at'])))).toBe(false)
    expect(aufrufe('delete')).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast).toHaveBeenCalledWith('Leitfaden gelöscht.')
  })

  it('Rückfrage „Löschen“ abbrechen: nichts passiert, der Editor bleibt offen', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Einwand Preis' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }))
    const frage = await screen.findByRole('dialog', { name: 'Leitfaden löschen?' })
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Leitfaden löschen?' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Leitfaden bearbeiten' })).toBeInTheDocument()
    expect(aufrufe('upsert')).toHaveLength(0)
  })

  it('„Text kopieren“ legt den Text mit Platzhaltern in die Zwischenablage und öffnet den Editor nicht', async () => {
    const schreiben = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    rendern(<Leitfaeden />)
    await screen.findByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })
    const karte = screen
      .getByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })
      .closest('article') as HTMLElement
    fireEvent.click(within(karte).getByRole('button', { name: 'Text kopieren' }))
    await waitFor(() => expect(schreiben).toHaveBeenCalledWith(ABLAUF.body))
    expect(await within(karte).findByRole('button', { name: 'Kopiert' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    schreiben.mockRestore()
  })

  it('„Abbrechen“ mit Änderungen fragt nach; ohne Änderungen schließt das Fenster sofort', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf Erstgespräch' }))
    let fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Ablauf Erstgespräch' }))
    fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    const text = within(fenster).getByLabelText('Text')
    text.focus()
    fireEvent.change(text, { target: { value: 'Angefangen' } })
    // Esc geht denselben Weg wie „Abbrechen“
    fireEvent.keyDown(text, { key: 'Escape' })
    let frage = await screen.findByRole('dialog', { name: 'Änderungen verwerfen?' })
    fireEvent.click(within(frage).getByRole('button', { name: 'Weiter schreiben' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Änderungen verwerfen?' })).not.toBeInTheDocument())
    expect(text).toHaveValue('Angefangen')
    // der Fokus fällt nicht auf <body>, sondern zurück in den Text
    await waitFor(() => expect(document.activeElement).toBe(text))

    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }))
    frage = await screen.findByRole('dialog', { name: 'Änderungen verwerfen?' })
    fireEvent.click(within(frage).getByRole('button', { name: 'Verwerfen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(aufrufe('upsert')).toHaveLength(0)
  })

  it('Fehler beim Laden: ein Satz und „Erneut versuchen“ – kein falscher Leerzustand, kein „Leitfaden schreiben“', async () => {
    antworten.templates = { data: null, error: { message: 'kaputt' } }
    rendern(<Leitfaeden />)
    expect(await screen.findByText('Die Leitfäden konnten nicht geladen werden.')).toBeInTheDocument()
    expect(screen.queryByText('Du hast noch keinen Leitfaden geschrieben.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leitfaden schreiben' })).not.toBeInTheDocument()
    setze([ABLAUF])
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })).toBeInTheDocument()
  })
})
