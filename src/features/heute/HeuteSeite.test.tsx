// HeuteSeite.test.tsx – Render-Tests je Seitenzustand (BAUPLAN § 3.2, ux § 3.1/§ 4.1/§ 8.3): Laden, Sektionen in fester Reihenfolge
// ohne leere (H-02), erste Karte aktiv (H-01), Kopf-Zähler, J/K, E → Erledigt-Zeile an derselben Position + Erledigt +1 (H-05),
// Rückgängig stellt die Karte an derselben Stelle wieder her (H-06), Batch-Chips (H-10), Annahme prüfen E/X/⇧↓ (H-13/H-23),
// Neue Anfragen E + Abschluss-Satz (H-11), Zurückziehen nur am Wochentag (H-14), Rückrufe (H-18), Leerzustände, Personen-Wechsel.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('./_testHilfe')).toastMock())
// Eingang-Badge (eigener Daten-Hook/Realtime-Kanal) als Platzhalter – hier zählt nur, wo er steht
vi.mock('@/features/eingang/public', () => ({
  EingangBadge: () => <a data-testid="eingang-badge">Eingang 2 zuordnen</a>,
}))

import { useUiStore } from '@/app/uiStore'
import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import type { QueueItem } from '@/types/domain'
import {
  ANTWORTEN,
  ICH,
  leadMitBezug,
  leadsSetzen,
  rendern,
  rpcAufrufe,
  SEQ_A,
  T_KF2,
  taste,
  zeile,
  zuruecksetzen,
} from './_testHilfe'
import { Component as HeuteSeite } from './HeuteSeite'
import { useKartenStore } from './kartenStore'

const OPENER = SEQ_A.steps[0]!.id
const KF1 = SEQ_A.steps[1]!.id
const KF2 = SEQ_A.steps[2]!.id
const KF3 = SEQ_A.steps[3]!.id

/** Mi 14.10.2026, 10:00 Berlin – nur Date wird gefälscht, Timer laufen echt (react-query, waitFor). */
const JETZT = new Date('2026-10-14T08:00:00Z')

function standardQueue(): QueueItem[] {
  return [
    zeile('antworten', 1, { item_id: 'q-antwort', enrollment_id: null, stage: 'dm_beantwortet' }),
    zeile('ueberfaellig', 2, { item_id: 'q-kf1', step_id: KF1, title: 'Kurzfristig 1', days_overdue: 2 }),
    zeile('heute', 3, {
      item_id: 'q-kf2a',
      step_id: KF2,
      title: 'Kurzfristig 2',
      template_id: T_KF2.id,
      enrollment_id: 'enr-3',
      rank_score: 50,
    }),
    zeile('heute', 10, {
      item_id: 'q-kf2b',
      step_id: KF2,
      title: 'Kurzfristig 2',
      template_id: T_KF2.id,
      enrollment_id: 'enr-10',
      rank_score: 40,
    }),
    zeile('annahme_pruefen', 4, { item_id: 'q-ann-alt', connection_id: 'con-4', due_at: '2026-10-12T10:00:00+02:00' }),
    zeile('annahme_pruefen', 5, { item_id: 'q-ann-neu', connection_id: 'con-5', due_at: '2026-10-13T10:00:00+02:00' }),
    zeile('heute', 6, { item_id: 'q-opener', step_id: OPENER, title: 'Opener' }),
    zeile('neue_anfragen', 7, { item_id: 'q-anfrage', subtitle: 'Geschäftsführer · Hamburg' }),
    zeile('zurueckziehen', 8, { item_id: 'q-zurueck', connection_id: 'con-8', days_overdue: 24 }),
    zeile('kommend', 9, {
      item_id: 'q-bald',
      step_id: KF3,
      due_date: '2026-10-19',
      due_at: '2026-10-19T09:00:00+02:00',
    }),
  ]
}

/** Server-Simulation: eine RPC nimmt die Zeile des Leads aus der Queue. */
function entferntBeiRpc(name: string, leadArg = 'p_lead_id', antwort: unknown = null) {
  ANTWORTEN.rpc[name] = (args) => {
    const lead = args[leadArg] as string | undefined
    const enrollment = args.p_enrollment_id as string | undefined
    ANTWORTEN.queue = ANTWORTEN.queue.filter(
      (i) => i.lead_id !== lead && (!enrollment || i.enrollment_id !== enrollment),
    )
    return { data: antwort, error: null }
  }
}

const sektionen = () => [...document.querySelectorAll('[data-sektion]')].map((s) => s.getAttribute('data-sektion'))
const sektion = (s: string) => document.querySelector(`[data-sektion="${s}"]`) as HTMLElement
// Cursor = `aria-current` (Listeneinträge kennen kein aria-selected – Review A11y)
const aktiveKarte = () => document.querySelector('article[aria-current="true"]')
const stat = (label: string) =>
  [...document.querySelectorAll('header span, [class*="tnum"] span')]
    .find((s) => s.textContent?.trim().endsWith(` ${label}`))
    ?.querySelector('b')?.textContent
const keysIn = (s: string) =>
  [...sektion(s).querySelectorAll('[role="list"] > [data-key], [role="list"] > [data-erledigt]')].map(
    (e) => e.getAttribute('data-key') ?? `erledigt:${e.textContent}`,
  )

describe('HeuteSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JETZT)
    zuruecksetzen()
    localStorage.clear()
    useKartenStore.setState({ karten: {} })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], personAnsicht: null, letzterUndo: null })
    useAuth.setState({ status: 'mitglied', member: ICH })
    _akkordZuruecksetzen()
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(toast).mockClear()
    ANTWORTEN.queue = standardQueue()
    leadsSetzen(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => leadMitBezug(i)))
    ANTWORTEN.activities = [
      {
        id: 70,
        lead_id: leadMitBezug(1).id,
        type: 'nachricht_erhalten',
        reply_label: 'interessiert',
        note: 'Ja, kommt mir bekannt vor.',
        occurred_at: '2026-10-13T17:52:00+02:00',
        created_at: '2026-10-13T17:52:00+02:00',
      },
    ]
  })
  afterEach(() => vi.useRealTimers())

  it('lädt: Seitenkopf „Heute“ mit Platzhalter, bis Personen und Queue da sind', () => {
    rendern(<HeuteSeite />)
    expect(screen.getByRole('heading', { name: 'Heute' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Lade …' })).toBeInTheDocument()
  })

  it('H-02/H-01: Sektionen in fester Reihenfolge, leere unsichtbar; erste Karte der ersten Sektion ist aktiv', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() =>
      expect(sektionen()).toEqual([
        'antworten',
        'ueberfaellig',
        'heute',
        'annahme_pruefen',
        'opener',
        'neue_anfragen',
        'spaeter',
      ]),
    )
    // Zurückziehen ist mittwochs unsichtbar (H-14), Rückrufe gibt es keine (H-18)
    expect(sektion('antworten').contains(aktiveKarte())).toBe(true)
    expect(within(sektion('antworten')).getByText('Max Muster1')).toBeInTheDocument()
    // Später ist eingeklappt
    expect(within(sektion('spaeter')).getByRole('button', { name: /Später/ })).toHaveAttribute('aria-expanded', 'false')
    expect(stat('fällig')).toBe('5')
    expect(stat('überfällig')).toBe('1')
    expect(stat('erledigt')).toBe('0')
    expect(screen.getByText('Guten Morgen, Vincent.')).toBeInTheDocument()
  })

  it('Annahme prüfen: neueste Anfrage zuerst, Kopf „offene Anfragen der letzten 7 Tage“ (H-13)', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('annahme_pruefen')).toBeTruthy())
    const zeilen = within(sektion('annahme_pruefen')).getAllByRole('listitem')
    expect(zeilen.map((z) => z.textContent)).toEqual([
      expect.stringContaining('Max Muster5'),
      expect.stringContaining('Max Muster4'),
    ])
    expect(zeilen[0]).toHaveTextContent('angefragt Di 13.10.')
    expect(sektion('annahme_pruefen')).toHaveTextContent('offene Anfragen der letzten 7 Tage')
  })

  it('`?lead=` beim Ankommen („Jetzt vorbereiten →“): springt zur Karte und entfernt den Parameter – kein Peek über Heute', async () => {
    rendern(<HeuteSeite />, { pfad: `/heute?lead=${leadMitBezug(10).id}` })
    await waitFor(() =>
      expect(within(sektion('heute')).getByText('Max Muster10').closest('article')).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/heute$/))
  })

  it('offener Peek: Heute-Tasten schweigen (J/C/E wirkten sonst auf die Karte hinter dem Scrim) – Review', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('antworten')?.contains(aktiveKarte())).toBe(true))
    act(() => useUiStore.setState({ peekLeadId: leadMitBezug(3).id }))
    taste('j')
    taste('e')
    expect(sektion('antworten').contains(aktiveKarte())).toBe(true)
    expect(rpcAufrufe(supabase.rpc)).toEqual([])
    act(() => useUiStore.setState({ peekLeadId: null }))
    taste('j')
    await waitFor(() => expect(sektion('ueberfaellig').contains(aktiveKarte())).toBe(true))
  })

  it('Ladefehler der Queue: Fehlerzeile „erneut versuchen R“ statt „Nichts mehr fällig.“ (ux § 4.3)', async () => {
    ANTWORTEN.queueFehler = { code: '500', message: 'kaputt' }
    rendern(<HeuteSeite />)
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Heute konnte nicht geladen werden – erneut versuchen.')
    expect(within(alarm).getByRole('button', { name: /Erneut versuchen/ })).toHaveTextContent('R')
    expect(screen.queryByText('Nichts mehr fällig.')).toBeNull()
    ANTWORTEN.queueFehler = null
    taste('r')
    await waitFor(() => expect(sektion('antworten')).toBeTruthy())
  })

  it('ux § 4.5: „Alle verschieben auf heute“ (⌥H) – snooze_step je Schritt ab −14 T, ein Sammel-Toast mit Rückgängig', async () => {
    ANTWORTEN.queue = [
      zeile('ueberfaellig', 2, { item_id: 'q-alt', step_id: KF1, enrollment_id: 'enr-2', days_overdue: 20 }),
      zeile('heute', 3, { item_id: 'q-kf2a', step_id: KF2, enrollment_id: 'enr-3' }),
    ]
    ANTWORTEN.activities.push({
      id: 880,
      lead_id: leadMitBezug(2).id,
      type: 'schritt_verschoben',
      occurred_at: JETZT.toISOString(),
      created_at: JETZT.toISOString(),
    })
    rendern(<HeuteSeite />)
    const knopf = await screen.findByRole('button', { name: /Alle verschieben auf heute/ })
    expect(knopf).toHaveTextContent('⌥H')
    fireEvent.keyDown(document.body, { key: '˙', code: 'KeyH', altKey: true })
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'snooze_step',
        { p_enrollment_id: 'enr-2', p_until: '2026-10-14T07:00:00.000Z' },
      ]),
    )
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith('1 Schritt auf heute verschoben.', [880]))
  })

  it('Runde 2: beim Laden kein scrollIntoView (lange Karte schob Kopf und Namen unter den Sticky-Kopf), erst bei J', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
    rendern(<HeuteSeite />)
    await waitFor(() => expect(aktiveKarte()).toBeTruthy())
    expect(scroll).not.toHaveBeenCalled()
    taste('j')
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(aktiveKarte()?.className).toContain('scroll-mt-[calc(var(--head-h,0px)+16px)]')
    // Runde 3: scrollIntoView läuft auf dem [data-key]-Wrapper – die scroll-margin muss dort sitzen, sonst landet der Kopf unter dem Sticky-Kopf
    const ziel = scroll.mock.contexts.at(-1) as HTMLElement
    expect(ziel).toHaveAttribute('data-key')
    expect(ziel.className).toContain('scroll-mt-[calc(var(--head-h,0px)+16px)]')
    scroll.mockRestore()
  })

  it('J/K bewegt den Cursor über Karten und Sektionen', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(aktiveKarte()).toBeTruthy())
    taste('j')
    await waitFor(() => expect(sektion('ueberfaellig').contains(aktiveKarte())).toBe(true))
    taste('j')
    await waitFor(() =>
      expect(within(sektion('heute')).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true'),
    )
    taste('k')
    await waitFor(() => expect(sektion('ueberfaellig').contains(aktiveKarte())).toBe(true))
  })

  it('H-05/H-06: E → Karte weg, Erledigt-Zeile an derselben Stelle, Erledigt +1; Rückgängig stellt die Karte an derselben Stelle wieder her', async () => {
    entferntBeiRpc('complete_step', 'p_lead_id', {
      id: 'enr-3',
      status: 'aktiv',
      current_step_id: KF3,
      next_due_at: '2026-10-24T07:00:00Z',
    })
    ANTWORTEN.activities.push({
      id: 901,
      lead_id: leadMitBezug(3).id,
      type: 'nachricht_gesendet',
      occurred_at: JETZT.toISOString(),
      created_at: JETZT.toISOString(),
    })
    const { qc } = rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('heute')).toBeTruthy())
    expect(keysIn('heute')).toEqual(['q-kf2a', 'q-kf2b'])
    fireEvent.click(within(sektion('heute')).getByText('Max Muster3'))
    await waitFor(() =>
      expect(within(sektion('heute')).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true'),
    )
    taste('e')
    await waitFor(() => expect(within(sektion('heute')).getByText('Erledigt')).toBeInTheDocument())
    expect(rpcAufrufe(supabase.rpc)).toContainEqual([
      'complete_step',
      { p_enrollment_id: 'enr-3', p_outcome: 'gesendet', p_template_id: null },
    ])
    expect(keysIn('heute')[0]).toMatch(/^erledigt:ErledigtMax Muster3 · Kurzfristig 3 am Sa 24\.10\./)
    expect(keysIn('heute')[1]).toBe('q-kf2b')
    // Cursor rückt an derselben Stelle nach
    await waitFor(() =>
      expect(within(sektion('heute')).getByText('Max Muster10').closest('article')).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
    await waitFor(() => expect(stat('erledigt')).toBe('1'))
    expect(stat('fällig')).toBe('4')

    // Rückgängig: der Server liefert die Zeile wieder – sie steht an ihrer alten Position, die Erledigt-Zeile verschwindet
    ANTWORTEN.queue = standardQueue()
    ANTWORTEN.activities = ANTWORTEN.activities.filter((a) => a.id !== 901)
    await act(async () => {
      await qc.invalidateQueries()
    })
    await waitFor(() => expect(keysIn('heute')).toEqual(['q-kf2a', 'q-kf2b']))
    expect(stat('erledigt')).toBe('0')
  })

  it('H-15: nach C und Fensterwechsel (Refetch) bleibt der Cursor auf derselben Karte', async () => {
    const { qc } = rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('heute')).toBeTruthy())
    fireEvent.click(within(sektion('heute')).getByText('Max Muster10'))
    await waitFor(() =>
      expect(within(sektion('heute')).getByText('Max Muster10').closest('article')).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
    taste('c')
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    await act(async () => {
      await qc.invalidateQueries()
    })
    expect(within(sektion('heute')).getByText('Max Muster10').closest('article')).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('H-10: Batch-Chip „Kurzfristig 2“ zeigt genau dessen Karten, ⌥0 zeigt wieder alle', async () => {
    rendern(<HeuteSeite />)
    const chips = await screen.findByRole('group', { name: 'Batch-Filter' })
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Alle5⌥0', 'Opener1⌥1', 'Kurzfristig 11⌥2', 'Kurzfristig 22⌥3', 'Antworten1⌥4'])
    fireEvent.click(within(chips).getByRole('button', { name: /Kurzfristig 2/ }))
    await waitFor(() => expect(sektionen()).toEqual(['heute']))
    expect(keysIn('heute')).toEqual(['q-kf2a', 'q-kf2b'])
    taste('Dead', { altKey: true, code: 'Digit0' })
    await waitFor(() => expect(sektionen()).toContain('antworten'))
    taste('¡', { altKey: true, code: 'Digit1' })
    await waitFor(() => expect(sektionen()).toEqual(['opener']))
  })

  it('H-13: Annahme prüfen – E setzt mark_accepted, die Zeile verschwindet, Erledigt +1', async () => {
    entferntBeiRpc('mark_accepted')
    // Server-Trigger: mark_accepted schreibt `vernetzung_angenommen` – Erledigt zählt seit Runde 3 diese Aktivität (dauerhaft,
    // wie Team), keinen Sitzungszähler mehr
    const entfernen = ANTWORTEN.rpc.mark_accepted as (a: Record<string, unknown>) => { data: unknown; error: unknown }
    ANTWORTEN.rpc.mark_accepted = (args) => {
      ANTWORTEN.activities.push({
        id: 990,
        lead_id: args.p_lead_id as string,
        member_id: ICH.user_id,
        type: 'vernetzung_angenommen',
        channel: 'linkedin',
        occurred_at: new Date().toISOString(),
      })
      return entfernen(args)
    }
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('annahme_pruefen')).toBeTruthy())
    fireEvent.click(within(sektion('annahme_pruefen')).getByText('Max Muster5'))
    taste('e')
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'mark_accepted',
        { p_lead_id: leadMitBezug(5).id, p_date: null },
      ]),
    )
    await waitFor(() => expect(within(sektion('annahme_pruefen')).queryByText('Max Muster5')).not.toBeInTheDocument())
    await waitFor(() => expect(stat('erledigt')).toBe('1'))
  })

  it('⇧↓ markiert einen Bereich, E hakt alle ab (ein Sammel-Toast)', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('annahme_pruefen')).toBeTruthy())
    fireEvent.click(within(sektion('annahme_pruefen')).getByText('Max Muster5'))
    taste('ArrowDown', { shiftKey: true })
    taste('e')
    await waitFor(() => expect(rpcAufrufe(supabase.rpc).filter((a) => a[0] === 'mark_accepted')).toHaveLength(2))
    expect(toast).toHaveBeenCalledWith('2 Annahmen erfasst.')
  })

  it('H-23: X in „Annahme prüfen“ → Vernetzung zurückgezogen mit Note „abgelehnt“', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('annahme_pruefen')).toBeTruthy())
    fireEvent.click(within(sektion('annahme_pruefen')).getByText('Max Muster4'))
    taste('x')
    await waitFor(() =>
      expect(ANTWORTEN.schreiben).toContainEqual(
        expect.objectContaining({
          tabelle: 'linkedin_connections',
          art: 'update',
          arg: expect.objectContaining({ status: 'zurueckgezogen', note: 'abgelehnt' }),
        }),
      ),
    )
  })

  it('H-11/H-12: Neue Anfragen – Kopf „Heute noch möglich“, E → log_request, danach „Liste abgearbeitet – 1 Anfrage gesendet.“', async () => {
    entferntBeiRpc('log_request')
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('neue_anfragen')).toBeTruthy())
    expect(sektion('neue_anfragen')).toHaveTextContent(/Heute noch möglich: 30 von 30 · Woche 0\s*\/\s*150/)
    fireEvent.click(within(sektion('neue_anfragen')).getByText('Max Muster7'))
    taste('e')
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'log_request',
        { p_lead_id: leadMitBezug(7).id, p_member_id: ICH.user_id, p_note_variant: 'ohne' },
      ]),
    )
    expect(await screen.findByText('Liste abgearbeitet – 1 Anfrage gesendet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nächste Liste einfügen/ })).toBeInTheDocument()
  })

  it('Neue Anfragen: ⇧E → Notiz-Variante 1 → log_request(note_v1); X → „Passt nicht“ 2 → beendet/nicht_icp (§ 1.5 Nr. 7)', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('neue_anfragen')).toBeTruthy())
    fireEvent.click(within(sektion('neue_anfragen')).getByText('Max Muster7'))
    taste('E', { shiftKey: true })
    expect(await screen.findByRole('menu', { name: 'Notiz-Variante' })).toBeInTheDocument()
    taste('1')
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'log_request',
        { p_lead_id: leadMitBezug(7).id, p_member_id: ICH.user_id, p_note_variant: 'note_v1' },
      ]),
    )
    // die Zeile kommt mit dem Refetch zurück (der Mock-Server nimmt sie nicht heraus) – Cursor wieder darauf
    fireEvent.click(await within(sektion('neue_anfragen')).findByText('Max Muster7'))
    taste('x')
    expect(await screen.findByRole('menu', { name: 'Passt nicht – Grund' })).toBeInTheDocument()
    taste('2')
    await waitFor(() =>
      expect(ANTWORTEN.schreiben).toContainEqual(
        expect.objectContaining({
          tabelle: 'leads',
          art: 'update',
          arg: expect.objectContaining({ stage: 'beendet', ended_reason: 'nicht_icp' }),
        }),
      ),
    )
  })

  it('Annahme prüfen: D öffnet „Angenommen am“ (Datum der Annahme)', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('annahme_pruefen')).toBeTruthy())
    fireEvent.click(within(sektion('annahme_pruefen')).getByText('Max Muster4'))
    taste('d')
    expect(await screen.findByText('Angenommen am')).toBeInTheDocument()
  })

  it('H-14: ?sektion=zurueckziehen zeigt „Zurückziehen“ auch mittwochs – Zeile „offen seit 24 T“', async () => {
    rendern(<HeuteSeite />, { pfad: '/heute?sektion=zurueckziehen' })
    await waitFor(() => expect(sektion('zurueckziehen')).toBeTruthy())
    expect(sektion('zurueckziehen')).toHaveTextContent('offen seit 24 T')
    expect(within(sektion('zurueckziehen')).getByRole('button', { name: /Zurückgezogen/ })).toBeInTheDocument()
  })

  it('H-18: Rückrufe erscheinen nur mit Rückruf-Aufgaben, oben und nach Uhrzeit sortiert', async () => {
    ANTWORTEN.queue = [
      ...standardQueue(),
      zeile('heute', 11, {
        item_kind: 'rueckruf',
        channel: 'telefon',
        item_id: 'r-15',
        due_at: '2026-10-14T15:00:00+02:00',
        task_id: 't-15',
      }),
      zeile('ueberfaellig', 12, {
        item_kind: 'rueckruf',
        channel: 'telefon',
        item_id: 'r-09',
        due_at: '2026-10-14T09:30:00+02:00',
        task_id: 't-09',
      }),
    ]
    leadsSetzen(leadMitBezug(11), leadMitBezug(12))
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektionen()[0]).toBe('rueckrufe'))
    expect(keysIn('rueckrufe')).toEqual(['r-09', 'r-15'])
    expect(sektion('rueckrufe')).toHaveTextContent(/verpasst · /)
    // Rechte Spalte „Später heute“: der Rückruf um 15:00
    expect(screen.getByText('Später heute').parentElement).toHaveTextContent('15:00')
    // Runde 2: „verpasst · HH:MM“ statt h:mm:ss
    expect(sektion('rueckrufe')).toHaveTextContent(/verpasst · \d\d:\d\d(?!:)/)
  })

  it('Antworten-Karte „Später“: bis morgen ausgeblendet (+1 Tag), Zeile „Später · morgen, Do 15.10.“', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(sektion('antworten').contains(aktiveKarte())).toBe(true))
    taste('s')
    await waitFor(() => expect(within(sektion('antworten')).getByText('Später')).toBeInTheDocument())
    expect(sektion('antworten')).toHaveTextContent('morgen, Do 15.10.')
    expect(localStorage.getItem(`crm.heute.antwort.${leadMitBezug(1).id}`)).toBe('2026-10-15')
    expect(stat('fällig')).toBe('5') // die Zeile ist noch fällig, nur ausgeblendet
  })

  it('Leerzustand „Nichts mehr fällig.“ mit dem nächsten Termin (ux § 4.1)', async () => {
    ANTWORTEN.queue = [zeile('kommend', 9, { item_id: 'q-bald', step_id: KF3, due_date: '2026-10-19' })]
    rendern(<HeuteSeite />)
    expect(await screen.findByText('Nichts mehr fällig.')).toBeInTheDocument()
    expect(screen.getByText('Nächster Schritt: Mo 19.10. · 1 Follow-up.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leads ansehen' })).toBeInTheDocument()
  })

  it('Leerzustand „Noch keine Leads.“ ohne Daten', async () => {
    ANTWORTEN.queue = []
    ANTWORTEN.pipeline = []
    rendern(<HeuteSeite />)
    expect(await screen.findByText('Noch keine Leads.')).toBeInTheDocument()
    expect(screen.getByText('Füge eine Liste aus ChatGPT ein oder importiere die Sheets.')).toBeInTheDocument()
  })

  it('?person=mike: Banner „Du siehst Mikes Heute.“, Leerzustand der anderen Person, Zurück entfernt den Parameter', async () => {
    ANTWORTEN.queue = []
    rendern(<HeuteSeite />, { pfad: '/heute?person=mike' })
    expect(await screen.findByText('Du siehst Mikes Heute.')).toBeInTheDocument()
    expect(await screen.findByText('Mike hat heute nichts Fälliges.')).toBeInTheDocument()
    expect(useUiStore.getState().personAnsicht).toBeTruthy()
    // Banner „Zurück zu deinem ↩“ und Leerzustand „Zurück zu deinem Heute“ führen beide zurück
    expect(screen.getAllByRole('button', { name: /Zurück zu deinem/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu deinem Heute' }))
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/heute$/))
  })

  it('Runde 3: Eingang-Badge („Eingang n zuordnen“) im Kopf der eigenen Heute-Liste, nicht bei der anderen Person', async () => {
    rendern(<HeuteSeite />)
    const badge = await screen.findByTestId('eingang-badge')
    expect(badge.closest('[data-seitenkopf]')).toBeTruthy()
  })

  it('Runde 3: kein Eingang-Badge auf Mikes Heute', async () => {
    rendern(<HeuteSeite />, { pfad: '/heute?person=mike' })
    expect(await screen.findByText('Du siehst Mikes Heute.')).toBeInTheDocument()
    expect(screen.queryByTestId('eingang-badge')).not.toBeInTheDocument()
  })

  it('Segment Vincent · Mike wechselt die Queue über ?person=', async () => {
    rendern(<HeuteSeite />)
    const seg = await screen.findByRole('group', { name: 'Heute von' })
    expect(within(seg).getByRole('button', { name: 'Vincent' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(seg).getByRole('button', { name: 'Mike' }))
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/heute?person=mike'))
  })

  it('Kanalzeile und Tageszähler für LinkedIn, Hinweis-Karte „Noch kein Backup“ (H-17)', async () => {
    rendern(<HeuteSeite />)
    await waitFor(() => expect(document.querySelector('[data-kanalzeile]')).toBeTruthy())
    expect(document.querySelector('[data-kanalzeile]')).toHaveTextContent(/Anfragen heute\s*0\s*\/\s*30/)
    expect(document.querySelector('[data-tageszaehler]')).toBeTruthy()
    // Runde 3: nur eine Stelle – Tageszähler rechts ab 1180 px, darunter die Kanalzeile (der Tageszähler fällt dort weg)
    expect(document.querySelector('[data-tageszaehler]')).toHaveClass('max-wide:hidden')
    expect(document.querySelector('[data-kanal-linkedin]')).toHaveClass('wide:hidden')
    expect(screen.getByText('Noch kein Backup – jetzt sichern')).toBeInTheDocument()
  })
})
