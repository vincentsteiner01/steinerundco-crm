// EmailSeite.test.tsx: Hinweiszeile, Tabs über ?tab=, Leerzustände, Fällig (QueueKarten Kanal E-Mail + manuelle Aufgaben, Enter → Composer),
// Entwürfe („Gesendet?“ → sent_confirmed + complete_step, „Verworfen“ → failed), Gesendet („Beantwortet“, „Bounce“, Widerspruch-Trigger).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router'
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
vi.mock('@/features/heute/public', () => ({
  QueueKarte: (p: {
    item: { lead_name: string | null; title: string | null }
    aktiv: boolean
    onAktion: (a: string) => void
  }) => (
    <div data-testid="queue-karte" data-aktiv={p.aktiv || undefined}>
      {p.item.lead_name} · {p.item.title}
      <button type="button" onClick={() => p.onAktion('oeffnen')}>
        Öffnen
      </button>
      <button type="button" onClick={() => p.onAktion('notiz')}>
        Notiz
      </button>
    </div>
  ),
}))

import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_V } from '@/test/fixtures/leads'
import { queueItem } from '@/test/fixtures/queue'
import {
  ANTWORTEN,
  email,
  ENROLLMENT_ID,
  LEAD_ID,
  leadMitErlaubnis,
  letzterEmailZugriff,
  rendern,
  taste,
  VORLAGE_INFO,
  zuruecksetzen,
} from './_testHilfe'
import { Component as EmailSeite } from './EmailSeite'
import { faelligeEmailSchritte, manuelleEmailAufgaben } from './faellig'

function Ort() {
  const l = useLocation()
  return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>
}

const seite = (pfad = '/email') =>
  rendern(
    <>
      <EmailSeite />
      <Ort />
    </>,
    pfad,
  )

describe('EmailSeite', () => {
  beforeEach(() => {
    zuruecksetzen()
    sessionStorage.clear()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 1, error: null } as never)
    vi.mocked(toast).mockClear()
  })

  it('Hinweiszeile mit Postfach, Tabs mit Zählern, Leerzustand Fällig', async () => {
    seite()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('E-Mail')
    await screen.findByText(
      'Versand läuft über dein Gmail-Postfach (vincent@steinerundco.de). Antworten kommen dort an.',
    )
    const tabs = screen.getByRole('tablist', { name: 'E-Mail' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent?.replace(/\d+$/, '')),
    ).toEqual(['Fällig', 'Entwürfe', 'Gesendet'])
    expect(within(tabs).getByRole('tab', { name: /Fällig/ })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Keine E-Mail fällig.')).toBeInTheDocument()
    expect(screen.getByText('E-Mails gehen nur an Personen, die darum gebeten haben.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden (heute)' }))
    expect(screen.queryByRole('note')).toBeNull()
    expect(sessionStorage.getItem('crm.email.hinweis')).toBe('aus')
  })

  it('?tab=entwuerfe wählt den Tab; Klick schreibt ?tab= in die URL', async () => {
    seite('/email?tab=entwuerfe')
    expect(screen.getByRole('tab', { name: /Entwürfe/ })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Keine Entwürfe.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Gesendet/ }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/email?tab=gesendet')
    expect(await screen.findByText('Noch nichts gesendet.')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'Gesendet' })).toBeInTheDocument()
  })

  it('Fällig: nur E-Mail-Schritte der Sektionen überfällig/heute; Enter/Öffnen → Composer mit Schritt, Notiz → Peek', async () => {
    ANTWORTEN.queue = [
      queueItem('heute', 1, {
        item_id: 'q1',
        channel: 'email',
        title: 'E1 Nachfassen',
        lead_id: LEAD_ID,
        template_id: VORLAGE_INFO.id,
        enrollment_id: ENROLLMENT_ID,
        step_id: 'st1',
      }),
      queueItem('ueberfaellig', 2, { item_id: 'q2', channel: 'email', title: 'I0 Infomail' }),
      queueItem('heute', 3, { item_id: 'q3', channel: 'linkedin' }),
      queueItem('kommend', 4, { item_id: 'q4', channel: 'email' }),
    ]
    seite()
    const karten = await screen.findAllByTestId('queue-karte')
    expect(karten).toHaveLength(2)
    expect(karten[0]).toHaveAttribute('data-aktiv', 'true')
    expect(screen.getByRole('tab', { name: /Fällig/ })).toHaveTextContent('2')
    taste('j')
    await waitFor(() => expect(screen.getAllByTestId('queue-karte')[1]).toHaveAttribute('data-aktiv', 'true'))
    taste('k')
    await waitFor(() => expect(screen.getAllByTestId('queue-karte')[0]).toHaveAttribute('data-aktiv', 'true'))
    fireEvent.click(within(karten[0] as HTMLElement).getByRole('button', { name: 'Notiz' }))
    expect(screen.getByTestId('ort')).toHaveTextContent(`/email?lead=${LEAD_ID}`)
    taste('Enter')
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?'))
    const url = new URL(`http://x${screen.getByTestId('ort').textContent}`)
    expect(url.searchParams.get('lead')).toBe(LEAD_ID)
    expect(url.searchParams.get('vorlage')).toBe(VORLAGE_INFO.id)
    expect(url.searchParams.get('enrollment')).toBe(ENROLLMENT_ID)
    expect(url.searchParams.get('schritt')).toBe('st1')
    expect(url.searchParams.get('zurueck')).toMatch(/^\//)
  })

  it('Fällig: manuelle E-Mail-Aufgaben (Vorlage Kanal E-Mail oder „Kurzinfo…“) mit Verfassen/Erledigt', async () => {
    ANTWORTEN.tasks = [
      {
        id: 't1',
        lead_id: LEAD_ID,
        kind: 'aufgabe',
        status: 'offen',
        title: 'Kurzinfo senden',
        template_id: null,
        due_at: '2026-10-14T09:00:00+02:00',
      },
      {
        id: 't2',
        lead_id: LEAD_ID,
        kind: 'aufgabe',
        status: 'offen',
        title: 'Infos',
        template_id: VORLAGE_INFO.id,
        due_at: null,
      },
      {
        id: 't3',
        lead_id: LEAD_ID,
        kind: 'rueckruf',
        status: 'offen',
        title: 'Rückruf',
        template_id: null,
        due_at: null,
      },
      {
        id: 't4',
        lead_id: LEAD_ID,
        kind: 'aufgabe',
        status: 'offen',
        title: 'Unterlagen',
        template_id: 'tmpl-li',
        due_at: null,
      },
    ]
    seite()
    const liste = await screen.findByRole('listbox', { name: 'Aufgaben' })
    const zeilen = within(liste).getAllByRole('option')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toHaveTextContent('Kurzinfo senden')
    await waitFor(() => expect(zeilen[0]).toHaveTextContent('Tobias Lindner'))
    fireEvent.click(within(zeilen[1] as HTMLElement).getByRole('button', { name: /Erledigt/ }))
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'complete_task',
        expect.objectContaining({ p_task_id: 't2' }),
        undefined,
      ),
    )
    fireEvent.click(within(zeilen[0] as HTMLElement).getByRole('button', { name: /Verfassen/ }))
    expect(screen.getByTestId('ort')).toHaveTextContent(`/email/verfassen?lead=${LEAD_ID}`)
  })

  it('Fällig: Ladefehler zeigt „erneut versuchen R“ statt „Keine E-Mail fällig.“ (ux § 4.3, Review)', async () => {
    ANTWORTEN.queueFehler = { code: '500', message: 'kaputt' }
    seite()
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Fällige E-Mails konnten nicht geladen werden – erneut versuchen.')
    expect(screen.queryByText('Keine E-Mail fällig.')).toBeNull()
  })

  it('Entwürfe: Zeilen mit Status; „Gesendet?“ → sent_confirmed + complete_step; „Verworfen“ → failed/verworfen', async () => {
    ANTWORTEN.emails = [
      email({ id: 'd1', status: 'draft', sent_at: null, subject: 'Entwurf eins', enrollment_id: ENROLLMENT_ID }),
      email({ id: 'd2', status: 'opened_in_client', sent_at: null, subject: 'Entwurf zwei' }),
    ]
    seite('/email?tab=entwuerfe')
    const liste = await screen.findByRole('listbox', { name: 'Entwürfe' })
    const zeilen = within(liste).getAllByRole('option')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toHaveTextContent('Entwurf')
    expect(zeilen[1]).toHaveTextContent('In Gmail geöffnet')
    expect(zeilen[0]).toHaveTextContent('tobias.lindner@beispiel.de')
    // „Gesendet?“ prüft erst das E-Mail-Gate des Leads (Review) – aktiv, sobald der Lead geladen ist
    await waitFor(() =>
      expect(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Gesendet?' })).toBeEnabled(),
    )
    fireEvent.click(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Gesendet?' }))
    await waitFor(() => expect(letzterEmailZugriff('update')).toMatchObject({ status: 'sent_confirmed' }))
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'complete_step',
        expect.objectContaining({ p_enrollment_id: ENROLLMENT_ID, p_outcome: 'gesendet' }),
        undefined,
      ),
    )
    expect(toast).toHaveBeenCalledWith('E-Mail gesendet – bestätigt.')
    fireEvent.click(within(zeilen[1] as HTMLElement).getByRole('button', { name: 'Verworfen' }))
    await waitFor(() =>
      expect(letzterEmailZugriff('update')).toMatchObject({ status: 'failed', bounce_reason: 'verworfen' }),
    )
    taste('Enter')
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?'))
    expect(screen.getByTestId('ort').textContent).toContain(`enrollment=${ENROLLMENT_ID}`)
  })

  it('Entwürfe: „Gesendet?“ ist ohne Erlaubnis-Grundlage gesperrt; Erlaubnis > 12 Monate verlangt erst „Trotzdem“', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none', email_consent_at: null })
    ANTWORTEN.emails = [email({ id: 'd1', status: 'draft', sent_at: null, subject: 'Entwurf eins' })]
    const { unmount } = seite('/email?tab=entwuerfe')
    const zeile = within(await screen.findByRole('listbox', { name: 'Entwürfe' })).getAllByRole(
      'option',
    )[0] as HTMLElement
    await waitFor(() => expect(screen.getByLabelText(/Keine Erlaubnis-Grundlage/)).toBeInTheDocument())
    expect(within(zeile).getByRole('button', { name: 'Gesendet?' })).toBeDisabled()
    unmount()

    zuruecksetzen()
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_at: '2025-01-10T09:00:00+01:00', last_inbound_at: null })
    ANTWORTEN.emails = [email({ id: 'd2', status: 'draft', sent_at: null, subject: 'Entwurf zwei' })]
    seite('/email?tab=entwuerfe')
    const z2 = within(await screen.findByRole('listbox', { name: 'Entwürfe' })).getAllByRole('option')[0] as HTMLElement
    const warnung = await within(z2).findByRole('button', { name: /Erlaubnis älter als 12 Monate/ })
    fireEvent.click(warnung)
    expect(letzterEmailZugriff('update')).toBeNull()
    fireEvent.click(within(z2).getByRole('button', { name: 'Trotzdem gesendet' }))
    await waitFor(() => expect(letzterEmailZugriff('update')).toMatchObject({ status: 'sent_confirmed' }))
  })

  it('Gesendet: Status-Chips; „Beantwortet“ → log_reply Kanal email + replied; „Bounce“ → Dialog → bounced; Widerspruch-Trigger; Enter → Peek', async () => {
    ANTWORTEN.emails = [
      email({ id: 'g1', status: 'sent_confirmed', subject: 'Eins' }),
      email({ id: 'g2', status: 'replied', subject: 'Zwei' }),
      email({ id: 'g3', status: 'bounced', subject: 'Drei' }),
    ]
    seite('/email?tab=gesendet')
    const liste = await screen.findByRole('listbox', { name: 'Gesendet' })
    const zeilen = within(liste).getAllByRole('option')
    expect(zeilen.map((z) => z.textContent)).toEqual([
      expect.stringContaining('Gesendet bestätigt'),
      expect.stringContaining('Beantwortet'),
      expect.stringContaining('Bounce'),
    ])
    expect(within(zeilen[1] as HTMLElement).queryByRole('button', { name: 'Beantwortet' })).toBeNull()
    expect(within(zeilen[2] as HTMLElement).queryByRole('button', { name: 'Bounce' })).toBeNull()
    expect(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Widerspruch' })).toBeInTheDocument()

    fireEvent.click(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Beantwortet' }))
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_reply',
        expect.objectContaining({ p_lead_id: LEAD_ID, p_channel: 'email' }),
        undefined,
      ),
    )
    await waitFor(() => expect(letzterEmailZugriff('update')).toMatchObject({ status: 'replied' }))

    fireEvent.click(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Bounce' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bounce erfassen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bounce erfassen' }))
    await waitFor(() =>
      expect(letzterEmailZugriff('update')).toMatchObject({ status: 'bounced', bounce_reason: 'manuell' }),
    )

    fireEvent.click(within(zeilen[0] as HTMLElement).getByRole('button', { name: 'Widerspruch' }))
    expect(await screen.findByRole('dialog', { name: /Werbewiderspruch/ })).toBeInTheDocument()
    taste('Escape')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    taste('Enter')
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(`/email?tab=gesendet&lead=${LEAD_ID}`))
  })
})

describe('faellig.ts', () => {
  it('filtert E-Mail-Sequenzschritte der Sektionen überfällig/heute und manuelle E-Mail-Aufgaben', () => {
    const items = [
      queueItem('heute', 1, { channel: 'email' }),
      queueItem('ueberfaellig', 2, { channel: 'email' }),
      queueItem('kommend', 3, { channel: 'email' }),
      queueItem('heute', 4, { channel: 'telefon' }),
      queueItem('antworten', 5, { channel: 'email' }),
    ]
    expect(faelligeEmailSchritte(items).map((i) => i.section)).toEqual(['heute', 'ueberfaellig'])
    const tasks = [
      { id: 'a', kind: 'aufgabe', status: 'offen', title: 'kurzinfo x', template_id: null },
      { id: 'b', kind: 'aufgabe', status: 'offen', title: 'x', template_id: 'e' },
      { id: 'c', kind: 'aufgabe', status: 'erledigt', title: 'Kurzinfo', template_id: null },
      { id: 'd', kind: 'wiedervorlage', status: 'offen', title: 'Kurzinfo', template_id: null },
    ] as never[]
    expect(manuelleEmailAufgaben(tasks, [{ id: 'e', channel: 'email' }]).map((t: { id: string }) => t.id)).toEqual([
      'a',
      'b',
    ])
  })
})
