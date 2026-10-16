// LeadPanel.test.tsx (ux § 3.3, § 8.5, DESIGN-SYSTEM § 5.11): Zustände Laden · nicht gefunden · Standard · Beendet (Reaktivieren) ·
// Queue-Karte (LD-02) · Firmensperre (LE-17) · Telefon-Gate (LD-03) · E-Mail-Gate-Tooltip (LD-04) · „beide angefragt“ (LD-08) ·
// Übergeben ohne Notiz nicht möglich (LD-09) · Phase-Chip editierbar (LD-01) · Mobil-Aktionszeile.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/data/supabase'
import { queueItem } from '@/test/fixtures/queue'
import { GATE_GRUND_LABEL } from '@/texte/de'
import {
  DB,
  FIRMA_GESPERRT,
  MEMBER_M,
  MEMBER_V,
  erstesArg,
  leadMitBezug,
  rendern,
  zugriffeMit,
  zuruecksetzen,
} from './_testHilfe'
import { LeadPanel, PeekKopfAktionen } from './public'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 'undo'),
}))

const ID = '10000000-0000-4000-8000-000000000001'
// Wie PeekOutlet: die Kopf-Aktionen sitzen in der Kopfzeile des PeekPanel (kopfRechts), das Panel darunter
const panel = () =>
  rendern(
    <>
      <PeekKopfAktionen leadId={ID} />
      <LeadPanel leadId={ID} />
    </>,
    { route: `/leads?lead=${ID}` },
  )

describe('LeadPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
  })
  afterEach(() => vi.useRealTimers())

  it('nicht gefunden', async () => {
    panel()
    expect(await screen.findByText('Lead nicht (mehr) vorhanden.')).toBeInTheDocument()
  })

  it('Kopf: Name, Unternehmen · Rolle · Ort, Phase-Chip, #ID; „Keine Sequenz aktiv“ mit Sequenz starten/Wiedervorlage/Beenden', async () => {
    DB.details = [leadMitBezug(1, { full_name: 'Anna Amsel', stage: 'gespraech_eroeffnet' })]
    panel()
    expect(await screen.findByRole('heading', { name: 'Anna Amsel' })).toBeInTheDocument()
    expect(screen.getByText('Solar 01 GmbH · Geschäftsführer · Hamburg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phase: Eröffnet – ändern/ })).toBeInTheDocument()
    const ns = document.querySelector('[data-naechster-schritt="keine"]') as HTMLElement
    expect(ns).toHaveTextContent('Keine Sequenz aktiv')
    expect(within(ns).getByRole('button', { name: /Wiedervorlage/ })).toBeInTheDocument()
    expect(within(ns).getByRole('button', { name: /Beenden/ })).toBeInTheDocument()
    expect(await screen.findByText('Noch nichts passiert.')).toBeInTheDocument()
  })

  it('Phase-Chip per Klick: Eröffnet → Beantwortet speichert sofort (LD-01)', async () => {
    DB.details = [leadMitBezug(1, { stage: 'gespraech_eroeffnet' })]
    panel()
    fireEvent.click(await screen.findByRole('button', { name: /Phase: Eröffnet – ändern/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Beantwortet' }))
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({ stage: 'dm_beantwortet' })
  })

  it('Beendet: „Beendet · Kein Bedarf · Datum · Reaktivieren“', async () => {
    DB.details = [
      leadMitBezug(1, { stage: 'beendet', ended_reason: 'kein_bedarf', ended_at: '2026-10-12T09:00:00+02:00' }),
    ]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    const ns = await waitFor(() => {
      const el = document.querySelector('[data-naechster-schritt="beendet"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(ns).toHaveTextContent('Kein Bedarf · 12.10.2026')
    fireEvent.click(within(ns).getByRole('button', { name: 'Reaktivieren' }))
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toMatchObject({
      stage: 'vernetzt',
      ended_reason: null,
    })
  })

  it('Nächster Schritt = Queue-Karte aus heute/public (LD-02)', async () => {
    DB.details = [leadMitBezug(1, { owner_id: MEMBER_V })]
    DB.queue = [queueItem('heute', 0, { lead_id: ID, member_id: MEMBER_V })]
    panel()
    await waitFor(() => expect(document.querySelector('[data-naechster-schritt="karte"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: /Jetzt vorbereiten/ })).toBeInTheDocument()
  })

  it('Firma gesperrt: Chip im Kopf, Anrufen/E-Mail/Anfrage gesperrt mit Tooltip, kein „Sequenz starten“ (LE-17)', async () => {
    DB.details = [
      leadMitBezug(1, {
        companies: FIRMA_GESPERRT,
        phone_e164: '+4940123456',
        call_basis: 'linkedin_vernetzt',
        email: 'a@beispiel.de',
        email_consent_basis: 'requested_linkedin',
        email_consent_at: '2026-10-05T09:00:00+02:00',
      }),
    ]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    expect(screen.getAllByText('Firma gesperrt').length).toBeGreaterThan(0)
    const grund = GATE_GRUND_LABEL.firma_gesperrt
    expect(screen.getAllByLabelText(grund).length).toBeGreaterThanOrEqual(3) // Anrufen · E-Mail · Antwort/Anfrage
    const ns = document.querySelector('[data-naechster-schritt="keine"]') as HTMLElement
    expect(within(ns).queryByRole('button', { name: /Sequenz starten/ })).toBeNull()
    // § 8.4: Historie ist kein Kontakt – Antworten loggen bleibt bei Firmensperre möglich (Review)
    const li = document.querySelector('[data-kanal="linkedin"]') as HTMLElement
    expect(within(li).getByRole('button', { name: /Antwort erhalten/ })).toBeEnabled()
    expect(within(li).getByRole('button', { name: /Nachricht gesendet/ })).toBeDisabled()
  })

  it('Telefon-Karte: mit Nummer anrufbar, auch ohne Anrufgrund (Cold Calling); INFO-Regel ab Erstgespräch', async () => {
    DB.details = [leadMitBezug(1, { phone_e164: '+4940123456', call_basis: null, stage: 'erstgespraech_vereinbart' })]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    const kopf = screen.getByRole('toolbar', { name: 'Lead-Aktionen' })
    expect(within(kopf).queryByLabelText(GATE_GRUND_LABEL.kein_anrufgrund)).toBeNull()
    fireEvent.click(
      within(document.querySelector('[data-kanal="telefon"]') as HTMLElement).getAllByRole('button')[0] as HTMLElement,
    )
    const karte = document.querySelector('[data-kanal="telefon"]') as HTMLElement
    expect(within(karte).getByText('Bereit · ohne Anrufgrund')).toBeInTheDocument()
    expect(karte).toHaveTextContent('INFO-Regel: Follow-ups bevorzugt telefonisch – Anrufgrund setzen')
  })

  it('Kopf-Aktionen liegen nicht mehr im Panel, sondern im Slot der Peek-Kopfzeile (DESIGN-SYSTEM § 5.11)', async () => {
    DB.details = [leadMitBezug(1, { phone_e164: '+4940123456', call_basis: 'linkedin_vernetzt' })]
    rendern(<LeadPanel leadId={ID} />, { route: `/leads?lead=${ID}` })
    await screen.findByRole('heading', { name: 'Test Person 01' })
    expect(screen.queryByRole('toolbar', { name: 'Lead-Aktionen' })).toBeNull()
  })

  it('Felder: LinkedIn-URL patcht nur linkedin_url (linkedin_url_norm ist generiert) – Review', async () => {
    DB.details = [leadMitBezug(1)]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn bearbeiten' }))
    const feld = await screen.findByRole('textbox', { name: 'LinkedIn' })
    fireEvent.change(feld, { target: { value: 'https://www.linkedin.com/in/neu-profil/' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({
      linkedin_url: 'https://www.linkedin.com/in/neu-profil/',
    })
  })

  it('Felder: Unternehmen verknüpft die Firma (company_id), sonst setzt der Trigger den alten Namen zurück – Review', async () => {
    DB.details = [leadMitBezug(1)]
    DB.companies = [{ ...FIRMA_GESPERRT, name_norm: 'sperrfirma energie' }]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    fireEvent.click(screen.getByRole('button', { name: 'Unternehmen bearbeiten' }))
    const feld = await screen.findByRole('textbox', { name: 'Unternehmen' })
    fireEvent.change(feld, { target: { value: 'Sperrfirma Energie' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({
      company_id: FIRMA_GESPERRT.id,
      company_name: 'Sperrfirma Energie',
    })
  })

  it('Felder: „Nächster Follow-up“ verschiebt den Sequenzschritt (snooze_step), kein next_action_at-Patch – Review', async () => {
    DB.details = [
      leadMitBezug(1, {
        next_action_at: '2026-10-15T07:00:00.000Z',
        next_action_kind: 'sequenz_schritt',
        next_action_ref: 'enr-9',
      }),
    ]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Follow-up bearbeiten' }))
    const feld = await screen.findByRole('textbox', { name: 'Nächster Follow-up' })
    fireEvent.change(feld, { target: { value: '+3' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalled())
    expect(vi.mocked(supabase.rpc).mock.calls.at(-1)?.[0]).toBe('snooze_step')
    expect(vi.mocked(supabase.rpc).mock.calls.at(-1)?.[1]).toMatchObject({ p_enrollment_id: 'enr-9' })
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
  })

  it('Telefon bereit: Anrufen im Kopf aktiv', async () => {
    DB.details = [leadMitBezug(1, { phone_e164: '+4940123456', call_basis: 'linkedin_vernetzt' })]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    expect(screen.getByRole('button', { name: 'Anrufen (⌘⇧K)' })).not.toBeDisabled()
  })

  it('E-Mail ohne Grundlage: „E-Mail verfassen“ gesperrt mit Tooltip aus ux § 3.3.3 (LD-04)', async () => {
    DB.details = [leadMitBezug(1, { first_name: 'Anna', email: 'anna@beispiel.de', email_consent_basis: 'none' })]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    expect(
      screen.getAllByLabelText(
        'Keine Erlaubnis-Grundlage. Trag ein, wann und wie Anna um die Mail gebeten hat – oder frag erst auf LinkedIn/am Telefon.',
      ).length,
    ).toBeGreaterThan(0)
  })

  it('zwei Anfragen aus dem Import: Badge „beide angefragt“ und beide Daten (LD-08)', async () => {
    DB.details = [
      leadMitBezug(1, {
        linkedin_connections: [
          {
            id: 'c1',
            member_id: MEMBER_V,
            requested_at: '2026-09-01T09:00:00+02:00',
            status: 'ausstehend',
            note_variant: 'ohne',
            created_at: '2026-09-01T09:00:00+02:00',
          },
          {
            id: 'c2',
            member_id: MEMBER_M,
            requested_at: '2026-09-03T09:00:00+02:00',
            status: 'ausstehend',
            note_variant: 'ohne',
            created_at: '2026-09-03T09:00:00+02:00',
          },
        ] as never,
      }),
    ]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    const karte = document.querySelector('[data-kanal="linkedin"]') as HTMLElement
    expect(within(karte).getByText('beide angefragt')).toBeInTheDocument()
    await waitFor(() => expect(karte).toHaveTextContent('Vincent · 01.09.2026'))
    expect(karte).toHaveTextContent('Mike · 03.09.2026')
  })

  it('Übergeben ohne Notiz ist nicht möglich (LD-09)', async () => {
    DB.details = [leadMitBezug(1, { owner_id: MEMBER_V })]
    panel()
    const knopf = await screen.findByRole('button', { name: /An Mike übergeben/ })
    await waitFor(() => expect(knopf).not.toBeDisabled())
    fireEvent.click(knopf)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^Übergeben/ }))
    expect(await within(dialog).findByText('Notiz ist Pflicht.')).toBeInTheDocument()
    expect(vi.mocked(supabase.rpc).mock.calls.some((c) => c[0] === 'transfer_lead')).toBe(false)
  })

  it('Mobil-Aktionszeile: Anrufen · LinkedIn · E-Mail · Notiz', async () => {
    DB.details = [leadMitBezug(1)]
    panel()
    await screen.findByRole('heading', { name: 'Test Person 01' })
    const zeile = document.querySelector('[data-mobil-aktionen]') as HTMLElement
    expect(zeile.textContent).toBe('AnrufenLinkedInE-MailNotiz')
  })
})
