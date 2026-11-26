// Leitfäden (Neustart 25.11.2026): Liste zeigt alles nicht Archivierte außer E-Mail-Vorlagen (auch Leitfäden aus dem alten CRM
// im Kanal linkedin), neueste Änderung oben; Anlegen, Bearbeiten (Kanal/Phase/Schlüssel bleiben), „Löschen“ = archivieren
// (kein delete), Text kopieren, Platzhalter-Chips im Editor, Rückfrage vor dem Verwerfen.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  updated_at: '2026-11-25T09:00:00+00:00',
  archiviert_at: null,
})
const EINWAND = vorlage('sales_einwand_preis', {
  id: id(2),
  channel: 'sonstiges',
  phase: 'erstgespraech',
  name: 'Einwand Preis',
  body: 'Verstehe ich. Was wäre es Ihnen wert?',
  created_at: '2026-11-25T10:00:00+00:00',
  updated_at: '2026-11-25T10:00:00+00:00',
  archiviert_at: null,
})
/** Heute noch im alten CRM geschrieben: Kanal linkedin, eigene Phase, freier Platzhalter [Position] – muss erscheinen. */
const STELLE = vorlage('test_stelle_ausgeschrieben', {
  id: id(7),
  channel: 'linkedin',
  phase: 'eroeffnung',
  name: 'Stelle ausgeschrieben',
  body: 'Guten Tag [Anrede] [Nachname], ich habe gesehen, dass Sie eine [Position] suchen.',
  // früher angelegt, aber zuletzt geändert: steht oben
  created_at: '2026-11-25T08:30:00+00:00',
  updated_at: '2026-11-25T11:00:00+00:00',
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
    setze([ABLAUF, EINWAND, STELLE, ...FREMD])
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('zeigt alle nicht archivierten Leitfäden, auch die aus dem alten CRM (Kanal linkedin) – keine archivierten, keine E-Mail-Vorlagen', async () => {
    rendern(<Leitfaeden />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leitfäden' })).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })
    // neueste Änderung oben (updated_at) – nicht das Anlegedatum
    expect(titelDerKarten()).toEqual(['Stelle ausgeschrieben', 'Einwand Preis', 'Ablauf Erstgespräch'])
    for (const fremd of ['Alte Eröffnung', 'Altes Skript', 'Gelöschter Leitfaden', 'Infomail'])
      expect(screen.queryByText(fremd)).not.toBeInTheDocument()
    // Auszug: Zeilen zusammengezogen
    expect(screen.getByText('Guten Tag [Anrede] [Nachname], danke für Ihre Zeit.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Leitfaden schreiben' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Text kopieren' })).toHaveLength(3)
  })

  it('ein gerade geänderter Leitfaden rückt nach oben', async () => {
    setze([
      ABLAUF,
      { ...EINWAND, updated_at: '2026-11-25T08:00:00+00:00' },
      { ...STELLE, updated_at: ABLAUF.updated_at },
    ])
    rendern(<Leitfaeden />)
    await screen.findByRole('heading', { level: 2, name: 'Ablauf Erstgespräch' })
    // gleicher Zeitpunkt: nach Titel
    expect(titelDerKarten()).toEqual(['Ablauf Erstgespräch', 'Stelle ausgeschrieben', 'Einwand Preis'])
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
    // die fünf Chips aus dem Bauplan und „Position“ (freier Platzhalter, den Mike benutzt)
    expect(
      within(within(fenster).getByRole('group', { name: 'Platzhalter einfügen' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Anrede', 'Vorname', 'Nachname', 'Unternehmen', 'Position', 'Absender Vorname'])
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

  it('Bearbeiten eines Leitfadens aus dem alten CRM lässt Kanal, Phase und Schlüssel, wie sie sind; der Chip „Position“ fügt ein', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stelle ausgeschrieben' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    const text = within(fenster).getByLabelText('Text') as HTMLTextAreaElement
    expect(text).toHaveValue(STELLE.body)
    text.focus()
    text.setSelectionRange(text.value.length, text.value.length)
    fireEvent.click(within(fenster).getByRole('button', { name: 'Position' }))
    expect(text).toHaveValue(`${STELLE.body}[Position]`)
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    expect(aufrufe('upsert')[0]).toMatchObject({
      id: STELLE.id,
      key: 'test_stelle_ausgeschrieben',
      channel: 'linkedin',
      phase: 'eroeffnung',
      name: 'Stelle ausgeschrieben',
      body: `${STELLE.body}[Position]`,
    })
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

  // Fund 36: nach dem Schließen fiel der Fokus auf <body>
  it('nach dem Schließen liegt der Fokus wieder auf dem Knopf bzw. der Karte, von der aus geöffnet wurde', async () => {
    rendern(<Leitfaeden />)
    const schreiben = await screen.findByRole('button', { name: 'Leitfaden schreiben' })
    schreiben.focus()
    fireEvent.click(schreiben)
    let fenster = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
    // neuer Leitfaden: der Cursor steht im Titel
    await waitFor(() => expect(within(fenster).getByLabelText('Titel')).toHaveFocus())
    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(schreiben).toHaveFocus())

    const karte = screen.getByRole('button', { name: 'Ablauf Erstgespräch' })
    karte.focus()
    fireEvent.click(karte)
    fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    await waitFor(() => expect(document.activeElement).toBe(fenster))
    fireEvent.keyDown(fenster, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(karte).toHaveFocus())
  })

  // Abnahme 26.11.2026: die Liste lädt erst NACH dem Schließen neu. Der Auslöser, zu dem der Fokus zurückgekehrt war,
  // verschwand dabei (Knopf wandert vom Leerzustand in den Kopf, Karte gelöscht) – der Fokus fiel auf <body>.
  describe('Fokus nach dem Anlegen und nach dem Löschen: „Leitfaden schreiben“', () => {
    const NACHFASSEN = vorlage('sales_nachfassen', {
      id: id(8),
      channel: 'sonstiges',
      phase: 'erstgespraech',
      name: 'Nachfassen',
      body: 'Kurz nachgefragt.',
      created_at: '2026-11-26T09:00:00+00:00',
      updated_at: '2026-11-26T09:00:00+00:00',
      archiviert_at: null,
    })
    // wie in der Hülle: <main> ist das Ersatzziel von useFokusZurueck – dort darf der Fokus hier nicht landen
    const seite = () =>
      rendern(
        <main id="main" tabIndex={-1}>
          <Leitfaeden />
        </main>,
      )
    const schreibenKnopf = () => screen.getByRole('button', { name: 'Leitfaden schreiben' })
    const schreibeNeuen = async () => {
      const knopf = await screen.findByRole('button', { name: 'Leitfaden schreiben' })
      knopf.focus()
      fireEvent.click(knopf)
      const fenster = await screen.findByRole('dialog', { name: 'Leitfaden schreiben' })
      fireEvent.change(within(fenster).getByLabelText('Titel'), { target: { value: 'Nachfassen' } })
      fireEvent.change(within(fenster).getByLabelText('Text'), { target: { value: 'Kurz nachgefragt.' } })
      return { knopf, speichern: within(fenster).getByRole('button', { name: 'Speichern' }) }
    }
    const loesche = async (name: string) => {
      const karte = await screen.findByRole('button', { name })
      karte.focus()
      fireEvent.click(karte)
      const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
      fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }))
      return within(await screen.findByRole('dialog', { name: 'Leitfaden löschen?' })).getByRole('button', {
        name: 'Löschen',
      })
    }
    const fensterZu = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    it('erster Leitfaden gespeichert: der Knopf wandert beim Neuladen vom Leerzustand in den Kopf – der Fokus wandert mit', async () => {
      setze(FREMD)
      const { qc } = seite()
      const { knopf: imLeerzustand, speichern } = await schreibeNeuen()
      fireEvent.click(speichern)
      await fensterZu()
      // Fenster zu, die Liste ist noch die alte
      await waitFor(() => expect(imLeerzustand).toHaveFocus())
      setze([...FREMD, NACHFASSEN])
      await act(() => qc.invalidateQueries())
      await screen.findByRole('heading', { level: 2, name: 'Nachfassen' })
      expect(imLeerzustand).not.toBeInTheDocument()
      expect(schreibenKnopf().closest('header')).not.toBeNull()
      expect(schreibenKnopf()).toHaveFocus()
    })

    it('erster Leitfaden gespeichert, die neue Liste ist beim Schließen schon da: Fokus auf „Leitfaden schreiben“ im Kopf, nicht auf <main>', async () => {
      setze(FREMD)
      seite()
      const { speichern } = await schreibeNeuen()
      setze([...FREMD, NACHFASSEN])
      fireEvent.click(speichern)
      await fensterZu()
      await screen.findByRole('heading', { level: 2, name: 'Nachfassen' })
      await waitFor(() => expect(schreibenKnopf()).toHaveFocus())
      expect(schreibenKnopf().closest('header')).not.toBeNull()
    })

    it('zweiter Leitfaden gespeichert: der Fokus bleibt auf „Leitfaden schreiben“ im Kopf', async () => {
      setze([ABLAUF, ...FREMD])
      seite()
      const { knopf: imKopf, speichern } = await schreibeNeuen()
      setze([ABLAUF, NACHFASSEN, ...FREMD])
      fireEvent.click(speichern)
      await fensterZu()
      await screen.findByRole('heading', { level: 2, name: 'Nachfassen' })
      await waitFor(() => expect(imKopf).toHaveFocus())
    })

    it('gelöscht (mit Rückfrage): die Karte verschwindet – der Fokus liegt auf „Leitfaden schreiben“ im Kopf', async () => {
      const { qc } = seite()
      fireEvent.click(await loesche('Einwand Preis'))
      await fensterZu()
      // nicht erst auf die Karte, die gleich verschwindet
      await waitFor(() => expect(schreibenKnopf()).toHaveFocus())
      setze([ABLAUF, { ...EINWAND, archiviert_at: ARCHIV }, STELLE, ...FREMD])
      await act(() => qc.invalidateQueries())
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Einwand Preis' })).not.toBeInTheDocument())
      expect(schreibenKnopf()).toHaveFocus()
    })

    it('letzten Leitfaden gelöscht: die Seite ist wieder leer – der Fokus liegt auf „Leitfaden schreiben“ im Leerzustand', async () => {
      setze([EINWAND, ...FREMD])
      const { qc } = seite()
      fireEvent.click(await loesche('Einwand Preis'))
      await fensterZu()
      await waitFor(() => expect(schreibenKnopf()).toHaveFocus())
      const imKopf = schreibenKnopf()
      setze([{ ...EINWAND, archiviert_at: ARCHIV }, ...FREMD])
      await act(() => qc.invalidateQueries())
      expect(await screen.findByText('Du hast noch keinen Leitfaden geschrieben.')).toBeInTheDocument()
      expect(imKopf).not.toBeInTheDocument()
      expect(schreibenKnopf().closest('header')).toBeNull()
      expect(schreibenKnopf()).toHaveFocus()
    })

    it('der Fokus zieht nur einmal mit: löscht später die andere Person den letzten Leitfaden, springt er nicht auf den Knopf', async () => {
      setze(FREMD)
      const { qc } = seite()
      const { speichern } = await schreibeNeuen()
      fireEvent.click(speichern)
      await fensterZu()
      setze([...FREMD, NACHFASSEN])
      await act(() => qc.invalidateQueries())
      await screen.findByRole('heading', { level: 2, name: 'Nachfassen' })
      await waitFor(() => expect(schreibenKnopf()).toHaveFocus())
      // Klick auf eine leere Stelle: nichts hat mehr den Fokus
      act(() => schreibenKnopf().blur())
      expect(document.body).toHaveFocus()
      setze([...FREMD, { ...NACHFASSEN, archiviert_at: ARCHIV }])
      await act(() => qc.invalidateQueries())
      expect(await screen.findByText('Du hast noch keinen Leitfaden geschrieben.')).toBeInTheDocument()
      expect(document.body).toHaveFocus()
    })

    it('vorhandenen Leitfaden gespeichert: der Fokus geht wie bisher zur Karte zurück, nicht zum Knopf', async () => {
      seite()
      const karte = await screen.findByRole('button', { name: 'Einwand Preis' })
      karte.focus()
      fireEvent.click(karte)
      const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
      fireEvent.change(within(fenster).getByLabelText('Text'), { target: { value: 'Besserer Text' } })
      fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }))
      await fensterZu()
      await waitFor(() => expect(karte).toHaveFocus())
    })
  })

  it('„Löschen“ fragt nach und archiviert nur (archiviert_at) – es wird nichts gelöscht', async () => {
    rendern(<Leitfaeden />)
    fireEvent.click(await screen.findByRole('button', { name: 'Einwand Preis' }))
    const fenster = await screen.findByRole('dialog', { name: 'Leitfaden bearbeiten' })
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }))
    const frage = await screen.findByRole('dialog', { name: 'Leitfaden löschen?' })
    expect(frage).toHaveTextContent('„Einwand Preis“ verschwindet aus deiner Liste.')
    // Knöpfe der Rückfrage 44 px
    for (const knopf of within(frage).getAllByRole('button')) expect(knopf).toHaveClass('h-11')
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
    // „Abbrechen“ ohne Rahmen wie im Lead-Blatt und in den Dialogen
    expect(within(fenster).getByRole('button', { name: 'Abbrechen' })).toHaveClass('border-transparent', 'h-11')
    // Platzhalter-Leiste bricht um (auch am Telefon): kein Knopf liegt unsichtbar außerhalb
    const chips = within(fenster).getByRole('group', { name: 'Platzhalter einfügen' })
    expect(chips).toHaveClass('flex-wrap')
    expect(chips.className).not.toMatch(/nowrap|overflow-x/)
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
    for (const knopf of within(frage).getAllByRole('button')) expect(knopf).toHaveClass('h-11')
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
