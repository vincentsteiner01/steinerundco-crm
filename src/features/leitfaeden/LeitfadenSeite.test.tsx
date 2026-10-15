// LeitfadenSeite + LeitfadenDetail: Vollseite mit Kopf, Entwurf (localStorage), Speichern ⌘↵ (Upsert), neue Vorlage
// (Key li_<slug>, Navigation zur neuen ID), Duplizieren (variant_of, „(Kopie)“), Deaktivieren, Löschen nur wenn ungenutzt (LF-07),
// „Als Standard für Schritt …“ → /einstellungen/sequenzen?id=, nicht gefunden, mobil nur lesen.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
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

import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { MEMBER_V } from '@/test/fixtures/leads'
import { kette } from '@/test/supabaseMock'
import { ALLE, BEDARF, ERSTE_ID, JA_V1_ID, PITCH_A_ID, rendern, setzeDesktop } from './_testHilfe'
import { ENTWURF_PRAEFIX } from './entwurf'
import { Component as LeitfadenSeite } from './LeitfadenSeite'

type Aufruf = { tabelle: string; methode: string; arg: unknown }
/** Alle `tabelle.methode(arg)`-Aufrufe des Mocks (für upsert/delete-Prüfungen). */
function aufrufe(methode: string): Aufruf[] {
  const f = supabase.from as unknown as {
    mock: { calls: unknown[][]; results: { value: Record<string, { mock: { calls: unknown[][] } }> }[] }
  }
  const out: Aufruf[] = []
  f.mock.calls.forEach((c, i) => {
    const k = f.mock.results[i]?.value
    const m = k?.[methode]
    for (const call of m?.mock.calls ?? []) out.push({ tabelle: c[0] as string, methode, arg: call[0] })
  })
  return out
}

/** Upsert/Delete antworten mit der übergebenen Zeile (+ id), alles andere wie supabaseAntworten. */
function mitSchreibAntwort() {
  const basis = vi.mocked(supabase.from).getMockImplementation() as (t: string) => ReturnType<typeof kette>
  vi.mocked(supabase.from).mockImplementation(((tabelle: string) => {
    const k = basis(tabelle)
    if (tabelle === 'templates') {
      const upsert = k['upsert'] as ReturnType<typeof vi.fn>
      upsert.mockImplementation((zeile: Record<string, unknown>) => {
        const antwort = { data: { ...ALLE[0], ...zeile, id: (zeile['id'] as string) ?? 'neu-id-1' }, error: null }
        const k2 = kette(antwort)
        return k2
      })
    }
    return k
  }) as never)
}

describe('LeitfadenSeite', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    _akkordZuruecksetzen()
    localStorage.clear()
    setzeDesktop(true)
    vi.mocked(supabase.from).mockClear()
    vi.mocked(toast).mockClear()
  })

  it('zeigt Kopf (Name, Kanal · Phase), Felder, Editor, Vorschau, Statistik; Speichern ist ohne Änderung gesperrt', async () => {
    rendern(<LeitfadenSeite />, `/leitfaeden/${JA_V1_ID}`)
    await screen.findByRole('heading', { level: 1, name: 'Ja (V1)' })
    // Runde 2: der Name steht nur einmal groß (H1) – im Detail als normales Feld „Name“, nicht als zweite Überschrift
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Ja (V1)')
    expect(name).toHaveClass('text-ui')
    expect(name).not.toHaveClass('text-h2')
    expect(screen.getByText(/LinkedIn · 2 Bedarfsermittlung/)).toBeInTheDocument()
    expect(screen.getByLabelText('Phase')).toHaveValue('bedarfsermittlung')
    expect(screen.getByLabelText('Anredeform')).toHaveValue('du')
    expect(screen.getByText('Standard für Schritt 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Speichern/ })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Vorschau mit …' })).toBeInTheDocument()
    await screen.findByText('gesendet')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Antworten 7 T')).toBeInTheDocument()
    expect(screen.getByText(/^25\s%$/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Sendungen je Woche/ })).toBeInTheDocument()
    // LF-07: verwendete Vorlage → Löschen gesperrt
    expect(screen.getByRole('button', { name: /Löschen/ })).toBeDisabled()
    expect(screen.getByLabelText('Verwendet – stattdessen deaktivieren')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Alle Leitfäden' }))
  })

  it('Text ändern → Entwurf in localStorage, ⌘↵ speichert per Upsert mit der ganzen Zeile, Entwurf wird gelöscht', async () => {
    mitSchreibAntwort()
    rendern(<LeitfadenSeite />, `/leitfaeden/${JA_V1_ID}`)
    const text = await screen.findByLabelText('Text')
    fireEvent.change(text, { target: { value: 'Neuer Text [Nachname]' } })
    expect(screen.getByText('Entwurf – noch nicht gespeichert.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ENTWURF_PRAEFIX + JA_V1_ID) ?? '{}')).toMatchObject({
      body: 'Neuer Text [Nachname]',
    })
    fireEvent.keyDown(text, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    const zeile = aufrufe('upsert')[0]?.arg as Record<string, unknown>
    expect(zeile).toMatchObject({
      id: JA_V1_ID,
      key: VORLAGE.li_bedarf_ja_v1,
      body: 'Neuer Text [Nachname]',
      name: 'Ja (V1)',
    })
    expect(typeof zeile['updated_at']).toBe('string')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gespeichert.'))
    expect(localStorage.getItem(ENTWURF_PRAEFIX + JA_V1_ID)).toBeNull()
  })

  it('Entwurf aus localStorage wird beim Öffnen übernommen; „Verwerfen“ stellt die Vorlage her', async () => {
    localStorage.setItem(
      ENTWURF_PRAEFIX + JA_V1_ID,
      JSON.stringify({
        name: 'Ja (V1)',
        phase: 'bedarfsermittlung',
        when_to_use: '',
        form_of_address: 'du',
        notes: '',
        subject: '',
        body: 'Entwurf',
      }),
    )
    rendern(<LeitfadenSeite />, `/leitfaeden/${JA_V1_ID}`)
    const text = await screen.findByLabelText('Text')
    expect(text).toHaveValue('Entwurf')
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(screen.getByLabelText('Text')).toHaveValue(BEDARF[0]?.body)
    expect(localStorage.getItem(ENTWURF_PRAEFIX + JA_V1_ID)).toBeNull()
  })

  it('Neu: Kanal aus ?kanal=, Pflichtfelder, Key <präfix>_<slug>, danach Navigation zur neuen ID', async () => {
    mitSchreibAntwort()
    const { router } = rendern(<LeitfadenSeite />, '/leitfaeden/neu?kanal=telefon')
    await screen.findByRole('heading', { level: 1, name: 'Neuer Leitfaden' })
    expect(screen.getByLabelText('Kanal')).toHaveValue('telefon')
    expect(screen.getByLabelText('Phase')).toHaveValue('gatekeeper')
    fireEvent.click(screen.getByRole('button', { name: /Leitfaden anlegen/ }))
    expect(screen.getByText('Name fehlt.')).toBeInTheDocument()
    expect(screen.getByText('Text fehlt.')).toBeInTheDocument()
    expect(aufrufe('upsert')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Zentrale kurz' } })
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Guten Tag, [Anrufer] hier.' } })
    fireEvent.click(screen.getByRole('button', { name: /Leitfaden anlegen/ }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    expect(aufrufe('upsert')[0]?.arg).toMatchObject({
      key: 'tel_zentrale_kurz',
      channel: 'telefon',
      phase: 'gatekeeper',
      name: 'Zentrale kurz',
      active: true,
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/leitfaeden/neu-id-1'))
  })

  it('Duplizieren legt „… (Kopie)“ mit variant_of an und öffnet die Kopie; Deaktivieren schreibt active=false', async () => {
    mitSchreibAntwort()
    const { router } = rendern(<LeitfadenSeite />, `/leitfaeden/${PITCH_A_ID}`)
    await screen.findByRole('heading', { level: 1, name: 'Pitch A' })
    fireEvent.click(screen.getByRole('button', { name: /Duplizieren/ }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    const kopie = aufrufe('upsert')[0]?.arg as Record<string, unknown>
    expect(kopie).toMatchObject({
      key: `${VORLAGE.li_pitch_a}_kopie`,
      name: 'Pitch A (Kopie)',
      variant_of: PITCH_A_ID,
      active: true,
    })
    expect('id' in kopie).toBe(false)
    await waitFor(() => expect(router.state.location.pathname).toBe('/leitfaeden/neu-id-1'))
    expect(toast).toHaveBeenCalledWith('Kopie angelegt – ‚Pitch A (Kopie)‘.')
  })

  it('Deaktivieren (LF-07): active=false, Toast nennt Historie und Auswahlmenüs', async () => {
    mitSchreibAntwort()
    rendern(<LeitfadenSeite />, `/leitfaeden/${PITCH_A_ID}`)
    await screen.findByRole('heading', { level: 1, name: 'Pitch A' })
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }))
    await waitFor(() => expect(aufrufe('upsert')).toHaveLength(1))
    expect(aufrufe('upsert')[0]?.arg).toMatchObject({ id: PITCH_A_ID, active: false })
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Deaktiviert – bleibt in der Historie, verschwindet aus den Auswahlmenüs.'),
    )
  })

  it('Löschen nur ungenutzt: Dialog → delete → Toast → zurück zur Übersicht; Standard-Menü führt zum Sequenz-Editor', async () => {
    const ungenutzt = ALLE[2]?.id ?? '' // Gesprächseröffnung (V3): keine Nutzung, kein Schritt
    const { router } = rendern(<LeitfadenSeite />, `/leitfaeden/${ungenutzt}`)
    await screen.findByRole('heading', { level: 1, name: 'Gesprächseröffnung (V3)' })
    const loeschen = screen.getByRole('button', { name: /Löschen/ })
    expect(loeschen).toBeEnabled()
    fireEvent.click(loeschen)
    const dialog = await screen.findByRole('dialog', { name: 'Leitfaden löschen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(aufrufe('delete')).toHaveLength(1))
    expect(aufrufe('delete')[0]?.tabelle).toBe('templates')
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Gelöscht.'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/leitfaeden'))
  })

  it('„Als Standard für Schritt …“ öffnet /einstellungen/sequenzen?id=<Sequenz>', async () => {
    const { router } = rendern(<LeitfadenSeite />, `/leitfaeden/${ERSTE_ID}`)
    await screen.findByRole('heading', { level: 1, name: 'Gesprächseröffnung (V1)' })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Als Standard für Schritt …' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    })
    const eintrag = await screen.findByRole('menuitem', { name: 'A' })
    fireEvent.click(eintrag)
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/sequenzen'))
    expect(router.state.location.search).toMatch(/^\?id=3000/)
  })

  it('nicht gefunden → Leerzustand mit Rücksprung', async () => {
    rendern(<LeitfadenSeite />, '/leitfaeden/00000000-0000-4000-8000-00000000dead')
    await screen.findByText('Leitfaden nicht gefunden.')
    expect(screen.getByRole('button', { name: 'Zu den Leitfäden' })).toBeInTheDocument()
  })

  it('Mobil: nur lesen – kein Editor, Hinweis „Am Desktop bearbeiten.“, Kopieren vorhanden', async () => {
    setzeDesktop(false)
    rendern(<LeitfadenSeite />, `/leitfaeden/${JA_V1_ID}`)
    await screen.findByRole('heading', { level: 2, name: 'Ja (V1)' })
    expect(screen.queryByLabelText('Text')).not.toBeInTheDocument()
    expect(screen.getByText('Am Desktop bearbeiten.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kopieren/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Duplizieren/ })).not.toBeInTheDocument()
  })
})
