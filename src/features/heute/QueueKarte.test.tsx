// QueueKarte.test.tsx (BAUPLAN § 3.2 Unit-Tests): kollabiert, gefüllter Text + Kopieren (H-03), gated bei offenem Platzhalter (H-04),
// copied-Zustand, `E` → complete_step + Erledigt-Rückmeldung (H-05), Telefon-Variante (H-19), E-Mail-Variante mit Gate (H-20),
// Wiedervorlage-Variante, Erledigt-Zeile mit „Rückgängig Z“.
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('./_testHilfe')).toastMock())

import { useUiStore } from '@/app/uiStore'
import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { TOAST } from '@/texte/de'
import type { QueueItem } from '@/types/domain'
import {
  ANTWORTEN,
  ICH,
  leadMitBezug,
  leadsSetzen,
  rendern,
  rpcAufrufe,
  SEQ_A,
  SEQ_TEL,
  T_INFO,
  T_JA,
  T_KF2,
  T_LF1,
  T_NOSHOW,
  T_TEL,
  taste,
  zeile,
  zuruecksetzen,
} from './_testHilfe'
import { ErledigtZeile } from './ErledigtZeile'
import { kartenZustand, useKartenStore } from './kartenStore'
import { HeuteKontext } from './kontext'
import { QueueKarte } from './QueueKarte'
import { useQueueAktionen, type AktionenKontext } from './useQueueAktionen'

const KF2 = SEQ_A.steps[2]!
const KF3 = SEQ_A.steps[3]!

function kontext(patch: Partial<AktionenKontext> = {}): AktionenKontext {
  return {
    heute: '2026-10-14',
    offen: () => 5,
    schritt: (id) => {
      const s = SEQ_A.steps.find((x) => x.id === id)
      return s ? { name: s.name, position: s.position, isOpener: s.is_opener, sequenceKey: SEQ_A.key } : null
    },
    markiereEigen: vi.fn(),
    onErledigt: vi.fn(),
    onAbgehakt: vi.fn(),
    istNeu: () => false,
    ...patch,
  }
}

function mitKontext(ui: ReactNode, ctx = kontext()) {
  return { ctx, ...rendern(<HeuteKontext.Provider value={ctx}>{ui}</HeuteKontext.Provider>) }
}

/** Taste der Seite (C/E/Enter) ohne HeuteSeite: ruft die Aktion so auf wie HeuteTasten. */
function SeitenTaste({ item, art }: { item: QueueItem; art: 'kopieren' | 'gesendet' | 'email' | 'anrufen' }) {
  const a = useQueueAktionen()
  const los = () => {
    if (art === 'kopieren') void a.kopieren(item)
    if (art === 'gesendet') void a.gesendet(item)
    if (art === 'email') a.emailOeffnen(item)
    if (art === 'anrufen') a.anrufen(item)
  }
  return (
    <button type="button" onClick={los}>
      Seitentaste {art}
    </button>
  )
}

const clipboard = () => vi.mocked(navigator.clipboard.writeText)

describe('QueueKarte', () => {
  beforeEach(() => {
    zuruecksetzen()
    useKartenStore.setState({ karten: {} })
    useUiStore.setState({ hotkeyScope: 'liste', scopeStack: [], letzterUndo: null })
    useAuth.setState({ status: 'mitglied', member: ICH })
    _akkordZuruecksetzen()
    localStorage.clear()
    vi.mocked(toast).mockClear()
    vi.mocked(toastUndo).mockClear()
    clipboard().mockClear()
    vi.mocked(supabase.rpc).mockClear()
  })

  it('kollabiert: nur Kopfzeile, Name und „Kurzfristig 2 vorbereitet“ – keine Aktionen', () => {
    const item = zeile('heute', 1, { title: 'Kurzfristig 2', subtitle: 'Tag 7 nach KF 1' })
    mitKontext(<QueueKarte item={item} aktiv={false} onAktion={vi.fn()} />)
    expect(screen.getByText('Kurzfristig 2 · Tag 7 nach KF 1')).toBeInTheDocument()
    expect(screen.getByText('Max Muster1')).toBeInTheDocument()
    expect(screen.getByText('Kurzfristig 2 vorbereitet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kopieren/ })).not.toBeInTheDocument()
  })

  it('kollabiert mit Realtime-Marker „neu“ (H-16)', () => {
    const item = zeile('heute', 1)
    mitKontext(<QueueKarte item={item} aktiv={false} onAktion={vi.fn()} />, kontext({ istNeu: () => true }))
    expect(screen.getByText('neu')).toBeInTheDocument()
  })

  it('H-03: C schreibt den vollständig gefüllten Text in die Zwischenablage, Toast + „kopiert 09:41“', async () => {
    leadsSetzen(leadMitBezug(1))
    const item = zeile('heute', 1, { template_id: T_KF2.id, step_id: KF2.id })
    const onAktion = vi.fn()
    mitKontext(<QueueKarte item={item} aktiv onAktion={onAktion} />)
    await screen.findByText('Muster1')
    expect(screen.getByText(/Leitfaden · Kurzfristig 2/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Kopieren/ }))
    await waitFor(() =>
      expect(clipboard()).toHaveBeenCalledWith('Hallo Herr Muster1, kurze Nachfrage zu Solar 01 GmbH.'),
    )
    expect(clipboard().mock.calls[0]?.[0]).not.toMatch(/\[/)
    expect(toast).toHaveBeenCalledWith(TOAST.kopiertErstesMal)
    expect(
      await screen.findByText(/kopiert \d\d:\d\d · jetzt in LinkedIn einfügen – dann E drücken\./),
    ).toBeInTheDocument()
    expect(onAktion).toHaveBeenCalledWith('kopieren')
    // zweites Kopieren am selben Tag: kurzer Toast
    fireEvent.click(screen.getByRole('button', { name: /Kopier/ }))
    await waitFor(() => expect(toast).toHaveBeenLastCalledWith(TOAST.kopiert))
  })

  it('H-04: offener Platzhalter [Reaktion] sperrt Kopieren; nach Eingabe steht der Wert im kopierten Text', async () => {
    leadsSetzen(leadMitBezug(2))
    const item = zeile('heute', 2, { template_id: T_JA.id, step_id: KF2.id })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    const feld = await screen.findByLabelText('Reaktion eintragen')
    expect(screen.getByText('Erst Reaktion eintragen')).toBeInTheDocument()
    expect(screen.getByLabelText('Erst Reaktion eintragen').querySelector('button')).toBeDisabled()
    expect(screen.getByText(/Platzhalter/)).toHaveTextContent('Platzhalter 2/3 gefüllt')
    fireEvent.change(feld, { target: { value: 'Rückfragen im Büro' } })
    const knopf = await screen.findByRole('button', { name: /Kopieren/ })
    await waitFor(() => expect(knopf).toBeEnabled())
    fireEvent.click(knopf)
    await waitFor(() =>
      expect(clipboard()).toHaveBeenCalledWith('Danke, Herr Muster2 – Rückfragen im Büro höre ich oft.'),
    )
  })

  it('H-05: E ruft complete_step(gesendet), nimmt die Karte optimistisch heraus und meldet „Erledigt – Kurzfristig 3 am …“', async () => {
    leadsSetzen(leadMitBezug(3))
    const item = zeile('heute', 3, { template_id: T_KF2.id, step_id: KF2.id, enrollment_id: 'enr-3' })
    ANTWORTEN.queue = [item]
    ANTWORTEN.rpc.complete_step = {
      data: { id: 'enr-3', status: 'aktiv', current_step_id: KF3.id, next_due_at: '2026-10-26T08:00:00Z' },
      error: null,
    }
    ANTWORTEN.activities = [
      { id: 901, lead_id: item.lead_id!, type: 'nachricht_gesendet', created_at: new Date().toISOString() },
    ]
    const { ctx } = mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await screen.findByText('Muster3')
    fireEvent.click(screen.getByRole('button', { name: /Gesendet/ }))
    await waitFor(() => expect(ctx.onErledigt).toHaveBeenCalled())
    expect(ctx.markiereEigen).toHaveBeenCalledWith(item.item_id)
    expect(rpcAufrufe(supabase.rpc)).toContainEqual([
      'complete_step',
      { p_enrollment_id: 'enr-3', p_outcome: 'gesendet', p_template_id: null },
    ])
    expect(ctx.onErledigt).toHaveBeenCalledWith(item.item_id, {
      art: 'erledigt',
      text: 'Kurzfristig 3 am Mo 26.10.',
      activityId: 901,
      name: 'Max Muster3',
    })
    expect(toastUndo).toHaveBeenCalledWith(TOAST.erledigt('Kurzfristig 3', 'Mo 26.10.', 4), 901)
  })

  it('H-19: Telefon-Karte – Skript als Stichpunkte, Anrufen öffnet den Anruf-Screen, Schnell-Ergebnis 1 → ?ergebnis=no_answer', async () => {
    leadsSetzen(leadMitBezug(4, { phone_e164: '+4940123456', call_basis: 'linkedin_vernetzt' }))
    const item = zeile('heute', 4, {
      channel: 'telefon',
      step_id: SEQ_TEL.steps[2]!.id,
      title: 'Versuch 3 von 5',
      subtitle: 'Slot C',
      template_id: T_TEL.id,
    })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    expect(await screen.findByText('Anlass nennen')).toBeInTheDocument()
    expect(screen.getByText(/Skript · Einstieg V1/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\+49/ })).toHaveAttribute('href', 'tel:+4940123456')
    fireEvent.click(await screen.findByRole('button', { name: /Anrufen/ }))
    expect(screen.getByTestId('ort')).toHaveTextContent(`/telefon/anruf/${item.lead_id}?zurueck=%2Fheute`)
    taste('1')
    expect(screen.getByTestId('ort')).toHaveTextContent(
      `/telefon/anruf/${item.lead_id}?ergebnis=no_answer&zurueck=%2Fheute`,
    )
  })

  it('Telefon-Karte ohne Anrufgrund: Anrufen gesperrt (auch über die Seitentaste ↵)', async () => {
    leadsSetzen(leadMitBezug(5, { phone_e164: '+4940123456', call_basis: null }))
    const item = zeile('heute', 5, { channel: 'telefon', template_id: T_TEL.id })
    mitKontext(
      <>
        <QueueKarte item={item} aktiv onAktion={vi.fn()} />
        <SeitenTaste item={item} art="anrufen" />
      </>,
    )
    expect(await screen.findByText('Kein Anrufgrund')).toBeInTheDocument()
    await waitFor(() => expect(kartenZustand(item.item_id!).gesperrt).toBe('Nummer ohne Anrufgrund'))
    fireEvent.click(screen.getByRole('button', { name: 'Seitentaste anrufen' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/heute')
    expect(toast).toHaveBeenCalledWith('Nummer ohne Anrufgrund.')
  })

  it('Telefon-Karte ohne Anrufgrund: Schnell-Ergebnis-Knöpfe und 1/2/3/7 gesperrt – kein Weg in den Anruf-Screen (Review)', async () => {
    leadsSetzen(leadMitBezug(5, { phone_e164: '+4940123456', call_basis: null }))
    const item = zeile('heute', 5, { channel: 'telefon', template_id: T_TEL.id })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    expect(await screen.findByText('Kein Anrufgrund')).toBeInTheDocument()
    const gruppe = await screen.findByRole('group', { name: 'Schnell-Ergebnis' })
    await waitFor(() => {
      for (const b of gruppe.querySelectorAll('button')) expect(b).toBeDisabled()
    })
    taste('1')
    taste('7')
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/heute$/)
  })

  it('Peek (kontext peek): die Karte bindet C und E selbst – Kopieren und Gesendet wirken auf diesen Lead (Review)', async () => {
    leadsSetzen(leadMitBezug(3))
    const item = zeile('heute', 3, { template_id: T_KF2.id, step_id: KF2.id, enrollment_id: 'enr-3' })
    ANTWORTEN.queue = [item]
    ANTWORTEN.rpc.complete_step = {
      data: { id: 'enr-3', status: 'aktiv', current_step_id: KF3.id, next_due_at: '2026-10-26T08:00:00Z' },
      error: null,
    }
    const onAktion = vi.fn()
    mitKontext(<QueueKarte item={item} aktiv kontext="peek" onAktion={onAktion} />)
    await screen.findByText('Muster3')
    await waitFor(() => expect(screen.getByRole('button', { name: /Kopieren/ })).toBeEnabled())
    taste('c')
    await waitFor(() =>
      expect(clipboard()).toHaveBeenCalledWith('Hallo Herr Muster3, kurze Nachfrage zu Solar 03 GmbH.'),
    )
    taste('e')
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toContainEqual([
        'complete_step',
        { p_enrollment_id: 'enr-3', p_outcome: 'gesendet', p_template_id: null },
      ]),
    )
    expect(onAktion).toHaveBeenCalledWith('kopieren')
    expect(onAktion).toHaveBeenCalledWith('gesendet')
  })

  it('H-20: E-Mail-Karte ohne Erlaubnis zeigt den Tooltip-Text und sperrt ↵/C', async () => {
    leadsSetzen(leadMitBezug(6, { email: 'max@beispiel.de', email_consent_basis: 'none' }))
    const item = zeile('heute', 6, { channel: 'email', template_id: T_INFO.id, step_id: null })
    mitKontext(
      <>
        <QueueKarte item={item} aktiv onAktion={vi.fn()} />
        <SeitenTaste item={item} art="email" />
        <SeitenTaste item={item} art="kopieren" />
      </>,
    )
    const grund =
      'Keine Erlaubnis-Grundlage. Trag ein, wann und wie Max um die Mail gebeten hat – oder frag erst auf LinkedIn/am Telefon.'
    expect(await screen.findByText('Kurzinfo für Solar 06 GmbH')).toBeInTheDocument()
    await waitFor(() => expect(kartenZustand(item.item_id!).gesperrt).toBe(grund))
    const huellen = screen.getAllByLabelText(grund)
    expect(huellen.length).toBeGreaterThanOrEqual(2) // In Gmail öffnen + Kopieren (+ Gesendet)
    for (const h of huellen) expect(h.querySelector('button')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Seitentaste email' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seitentaste kopieren' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(grund))
    expect(screen.getByTestId('ort')).toHaveTextContent('/heute')
    expect(clipboard()).not.toHaveBeenCalled()
  })

  it('E-Mail-Karte mit Erlaubnis: ↵ öffnet den Composer mit lead/schritt/enrollment/zurueck', async () => {
    leadsSetzen(
      leadMitBezug(7, {
        email: 'max@beispiel.de',
        email_consent_basis: 'requested_linkedin',
        email_consent_at: new Date().toISOString(),
      }),
    )
    const item = zeile('heute', 7, {
      channel: 'email',
      template_id: T_INFO.id,
      step_id: 'st-1',
      enrollment_id: 'enr-7',
    })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /In Gmail öffnen/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /In Gmail öffnen/ }))
    expect(screen.getByTestId('ort')).toHaveTextContent(
      `/email/verfassen?lead=${item.lead_id}&zurueck=%2Fheute&schritt=st-1&enrollment=enr-7`,
    )
  })

  it('E-Mail-Karte mit Transaktions-Vorlage (No-Show N0) braucht keine Erlaubnis (H-24, M-12)', async () => {
    leadsSetzen(leadMitBezug(8, { email: 'max@beispiel.de', email_consent_basis: 'none' }))
    const item = zeile('heute', 8, { channel: 'email', template_id: T_NOSHOW.id })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /In Gmail öffnen/ })).toBeEnabled())
    expect(kartenZustand(item.item_id!).gesperrt).toBeNull()
  })

  it('Wiedervorlage-Karte: Vorlage „Langfristig 1“ und „Weiter Wiedervorlage (+3 Monate)“ mit W', async () => {
    leadsSetzen(leadMitBezug(9, { ended_reason: 'kein_bedarf' }))
    const item = zeile('heute', 9, {
      item_kind: 'wiedervorlage',
      enrollment_id: null,
      task_id: 'task-9',
      template_id: T_LF1.id,
      title: 'Wiedervorlage',
      subtitle: 'Grund: kein Bedarf',
    })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    expect(await screen.findByText(/Leitfaden · Langfristig 1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weiter Wiedervorlage \(\+3 Monate\)/ })).toBeInTheDocument()
    taste('w')
    expect(await screen.findByText('Datum')).toBeInTheDocument()
  })

  it('Firmensperre: Karte zeigt die Sperre, Gesendet ist gesperrt', async () => {
    leadsSetzen(leadMitBezug(10, { companies: { do_not_contact: true } as never }))
    const item = zeile('heute', 10, { template_id: T_KF2.id })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await waitFor(() => expect(kartenZustand(item.item_id!).gesperrt).toBe('Firma gesperrt – nicht anschreiben'))
    for (const h of screen.getAllByLabelText('Firma gesperrt – nicht anschreiben'))
      expect(h.querySelector('button')).toBeDisabled()
  })
})

describe('QueueKarte – M0-Aktionen auf der Karte', () => {
  beforeEach(() => {
    zuruecksetzen()
    useKartenStore.setState({ karten: {} })
    useUiStore.setState({ hotkeyScope: 'liste', scopeStack: [], letzterUndo: null })
    useAuth.setState({ status: 'mitglied', member: ICH })
    _akkordZuruecksetzen()
  })

  it('H-08: beim dritten S auf demselben Schritt kommt „Dreimal verschoben – beenden oder Wiedervorlage?“', async () => {
    leadsSetzen(leadMitBezug(1))
    const item = zeile('heute', 1, { template_id: T_KF2.id, snooze_count: 3, enrollment_id: 'enr-1' })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await screen.findByText(/Leitfaden · Kurzfristig 2/)
    taste('s')
    expect(await screen.findByText('Dreimal verschoben – beenden oder Wiedervorlage?')).toBeInTheDocument()
  })

  it('H-07: S öffnet „Später“ 1–5/D; H-09: A öffnet „Antwort erhalten“ mit Reaktions-Chips', async () => {
    leadsSetzen(leadMitBezug(1))
    const item = zeile('heute', 1, { template_id: T_KF2.id, snooze_count: 0, enrollment_id: 'enr-1' })
    mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
    await screen.findByText(/Leitfaden · Kurzfristig 2/)
    taste('s')
    expect(await screen.findByRole('menu', { name: 'Später' })).toBeInTheDocument()
    taste('Escape')
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Später' })).not.toBeInTheDocument())
    taste('a')
    expect(await screen.findByRole('group', { name: 'Reaktion' })).toBeInTheDocument()
  })

  it('MO-02: unter 768 px vier gleich breite Buttons Kopieren · Gesendet · Später · Mehr, ohne Kbd', async () => {
    const vorher = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('max-width: 767px'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      leadsSetzen(leadMitBezug(1))
      const item = zeile('heute', 1, { template_id: T_KF2.id })
      mitKontext(<QueueKarte item={item} aktiv onAktion={vi.fn()} />)
      const gruppe = await screen.findByRole('group', { name: 'Aktionen' })
      expect(gruppe).toHaveClass('grid-cols-4')
      expect([...gruppe.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
        'Kopieren',
        'Gesendet',
        'Später',
        'Mehr',
      ])
      expect(gruppe.querySelector('kbd')).toBeNull()
    } finally {
      window.matchMedia = vorher
    }
  })
})

describe('ErledigtZeile', () => {
  it('„Erledigt · Name · Kurzfristig 3 am Sa 24.10.“ mit Rückgängig Z, solange das Undo-Fenster offen ist', () => {
    useUiStore.setState({ letzterUndo: { activityId: 5, label: 'x' } })
    rendern(<ErledigtZeile art="erledigt" name="Max Muster" text="Kurzfristig 3 am Sa 24.10." activityId={5} />)
    const z = screen.getByText('Erledigt').closest('[data-erledigt]')
    expect(z).toHaveTextContent('ErledigtMax Muster · Kurzfristig 3 am Sa 24.10.')
    expect(screen.getByRole('button', { name: /Rückgängig/ })).toBeInTheDocument()
    act(() => useUiStore.setState({ letzterUndo: null }))
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).not.toBeInTheDocument()
  })

  it('Später- und Fremd-Varianten', () => {
    rendern(
      <>
        <ErledigtZeile art="spaeter" text="morgen, Do 15.10." />
        <ErledigtZeile art="fremd" name="Max" text="von Mike um 10:41" />
      </>,
    )
    const z = [...document.querySelectorAll('[data-erledigt]')]
    expect(z[0]).toHaveTextContent('Später')
    expect(z[0]).toHaveAttribute('data-erledigt', 'spaeter')
    expect(z[1]).toHaveTextContent('Schon erledigtMax · von Mike um 10:41')
  })
})
