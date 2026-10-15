// LeadSeite.test.tsx (ux § 3.3.5, BAUPLAN § 3.3): Zustände nicht gefunden · Vollseite (Kopf, drei Kanal-Karten nebeneinander, Tabs) ·
// Tab Notizen · Tab Gespräche (Status-Buttons, No-Show → Vorschlag-Toast, ↵ startet `email_noshow_erstgespraech`, LD-13) ·
// Tab Rechtliches (Historien, Firmensperre, „Auskunft exportieren (JSON)“ → Datei + Notiz, LD-12).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sonnerToast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { downloadJson } from '@/lib/csv'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { queueItem } from '@/test/fixtures/queue'
import {
  DB,
  FIRMA_GESPERRT,
  MEMBER_V,
  aktivitaet,
  erstesArg,
  leadMitBezug,
  rendern,
  zugriffeMit,
  zuruecksetzen,
} from './_testHilfe'
import { Component as LeadSeite } from './LeadSeite'
import { NO_SHOW_TEXT } from './noShow'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 'undo'),
  sonnerToast: { custom: vi.fn(() => 'vorschlag'), dismiss: vi.fn() },
}))
vi.mock('@/lib/csv', async (original) => ({ ...(await original<typeof import('@/lib/csv')>()), downloadJson: vi.fn() }))

const ID = '10000000-0000-4000-8000-000000000001'
const seite = (tab = '') => rendern(<LeadSeite />, { route: `/leads/${ID}${tab}`, pfad: '/leads/:id' })
const MEETING = {
  id: 'm1',
  lead_id: ID,
  member_id: MEMBER_V,
  type: 'erstgespraech',
  status: 'geplant',
  scheduled_at: '2026-10-13T10:00:00+02:00',
  duration_min: 15,
  location: 'Google Meet',
}

describe('LeadSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.details = [leadMitBezug(1, { full_name: 'Anna Amsel', owner_id: MEMBER_V })]
    vi.mocked(sonnerToast.custom).mockClear()
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(downloadJson).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('nicht gefunden', async () => {
    DB.details = []
    seite()
    expect(await screen.findByText('Lead nicht gefunden.')).toBeInTheDocument()
  })

  it('Vollseite: Titel, drei Kanal-Karten nebeneinander, Tabs, Timeline als Standard', async () => {
    seite()
    expect(await screen.findByRole('heading', { name: 'Anna Amsel' })).toBeInTheDocument()
    const karten = document.querySelector('[data-kanal-karten]') as HTMLElement
    expect([...karten.querySelectorAll('[data-kanal]')].map((k) => k.getAttribute('data-kanal'))).toEqual([
      'linkedin',
      'telefon',
      'email',
    ])
    const tabs = screen.getByRole('tablist', { name: 'Lead-Bereiche' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Timeline', 'Notizen', 'Gespräche', 'Rechtliches'])
    expect(screen.getByRole('group', { name: 'Verlauf filtern' })).toBeInTheDocument()
  })

  it('Drittel-Spalte: Profil-URL mit Icon-Aktionen (kopieren/öffnen), Nächster Schritt oben bündig', async () => {
    DB.details = [
      leadMitBezug(1, {
        full_name: 'Anna Amsel',
        owner_id: MEMBER_V,
        role: 'geschaeftsfuehrer',
        role_title: 'Geschäftsführer',
      }),
    ]
    seite()
    await screen.findByRole('heading', { name: 'Anna Amsel' })
    const linkedin = document.querySelector('[data-kanal="linkedin"]') as HTMLElement
    expect(within(linkedin).getByRole('button', { name: 'Profil-URL kopieren' })).toBeInTheDocument()
    expect(within(linkedin).getByRole('link', { name: 'Profil öffnen' })).toHaveAttribute('target', '_blank')
    expect(within(linkedin).queryByText('kopieren')).toBeNull()
    expect(document.querySelector('[data-felder]')?.parentElement?.className).toContain('items-start')
    // Rolle nicht doppelt („Geschäftsführer · Geschäftsführer“)
    expect(screen.queryByText('Geschäftsführer · Geschäftsführer')).toBeNull()
  })

  it('Tab Notizen zeigt das Notizfeld und nur Notizen', async () => {
    DB.activities = [
      aktivitaet({ lead_id: ID, type: 'notiz', note: 'Vertragsentwurf geschickt' }),
      aktivitaet({ lead_id: ID, type: 'anruf', channel: 'telefon', outcome: 'no_answer' }),
    ]
    seite('?tab=notizen')
    expect(await screen.findByText('Vertragsentwurf geschickt')).toBeInTheDocument()
    expect(document.querySelector('[data-notizfeld] textarea')).not.toBeNull()
    await waitFor(() =>
      expect([...document.querySelectorAll('[data-typ]')].map((e) => e.getAttribute('data-typ'))).toEqual(['notiz']),
    )
  })

  it('Tab Gespräche: No-Show eines Erstgesprächs → Vorschlag-Toast, ↵ startet die No-Show-Sequenz (LD-13)', async () => {
    DB.meetings = [MEETING]
    DB.calls = [
      {
        id: 'c1',
        lead_id: ID,
        member_id: MEMBER_V,
        started_at: '2026-10-12T15:00:00+02:00',
        outcome: 'no_answer',
        attempt_no: 1,
        duration_sec: 0,
      },
    ]
    seite('?tab=gespraeche')
    const termin = await screen.findByRole('group', { name: 'Status Erstgespräch' })
    expect(screen.getByText('Versuch 1', { exact: false })).toBeInTheDocument()
    fireEvent.click(within(termin).getByRole('button', { name: 'No-Show' }))
    await waitFor(() => expect(zugriffeMit('meetings', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('meetings', 'update')[0] ?? [], 'update')).toEqual({ status: 'no_show' })
    await waitFor(() => expect(sonnerToast.custom).toHaveBeenCalledTimes(1))
    // Der Vorschlag-Toast trägt den Wortlaut aus § 1.5 Nr. 28; ↵ startet, solange er sichtbar ist
    expect(NO_SHOW_TEXT).toBe('Sequenz ‚No-Show Erstgespräch‘ starten?')
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.some((c) => c[0] === 'enroll')).toBe(true))
    const aufruf = vi.mocked(supabase.rpc).mock.calls.find((c) => c[0] === 'enroll') as unknown[]
    expect(aufruf[1]).toMatchObject({ p_lead_id: ID, p_sequence_key: SEQUENZ.email_noshow_erstgespraech })
  })

  it('Tab Gespräche leer', async () => {
    seite('?tab=gespraeche')
    expect(await screen.findByText('Noch kein Termin.')).toBeInTheDocument()
    expect(await screen.findByText('Noch kein Anruf.')).toBeInTheDocument()
  })

  it('Tab Rechtliches: Historien, Firmensperre, „Auskunft exportieren (JSON)“ lädt die Datei und schreibt die Notiz (LD-12)', async () => {
    DB.details = [
      leadMitBezug(1, {
        companies: FIRMA_GESPERRT,
        call_basis: 'linkedin_vernetzt',
        email_consent_basis: 'requested_linkedin',
        email_consent_at: '2026-10-05T09:00:00+02:00',
      }),
    ]
    DB.activities = [
      aktivitaet({
        lead_id: ID,
        type: 'einwilligung',
        channel: 'telefon',
        outcome: 'linkedin_vernetzt',
        metadata: { kind: 'anrufgrund' },
      }),
    ]
    seite('?tab=rechtliches')
    expect(await screen.findByText('Anrufgrund-Historie')).toBeInTheDocument()
    expect(screen.getByText('Firma gesperrt – nicht anschreiben')).toBeInTheDocument()
    expect(screen.getByText('Nicht auf der Sperrliste')).toBeInTheDocument()
    // Leere Sperrliste → kein roter Chip „Sperrliste“ im Kopf (Runde 2, echte Daten)
    expect(screen.queryByText('Sperrliste', { exact: true })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Auskunft exportieren (JSON)' }))
    await waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1))
    const [auskunft, name] = vi.mocked(downloadJson).mock.calls[0] as [Record<string, unknown>, string]
    expect(name).toMatch(/^lead-[0-9a-f]{8}-2026-10-14\.json$/)
    expect(Object.keys(auskunft)).toEqual(
      expect.arrayContaining([
        'lead',
        'company',
        'activities',
        'calls',
        'emails',
        'meetings',
        'tasks',
        'linkedin_connections',
        'enrollments',
        'tags',
      ]),
    )
    await waitFor(() => expect(zugriffeMit('activities', 'insert')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('activities', 'insert')[0] ?? [], 'insert')).toMatchObject({
      type: 'notiz',
      metadata: { kind: 'auskunft_export' },
    })
    expect(await screen.findByText(name)).toBeInTheDocument()
  })

  it('Runde 3: Nächster Schritt offen wie im Peek (Text + Aktionen), ohne Tastenhinweise; B öffnet nur EIN Beenden', async () => {
    DB.queue = [queueItem('heute', 0, { lead_id: ID, member_id: MEMBER_V })]
    seite()
    await screen.findByRole('heading', { name: 'Anna Amsel' })
    const huelle = document.querySelector('[data-karte-ohne-tasten]') as HTMLElement
    await waitFor(() => expect(huelle.querySelector('[data-naechster-schritt="karte"]')).not.toBeNull())
    // offen statt zugeklappt: die eingebettete Karte ist die aktive (aria-current), nicht die zugeklappte Zeile
    expect(huelle.querySelector('article[data-eingebettet][aria-current="true"]')).not.toBeNull()
    expect(huelle).toHaveClass('[&_kbd]:hidden')
    // Karten-Tasten schweigen (TastenBereich „stumm“): B öffnet nur das Beenden der Fußleiste
    fireEvent.keyDown(document.body, { key: 'b' })
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
  })

  it('Runde 3: überfälliger „Nächster Follow-up“ im Feldraster in Amber mit „−n T“', async () => {
    DB.details = [
      leadMitBezug(1, {
        full_name: 'Anna Amsel',
        owner_id: MEMBER_V,
        next_action_at: '2026-10-07T09:00:00+02:00',
        next_action_label: 'Kurzfristig 1',
      }),
    ]
    seite()
    await screen.findByRole('heading', { name: 'Anna Amsel' })
    const feld = await screen.findByRole('button', { name: 'Nächster Follow-up bearbeiten' })
    expect(feld).toHaveTextContent('07.10.2026 −7 T · Kurzfristig 1')
    expect(feld).toHaveClass('text-overdue')
  })
})
