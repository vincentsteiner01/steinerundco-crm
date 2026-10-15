// Timeline.test.tsx (BAUPLAN § 3.3, LD-06, LD-07): Tag-Gruppen „Heute · Gestern · Mo 12.10.“, neueste oben, Filter „Anrufe“,
// „NÄCHSTES“ über der Linie (erster Eintrag Lime), Notiz bearbeiten mit Versionen, Normalisierung der Trigger-Stufenwechsel.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB, aktivitaet, erstesArg, leadMitBezug, rendern, zugriffeMit, zuruecksetzen } from './_testHilfe'
import { naechsteEintraege } from './detailLogik'
import { Timeline } from './Timeline'
import { timelineText } from './timelineText'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())

const LEAD = leadMitBezug(1, {
  enrollments: [
    {
      id: 'e1',
      lead_id: '10000000-0000-4000-8000-000000000001',
      status: 'aktiv',
      next_due_at: '2026-10-16T09:00:00+02:00',
      current_step_id: null,
    } as never,
  ],
  tasks: [
    {
      id: 't1',
      lead_id: '10000000-0000-4000-8000-000000000001',
      status: 'offen',
      kind: 'rueckruf',
      title: 'Rückruf vereinbart',
      due_at: '2026-10-15T10:30:00+02:00',
    } as never,
  ],
})

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.details = [LEAD]
    DB.activities = [
      aktivitaet({
        id: 1,
        type: 'notiz',
        note: 'Ruft nach der Messe zurück',
        occurred_at: '2026-10-14T09:15:00+02:00',
      }),
      aktivitaet({
        id: 2,
        type: 'anruf',
        channel: 'telefon',
        outcome: 'no_answer',
        occurred_at: '2026-10-13T16:00:00+02:00',
      }),
      aktivitaet({
        id: 3,
        type: 'stage_wechsel',
        channel: 'sonstiges',
        outcome: 'dm_beantwortet',
        metadata: { from: 'gespraech_eroeffnet', to: 'dm_beantwortet' },
        occurred_at: '2026-10-12T11:00:00+02:00',
      }),
    ]
  })
  afterEach(() => vi.useRealTimers())

  it('Tag-Gruppen neueste oben (LD-06) und „NÄCHSTES“ über der Linie', async () => {
    rendern(<Timeline leadId={LEAD.id} />)
    const verlauf = await screen.findByRole('list', { name: 'Verlauf' })
    const eintraege = within(verlauf).getAllByRole('listitem')
    expect(eintraege.map((e) => e.getAttribute('data-typ'))).toEqual(['notiz', 'anruf', 'stage_wechsel'])
    expect(eintraege[0]).toHaveTextContent(/^Heute 09:15/)
    expect(eintraege[1]).toHaveTextContent(/^Gestern 16:00/)
    expect(eintraege[2]).toHaveTextContent(/^Mo 12\.10\. 11:00/)
    expect(eintraege[2]).toHaveTextContent('Phase geändert')
    const naechstes = await screen.findByRole('list', { name: 'Nächstes' })
    const n = within(naechstes).getAllByRole('listitem')
    expect(n[0]).toHaveTextContent('Rückruf vereinbart')
    expect(n[0]).toHaveTextContent('geplant')
    expect(n[1]).toHaveTextContent('Nächster Schritt')
  })

  it('Runde 2: überfälliges „Nächstes“ steht in Amber mit „überfällig“ statt „geplant“', async () => {
    DB.details = [
      {
        ...LEAD,
        tasks: [{ ...(LEAD.tasks?.[0] as object), due_at: '2026-10-05T09:00:00+02:00', title: 'Follow-up geplant' }],
      } as never,
    ]
    rendern(<Timeline leadId={LEAD.id} />)
    const naechstes = await screen.findByRole('list', { name: 'Nächstes' })
    const erster = within(naechstes).getAllByRole('listitem')[0] as HTMLElement
    expect(erster).toHaveAttribute('data-ueberfaellig', 'true')
    expect(erster).toHaveTextContent('überfällig')
    expect(within(erster).getByText('Mo 05.10.')).toHaveClass('text-overdue')
  })

  it('Filter „Anrufe“ zeigt nur Anruf-Ereignisse (LD-06)', async () => {
    rendern(<Timeline leadId={LEAD.id} />)
    await screen.findByRole('list', { name: 'Verlauf' })
    fireEvent.click(screen.getByRole('button', { name: 'Anrufe' }))
    await waitFor(() => {
      const typen = within(screen.getByRole('list', { name: 'Verlauf' }))
        .getAllByRole('listitem')
        .map((e) => e.getAttribute('data-typ'))
      expect(typen).toEqual(['anruf'])
    })
    expect(screen.getByRole('button', { name: 'Anrufe' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('kompakt (Peek): nur Alle · Nachrichten · Notizen', async () => {
    rendern(<Timeline leadId={LEAD.id} kompakt />)
    await screen.findByRole('list', { name: 'Verlauf' })
    const gruppe = screen.getByRole('group', { name: 'Verlauf filtern' })
    expect(
      within(gruppe)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Alle', 'Nachrichten', 'Notizen'])
  })

  it('Leerzustand ohne Aktivitäten', async () => {
    DB.activities = []
    DB.details = [leadMitBezug(1)]
    rendern(<Timeline leadId={LEAD.id} />)
    expect(await screen.findByText(/Noch nichts passiert|Noch keine/)).toBeInTheDocument()
  })

  it('eigene Notiz bearbeiten schreibt die alte Fassung nach metadata.versions (LD-07)', async () => {
    rendern(<Timeline leadId={LEAD.id} />)
    await screen.findByRole('list', { name: 'Verlauf' })
    fireEvent.click(screen.getByRole('button', { name: 'bearbeiten' }))
    const feld = screen.getByRole('textbox', { name: 'Notiz bearbeiten' })
    fireEvent.change(feld, { target: { value: 'Ruft am Freitag zurück' } })
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    await waitFor(() => expect(zugriffeMit('activities', 'update')).toHaveLength(1))
    const patch = erstesArg(zugriffeMit('activities', 'update')[0] ?? [], 'update') as {
      note: string
      metadata: { versions: { note: string }[] }
    }
    expect(patch.note).toBe('Ruft am Freitag zurück')
    expect(patch.metadata.versions[0]?.note).toBe('Ruft nach der Messe zurück')
  })
})

describe('Stufenwechsel aus dem Trigger', () => {
  it('rückwärts → „Phase zurückgesetzt“, Beendet-Grund aus metadata.ended_reason', () => {
    const rueck = aktivitaet({
      type: 'stage_wechsel',
      outcome: 'gespraech_eroeffnet',
      metadata: { from: 'pitch', to: 'gespraech_eroeffnet' },
    })
    expect(timelineText(rueck)).toMatch(/^Phase zurückgesetzt: /)
    const ende = aktivitaet({
      type: 'stage_wechsel',
      outcome: 'beendet',
      metadata: { from: 'pitch', to: 'beendet', ended_reason: 'kein_bedarf' },
    })
    expect(timelineText(ende)).toBe('Beendet · Kein Bedarf')
    const pipeline = aktivitaet({
      type: 'stage_wechsel',
      metadata: { from: 'gespraech_eroeffnet', to: 'dm_beantwortet', via: 'pipeline' },
    })
    expect(timelineText(pipeline)).toMatch(/^Phase geändert: .+ \(per Pipeline\)$/)
  })

  it('naechsteEintraege sortiert Schritte, Aufgaben und Termine nach Datum', () => {
    const e = naechsteEintraege(LEAD, () => 'Kurzfristig 2')
    expect(e.map((x) => x.art)).toEqual(['aufgabe', 'schritt'])
    expect(e[1]?.text).toBe('Kurzfristig 2')
  })
})
