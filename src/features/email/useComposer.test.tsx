// useComposer.test.ts (BAUPLAN § 3.5): Statusfolge draft → opened_in_client → sent_confirmed, Sequenzschritt erledigt (M-06),
// Nein lässt den Entwurf (M-10), Re:-Betreff (M-11), Trigger-Fehler beim Bestätigen (M-14), Vorlagen-Filter, Pflichtbausteine.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
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

import { toast, toastFehler } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import {
  ANTWORTEN,
  email,
  ENROLLMENT_ID,
  LEAD_ID,
  leadMitErlaubnis,
  letzterEmailZugriff,
  VORLAGE_INFO,
  VORLAGE_NOSHOW,
  VORLAGE_ZUSAMMENFASSUNG,
  zuruecksetzen,
} from './_testHilfe'
import {
  anredeName,
  bausteine,
  bodyZusammensetzen,
  passenderEntwurf,
  threadMails,
  useComposer,
  vorlageErlaubt,
} from './useComposer'

function huelle() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const bereit = async (params: Parameters<typeof useComposer>[0]) => {
  const r = renderHook(() => useComposer(params), { wrapper: huelle() })
  await waitFor(() => expect(r.result.current.status).toBe('bearbeiten'))
  await waitFor(() => expect(r.result.current.vorlage).not.toBeNull())
  await waitFor(() => expect(r.result.current.me).not.toBeNull())
  return r
}

describe('useComposer', () => {
  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { id: ENROLLMENT_ID }, error: null } as never)
    vi.mocked(toast).mockClear()
    vi.mocked(toastFehler).mockClear()
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('Statusfolge draft → opened_in_client → sent_confirmed; Sequenzschritt erledigt (M-05, M-06)', async () => {
    const onFertig = vi.fn()
    const r = await bereit({ leadId: LEAD_ID, enrollmentId: ENROLLMENT_ID, onFertig })
    expect(r.result.current.vorlage?.id).toBe(VORLAGE_INFO.id)
    expect(r.result.current.betreff).toBe('Kurzinfo für Solar 01 GmbH')
    expect(r.result.current.text).toContain('Hallo Herr Lindner,')
    expect(r.result.current.text).toContain('Vincent')
    expect(r.result.current.offen).toEqual([])
    expect(r.result.current.sperrGrund).toBeNull()

    let ergebnis: string | undefined
    await act(async () => {
      ergebnis = await r.result.current.inGmailOeffnen()
    })
    expect(ergebnis).toBe('geoeffnet')
    const insert = letzterEmailZugriff('insert')
    expect(insert).toMatchObject({
      lead_id: LEAD_ID,
      direction: 'out',
      status: 'draft',
      enrollment_id: ENROLLMENT_ID,
      template_id: VORLAGE_INFO.id,
      to_address: 'tobias.lindner@beispiel.de',
      from_address: 'vincent@steinerundco.de',
    })
    expect(letzterEmailZugriff('update')).toMatchObject({ status: 'opened_in_client', channel: 'gmail_compose' })
    const url = vi.mocked(window.open).mock.calls[0]?.[0] as string
    expect(url).toContain('view=cm')
    expect(url).toContain('authuser=vincent%40steinerundco.de')
    expect(url).toContain('to=tobias.lindner%40beispiel.de')
    expect(url).toContain('body=Hallo%20Herr%20Lindner%2C%0A')
    expect(r.result.current.status).toBe('geoeffnet')

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(r.result.current.status).toBe('bestaetigen')
    expect(r.result.current.anredeName).toBe('Herrn Lindner')

    await act(async () => {
      await r.result.current.gesendetJa()
    })
    expect(letzterEmailZugriff('update')).toMatchObject({ status: 'sent_confirmed' })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_step',
      expect.objectContaining({
        p_enrollment_id: ENROLLMENT_ID,
        p_outcome: 'gesendet',
        p_template_id: VORLAGE_INFO.id,
      }),
      undefined,
    )
    expect(toast).toHaveBeenCalledWith('E-Mail gesendet · Infomail.')
    expect(r.result.current.status).toBe('fertig')
    expect(onFertig).toHaveBeenCalled()
  })

  it('„Nein“ lässt den Entwurf als opened_in_client stehen (M-10)', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    await act(async () => {
      await r.result.current.inGmailOeffnen()
    })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(r.result.current.status).toBe('bestaetigen')
    const anzahl = ANTWORTEN.emailSchreibzugriffe.length
    act(() => r.result.current.gesendetNein())
    expect(r.result.current.status).toBe('bearbeiten')
    expect(ANTWORTEN.emailSchreibzugriffe.length).toBe(anzahl)
    expect(r.result.current.entwurfId).toBe('m-neu')
    expect(supabase.rpc).not.toHaveBeenCalledWith('complete_step', expect.anything(), undefined)
  })

  it('ohne Enrollment: kein complete_step', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    await act(async () => {
      await r.result.current.inGmailOeffnen()
    })
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => {
      await r.result.current.gesendetJa()
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('Trigger-Fehler beim Bestätigen → Fehler-Toast mit DB-Text, Status bleibt „bestaetigen“ (M-14)', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    await act(async () => {
      await r.result.current.inGmailOeffnen()
    })
    act(() => window.dispatchEvent(new Event('focus')))
    ANTWORTEN.emailsFehler = {
      code: 'P0001',
      message: 'Keine Erlaubnis-Grundlage – die E-Mail darf nicht als gesendet verbucht werden',
    }
    let ok: boolean | undefined
    await act(async () => {
      ok = await r.result.current.gesendetJa()
    })
    expect(ok).toBe(false)
    expect(toastFehler).toHaveBeenCalledWith(
      'Keine Erlaubnis-Grundlage – die E-Mail darf nicht als gesendet verbucht werden',
      undefined,
    )
    expect(r.result.current.status).toBe('bestaetigen')
  })

  it('Folgemail im Enrollment: Betreff „Re: …“, kein Datenschutz-Link (M-11)', async () => {
    ANTWORTEN.emails = [email({ enrollment_id: ENROLLMENT_ID, subject: 'Unser Gespräch am 10.10.' })]
    const r = await bereit({ leadId: LEAD_ID, enrollmentId: ENROLLMENT_ID })
    await waitFor(() => expect(r.result.current.thread).toHaveLength(1))
    expect(r.result.current.betreff).toBe('Re: Unser Gespräch am 10.10.')
    expect(r.result.current.ersteMail).toBe(false)
    expect(r.result.current.bausteine.datenschutz).toBeNull()
    expect(r.result.current.bausteine.widerspruch).toBe(SETTINGS.email.objection_sentence)
  })

  it('erste Mail: Widerspruchssatz + Signatur + Datenschutz-Link im Versandtext, nicht im editierbaren Text (M-07)', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    const b = r.result.current.bausteine
    expect(b.widerspruch).toBe(SETTINGS.email.objection_sentence)
    expect(b.signatur).toContain('Steiner & Co.')
    expect(b.datenschutz).toContain(SETTINGS.email.privacy_url)
    expect(r.result.current.bodyVoll.endsWith(b.text)).toBe(true)
    expect(r.result.current.text).not.toContain(SETTINGS.email.objection_sentence)
    expect(r.result.current.zeichen).toBe(r.result.current.bodyVoll.length)
  })

  it('`?vorlage=` darf ein Key sein (Anruf-Vorschlag „Terminbestätigung per E-Mail“) – wählt die Vorlage, nicht die erste erlaubte', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'meeting_held' })
    const r = await bereit({ leadId: LEAD_ID, vorlageId: VORLAGE_ZUSAMMENFASSUNG.key })
    expect(r.result.current.vorlage?.id).toBe(VORLAGE_ZUSAMMENFASSUNG.id)
    const perId = await bereit({ leadId: LEAD_ID, vorlageId: VORLAGE_NOSHOW.id })
    expect(perId.result.current.vorlage?.id).toBe(VORLAGE_NOSHOW.id)
  })

  it('Vorlagen-Filter nach Grundlage: none → nur transaktional; transaktional ohne Widerspruchssatz (M-12)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none' })
    const r = await bereit({ leadId: LEAD_ID })
    expect(r.result.current.vorlagen.map((t) => t.id)).toEqual([VORLAGE_NOSHOW.id])
    expect(r.result.current.transaktional).toBe(true)
    expect(r.result.current.bausteine.widerspruch).toBeNull()
    expect(r.result.current.sperrGrund).toBeNull()
  })

  it('meeting_held → Zusammenfassung wählbar; [Punkt 1–3] sperren bis gefüllt (M-04)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'meeting_held' })
    const r = await bereit({ leadId: LEAD_ID, vorlageId: VORLAGE_ZUSAMMENFASSUNG.id })
    expect(r.result.current.vorlage?.id).toBe(VORLAGE_ZUSAMMENFASSUNG.id)
    expect(r.result.current.offen).toEqual(['Punkt 1', 'Punkt 2', 'Punkt 3', 'Gesprächsdatum'])
    expect(r.result.current.sperrGrund).toBe('Erst alle Platzhalter eintragen.')
    act(() => {
      r.result.current.wertSetzen('Punkt 1', 'A')
      r.result.current.wertSetzen('Punkt 2', 'B')
      r.result.current.wertSetzen('Punkt 3', 'C')
      r.result.current.wertSetzen('Gesprächsdatum', '14.10.2026')
    })
    expect(r.result.current.offen).toEqual([])
    expect(r.result.current.sperrGrund).toBeNull()
    expect(r.result.current.text).toContain('A\nB\nC')
    expect(r.result.current.betreff).toBe('Unser Gespräch am 14.10.2026')
  })

  it('Warnung > 12 Monate: erster Aufruf „trotzdem“, zweiter öffnet (M-02)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_at: '2025-01-05T09:00:00+01:00' })
    const r = await bereit({ leadId: LEAD_ID })
    expect(r.result.current.gate.warnung).toBe('aelter_12_monate')
    let e1: string | undefined
    await act(async () => {
      e1 = await r.result.current.inGmailOeffnen()
    })
    expect(e1).toBe('trotzdem')
    expect(window.open).not.toHaveBeenCalled()
    expect(r.result.current.trotzdem).toBe(true)
    await act(async () => {
      await r.result.current.inGmailOeffnen()
    })
    expect(window.open).toHaveBeenCalledTimes(1)
  })

  it('gesperrt (none, nicht transaktional): Öffnen/mailto/Kopieren liefern „gesperrt“, kein Schreibzugriff (M-01)', async () => {
    ANTWORTEN.lead = leadMitErlaubnis({ email_consent_basis: 'none' })
    ANTWORTEN.templates = [VORLAGE_INFO]
    const r = renderHook(() => useComposer({ leadId: LEAD_ID }), { wrapper: huelle() })
    await waitFor(() => expect(r.result.current.status).toBe('bearbeiten'))
    expect(r.result.current.vorlagen).toEqual([])
    expect(r.result.current.sperrGrund).toContain('Keine Erlaubnis-Grundlage')
    let a: string | undefined
    await act(async () => {
      a = await r.result.current.inGmailOeffnen()
    })
    expect(a).toBe('gesperrt')
    await act(async () => {
      a = await r.result.current.mailtoOeffnen()
    })
    expect(a).toBe('gesperrt')
    await act(async () => {
      a = await r.result.current.kopieren('text')
    })
    expect(a).toBe('gesperrt')
    expect(ANTWORTEN.emailSchreibzugriffe).toEqual([])
  })

  it('zu lang (> 1 400): Gmail gesperrt mit Hinweis, Kopieren frei', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    act(() => r.result.current.textSetzen('x'.repeat(1500)))
    expect(r.result.current.zuLang).toBe(true)
    expect(r.result.current.gmailSperrGrund).toBe('Zu lang für den Gmail-Link – Kopieren nutzen.')
    expect(r.result.current.sperrGrund).toBeNull()
  })

  it('Text kopieren → Zwischenablage, Entwurf opened_in_client (manual), Status geoeffnet', async () => {
    const r = await bereit({ leadId: LEAD_ID })
    await act(async () => {
      await r.result.current.kopieren('text')
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(r.result.current.bodyVoll)
    expect(letzterEmailZugriff('update')).toMatchObject({ status: 'opened_in_client', channel: 'manual' })
    expect(r.result.current.status).toBe('geoeffnet')
  })

  it('Entwurf speichern + Verwerfen (failed, verworfen) → onFertig', async () => {
    const onFertig = vi.fn()
    const r = await bereit({ leadId: LEAD_ID, onFertig })
    await act(async () => {
      await r.result.current.entwurfSpeichern()
    })
    expect(letzterEmailZugriff('insert')).toMatchObject({ status: 'draft' })
    expect(toast).toHaveBeenCalledWith('Entwurf gespeichert.')
    await act(async () => {
      await r.result.current.verwerfen()
    })
    expect(letzterEmailZugriff('update')).toMatchObject({ status: 'failed', bounce_reason: 'verworfen' })
    expect(onFertig).toHaveBeenCalled()
  })

  it('vorhandener Entwurf wird wiederverwendet (gleiche Vorlage), Text ohne Bausteine', async () => {
    ANTWORTEN.emails = [
      email({
        id: 'alt',
        status: 'draft',
        subject: 'Mein Betreff',
        body_text: 'Mein Text\n\nBausteine',
        sent_at: null,
      }),
    ]
    const r = await bereit({ leadId: LEAD_ID, vorlageId: VORLAGE_INFO.id })
    await waitFor(() => expect(r.result.current.entwurfId).toBe('alt'))
    expect(r.result.current.betreff).toBe('Mein Betreff')
    expect(r.result.current.text).toBe('Mein Text\n\nBausteine')
    await act(async () => {
      await r.result.current.entwurfSpeichern()
    })
    expect(letzterEmailZugriff('insert')).toBeNull()
    expect(letzterEmailZugriff('update')).toMatchObject({ subject: 'Mein Betreff' })
  })
})

describe('reine Helfer', () => {
  it('anredeName', () => {
    expect(anredeName(leadMitErlaubnis())).toBe('Herrn Lindner')
    expect(anredeName(leadMitErlaubnis({ salutation: 'frau' }))).toBe('Frau Lindner')
    expect(anredeName(leadMitErlaubnis({ salutation: 'neutral' }))).toBe('Tobias Lindner')
  })
  it('vorlageErlaubt', () => {
    expect(vorlageErlaubt(VORLAGE_INFO, 'requested_phone')).toBe(true)
    expect(vorlageErlaubt(VORLAGE_INFO, 'none')).toBe(false)
    expect(vorlageErlaubt(VORLAGE_NOSHOW, 'none')).toBe(true)
    expect(vorlageErlaubt({ ...VORLAGE_INFO, required_consent: null }, 'requested_email')).toBe(true)
    expect(vorlageErlaubt({ ...VORLAGE_INFO, required_consent: null }, 'revoked')).toBe(false)
    expect(vorlageErlaubt({ ...VORLAGE_INFO, channel: 'linkedin' }, 'requested_email')).toBe(false)
  })
  it('bausteine + bodyZusammensetzen', () => {
    const b = bausteine(SETTINGS, { signature: 'Sig' }, { transaktional: false, ersteMail: false })
    expect(b.text).toBe(`${SETTINGS.email.objection_sentence}\n\nSig`)
    expect(bodyZusammensetzen('Hallo  \n', b.text)).toBe(`Hallo\n\n${b.text}`)
    expect(bodyZusammensetzen('Hallo', '')).toBe('Hallo')
    expect(bausteine(null, null, { transaktional: true, ersteMail: true }).text).toBe('')
  })
  it('threadMails + passenderEntwurf', () => {
    const a = email({ enrollment_id: 'e', sent_at: '2026-10-02T10:00:00Z' })
    const b = email({ enrollment_id: 'e', sent_at: '2026-10-01T10:00:00Z' })
    const d = email({ enrollment_id: 'e', status: 'draft' })
    expect(threadMails([a, b, d, email({ enrollment_id: 'x' })], 'e').map((e) => e.id)).toEqual([b.id, a.id])
    expect(threadMails([a, email({ direction: 'in' })], null)).toHaveLength(1)
    expect(passenderEntwurf([a, d], { enrollmentId: 'e' })?.id).toBe(d.id)
    expect(passenderEntwurf([d], { templateId: VORLAGE_INFO.id })).toBeNull()
    const frei = email({ status: 'opened_in_client', enrollment_id: null })
    expect(passenderEntwurf([frei], { templateId: VORLAGE_INFO.id })?.id).toBe(frei.id)
  })
})
