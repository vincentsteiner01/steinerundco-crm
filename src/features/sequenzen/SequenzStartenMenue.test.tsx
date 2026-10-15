// SequenzStartenMenue.test.tsx (BAUPLAN § 3.2, SE-02, § 5.1): Menü kanalgültiger Sequenzen → rpc.enroll mit Key aus den Daten;
// inaktive („A alt“) ausgegraut mit „in Einstellungen aktivieren“; laufende Sequenz im Kanal sperrt mit Hinweis „Schritt 3/6“;
// Firmensperre sperrt das ganze Menü; SequenzStatus-Chip.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/features/heute/_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('@/features/heute/_testHilfe')).toastMock())

import { toast, toastUndo } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import {
  ANTWORTEN,
  ICH,
  leadMitBezug,
  leadsSetzen,
  rendern,
  rpcAufrufe,
  SEQ_A,
  SEQ_A_ALT,
  SEQ_C,
  zuruecksetzen,
} from '@/features/heute/_testHilfe'
import { fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { naechsteFaelligkeit } from './planer'
import { SequenzStartenMenue } from './SequenzStartenMenue'
import { SequenzStatus } from './SequenzStatus'

const LEAD = leadMitBezug(1)

async function menueOeffnen() {
  await screen.findByRole('button', { name: /Sequenz starten/ })
  await waitFor(() => expect(screen.getByRole('button', { name: /Sequenz starten/ })).toBeEnabled())
  fireEvent.keyDown(screen.getByRole('button', { name: /Sequenz starten/ }), { key: 'Enter' })
  return screen.findByRole('menu')
}

describe('SequenzStartenMenue', () => {
  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: ICH })
    leadsSetzen(LEAD)
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(toast).mockClear()
    vi.mocked(toastUndo).mockClear()
  })

  it('listet die Sequenzen des Kanals; SE-02: „A alt“ ausgegraut mit „in Einstellungen aktivieren“', async () => {
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="linkedin" />)
    const menu = await menueOeffnen()
    const items = await within(menu).findAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'LinkedIn Standard · LinkedIn',
      'Nachfassen im Gespräch · LinkedIn',
      'A alt · LinkedIn – in Einstellungen aktivieren',
    ])
    expect(items[2]).toHaveAttribute('data-disabled')
    expect(items[0]).not.toHaveAttribute('data-disabled')
    expect(within(menu).getByText('Sequenz starten · eine aktive je Kanal')).toBeInTheDocument()
  })

  it('SE-02: nach Aktivieren in den Einstellungen ist „A alt“ wählbar', async () => {
    ANTWORTEN.sequenzen = [SEQ_A, { ...SEQ_A_ALT, active: true }]
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="linkedin" />)
    const menu = await menueOeffnen()
    const alt = (await within(menu).findAllByRole('menuitem')).find((i) => i.textContent?.startsWith('A alt'))!
    expect(alt).not.toHaveAttribute('data-disabled')
    expect(alt).toHaveTextContent('A alt · LinkedIn')
  })

  it('Auswahl startet die Sequenz über enroll (Key aus den Daten) und meldet den ersten Termin', async () => {
    const onGestartet = vi.fn()
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="linkedin" onGestartet={onGestartet} />)
    const menu = await menueOeffnen()
    fireEvent.click(await within(menu).findByText('Nachfassen im Gespräch · LinkedIn'))
    await waitFor(() => expect(onGestartet).toHaveBeenCalled())
    expect(rpcAufrufe(supabase.rpc)).toEqual([
      ['enroll', { p_lead_id: LEAD.id, p_sequence_key: SEQUENZ.linkedin_nachfassen_im_gespraech }],
    ])
    const erster = fmtDatumKurz(naechsteFaelligkeit(heuteBerlin(), 3, true, ANTWORTEN.settings.feiertage as string[]))
    expect(toast).toHaveBeenCalledWith(`Sequenz ‚Nachfassen im Gespräch‘ gestartet · Nachfassen 1 am ${erster}.`)
    // kein Undo: ein einzelnes sequenz_gestartet ist nicht rückgängig zu machen (F-06)
    expect(toastUndo).not.toHaveBeenCalled()
  })

  it('läuft bereits eine Sequenz im Kanal: Einträge gesperrt mit „‚LinkedIn Standard‘ läuft bereits (Schritt 3/6)“', async () => {
    ANTWORTEN.enrollments = [
      { id: 'e1', lead_id: LEAD.id, channel: 'linkedin', status: 'aktiv', sequence_id: SEQ_A.id, current_position: 3 },
    ]
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="linkedin" />)
    const menu = await menueOeffnen()
    await waitFor(() =>
      expect(within(menu).getAllByRole('menuitem')[1]).toHaveTextContent(
        'Nachfassen im Gespräch · LinkedIn – Eine aktive Sequenz je Kanal: ‚LinkedIn Standard‘ läuft bereits (Schritt 3/6)',
      ),
    )
    for (const i of within(menu).getAllByRole('menuitem')) expect(i).toHaveAttribute('data-disabled')
  })

  it('ohne Kanal: alle Sequenzen; eine laufende LinkedIn-Sequenz sperrt Telefon/E-Mail nicht', async () => {
    ANTWORTEN.sequenzen = [SEQ_A, SEQ_C, ...ANTWORTEN.sequenzen.filter((s) => s.channel !== 'linkedin')]
    ANTWORTEN.enrollments = [
      { id: 'e1', lead_id: LEAD.id, channel: 'linkedin', status: 'aktiv', sequence_id: SEQ_A.id, current_position: 2 },
    ]
    rendern(<SequenzStartenMenue leadId={LEAD.id} />)
    const menu = await menueOeffnen()
    const tel = (await within(menu).findAllByRole('menuitem')).find((i) =>
      i.textContent?.startsWith('Telefon-Standard'),
    )!
    await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toHaveAttribute('data-disabled'))
    expect(tel).not.toHaveAttribute('data-disabled')
  })

  it('M-13: E-Mail-Sequenzen – No-Show ohne Grundlage startbar, ohne Grundlage sonst gesperrt mit Grund', async () => {
    leadsSetzen(leadMitBezug(1, { email: 'max@beispiel.de', email_consent_basis: 'none' }))
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="email" />)
    const menu = await menueOeffnen()
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: /No-Show Erstgespräch/ })).not.toHaveAttribute('data-disabled'),
    )
    fireEvent.click(within(menu).getByRole('menuitem', { name: /No-Show Erstgespräch/ }))
    await waitFor(() =>
      expect(rpcAufrufe(supabase.rpc)).toEqual([
        ['enroll', { p_lead_id: LEAD.id, p_sequence_key: SEQUENZ.email_noshow_erstgespraech }],
      ]),
    )
  })

  it('Firmensperre: das ganze Menü ist gesperrt (kontaktGate)', async () => {
    leadsSetzen(leadMitBezug(1, { companies: { do_not_contact: true } as never }))
    rendern(<SequenzStartenMenue leadId={LEAD.id} kanal="linkedin" />)
    await waitFor(() =>
      expect(screen.getByLabelText('Firma gesperrt – nicht anschreiben').querySelector('button')).toBeDisabled(),
    )
  })
})

describe('SequenzStatus', () => {
  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: ICH })
  })

  it('ohne laufende Sequenz nichts', async () => {
    const { container } = rendern(<SequenzStatus leadId={LEAD.id} kanal="linkedin" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toBe('/heute')
  })

  it('aktiv: „LinkedIn Standard · Schritt 3/6 · nächster …“', async () => {
    ANTWORTEN.enrollments = [
      {
        id: 'e1',
        lead_id: LEAD.id,
        channel: 'linkedin',
        status: 'aktiv',
        sequence_id: SEQ_A.id,
        current_position: 3,
        next_due_at: '2026-10-26T08:00:00Z',
      },
    ]
    rendern(<SequenzStatus leadId={LEAD.id} kanal="linkedin" />)
    expect(await screen.findByText('LinkedIn Standard · Schritt 3/6 · nächster Mo 26.10.')).toBeInTheDocument()
  })

  it('Ruht: LinkedIn Position 5/6 mit Termin in der Zukunft → „Ruht bis 14.01.“-Chip', async () => {
    ANTWORTEN.enrollments = [
      {
        id: 'e1',
        lead_id: LEAD.id,
        channel: 'linkedin',
        status: 'aktiv',
        sequence_id: SEQ_A.id,
        current_position: 5,
        next_due_at: '2099-01-14T08:00:00Z',
      },
    ]
    rendern(<SequenzStatus leadId={LEAD.id} kanal="linkedin" />)
    expect(await screen.findByText(/^Ruht bis \S+ 14\.01\./)).toBeInTheDocument()
  })

  it('pausiert', async () => {
    ANTWORTEN.enrollments = [
      {
        id: 'e1',
        lead_id: LEAD.id,
        channel: 'telefon',
        status: 'pausiert',
        sequence_id: SEQ_A.id,
        current_position: 2,
      },
    ]
    rendern(<SequenzStatus leadId={LEAD.id} kanal="telefon" />)
    expect(await screen.findByText('LinkedIn Standard · pausiert')).toBeInTheDocument()
  })
})
