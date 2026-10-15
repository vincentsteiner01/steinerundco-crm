// Test-Hilfen M4: Render-Hülle (QueryClient + Tooltip + Router), supabase-Antworten je Tabelle (mutierbar je Test),
// Lead-/Vorlagen-/E-Mail-Fixturen (synthetisch, BAUPLAN § 3.0 Nr. 9).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { vorlage } from '@/test/fixtures/vorlagen'
import { kette, supabaseMock, type Antwort } from '@/test/supabaseMock'
import type { Email, Lead, Template } from '@/types/domain'

export const LEAD_ID = '10000000-0000-4000-8000-000000000001'
export const ENROLLMENT_ID = '50000000-0000-4000-8000-000000000001'
export const STEP_ID = '30000000-0000-4000-8000-000000000011'

/** Lead mit Erlaubnis (Per LinkedIn gebeten, 05.10.2026) und Adresse. */
export function leadMitErlaubnis(patch: Partial<Lead> = {}): Lead {
  return vollerLead(1, {
    salutation: 'herr',
    first_name: 'Tobias',
    last_name: 'Lindner',
    full_name: 'Tobias Lindner',
    email: 'tobias.lindner@beispiel.de',
    email_consent_basis: 'requested_linkedin',
    email_consent_at: '2026-10-05T09:00:00+02:00',
    email_consent_note: 'kurze Infos zu Solvio',
    updated_at: '2026-10-14T08:00:00.000Z',
    ...patch,
  })
}

export const VORLAGE_INFO = vorlage('test_email_info', {
  id: 'tmpl-info',
  name: 'Infomail',
  channel: 'email',
  phase: 'infomail',
  subject: 'Kurzinfo für [Unternehmen]',
  body: 'Hallo [Anrede] [Nachname],\n\nhier die Infos.\n\nViele Grüße\n[Absender Vorname]',
  required_consent: ['requested_linkedin', 'requested_phone', 'requested_email', 'meeting_held', 'existing_customer'],
})
export const VORLAGE_ZUSAMMENFASSUNG = vorlage('test_email_zusammenfassung', {
  id: 'tmpl-zusammenfassung',
  name: 'Zusammenfassung Erstgespräch',
  channel: 'email',
  phase: 'zusammenfassung',
  subject: 'Unser Gespräch am [Gesprächsdatum]',
  body: 'Hallo [Anrede] [Nachname],\n\n[Punkt 1]\n[Punkt 2]\n[Punkt 3]\n\nViele Grüße',
  required_consent: ['meeting_held', 'existing_customer'],
})
export const VORLAGE_NOSHOW = vorlage('test_email_noshow', {
  id: 'tmpl-noshow',
  name: 'No-Show',
  channel: 'email',
  phase: 'transaktional',
  subject: 'Unser Termin',
  body: 'Hallo [Anrede] [Nachname],\n\nwir hatten einen Termin.',
  required_consent: null,
})
export const VORLAGE_LINKEDIN = vorlage('test_li', { id: 'tmpl-li', name: 'LinkedIn', channel: 'linkedin' })

export const ALLE_VORLAGEN: Template[] = [VORLAGE_INFO, VORLAGE_ZUSAMMENFASSUNG, VORLAGE_NOSHOW, VORLAGE_LINKEDIN]

let laufend = 0
export function email(patch: Partial<Email> = {}): Email {
  laufend += 1
  const basis = {
    id: `m-${laufend}`,
    lead_id: LEAD_ID,
    member_id: MEMBER_V,
    direction: 'out',
    channel: 'gmail_compose',
    template_id: VORLAGE_INFO.id,
    enrollment_id: null,
    step_id: null,
    from_address: 'vincent@steinerundco.de',
    to_address: 'tobias.lindner@beispiel.de',
    subject: 'Kurzinfo für Solar 01 GmbH',
    body_text: 'Hallo',
    body_html: null,
    message_id_header: null,
    in_reply_to: null,
    references_header: null,
    provider_thread_id: null,
    provider_message_id: null,
    status: 'sent_confirmed',
    status_at: '2026-10-10T10:00:00+02:00',
    sent_at: '2026-10-10T10:00:00+02:00',
    replied_at: null,
    bounce_reason: null,
    consent_basis_snapshot: 'requested_linkedin',
    consent_at_snapshot: null,
    consent_note_snapshot: null,
    source: 'app',
    created_at: '2026-10-10T10:00:00+02:00',
    updated_at: '2026-10-10T10:00:00+02:00',
  }
  return { ...(basis as unknown as Email), ...patch }
}

/** Mutierbare Antworten je Tabelle – Tests setzen sie vor dem Rendern. */
export const ANTWORTEN: {
  lead: Lead | null
  emails: Email[]
  templates: Template[]
  sperrliste: unknown[]
  queue: unknown[]
  /** Fehler der Queue-View (Tab „Fällig“: Fehlerzeile statt Leerzustand) */
  queueFehler: { code: string; message: string } | null
  tasks: unknown[]
  enrollments: unknown[]
  /** Fehler für Insert/Update auf `emails` (z. B. Trigger-Text, M-14). */
  emailsFehler: { code: string; message: string } | null
  /** Insert/Update-Argumente auf `emails`, in Reihenfolge. */
  emailSchreibzugriffe: { art: 'insert' | 'update'; arg: Record<string, unknown> }[]
} = {
  lead: leadMitErlaubnis(),
  emails: [],
  templates: ALLE_VORLAGEN,
  sperrliste: [],
  queue: [],
  queueFehler: null,
  tasks: [],
  enrollments: [],
  emailsFehler: null,
  emailSchreibzugriffe: [],
}

export function zuruecksetzen(): void {
  ANTWORTEN.lead = leadMitErlaubnis()
  ANTWORTEN.emails = []
  ANTWORTEN.templates = ALLE_VORLAGEN
  ANTWORTEN.sperrliste = []
  ANTWORTEN.queue = []
  ANTWORTEN.queueFehler = null
  ANTWORTEN.tasks = []
  ANTWORTEN.enrollments = []
  ANTWORTEN.emailsFehler = null
  ANTWORTEN.emailSchreibzugriffe = []
}

function emailsKette() {
  const k = kette({ data: ANTWORTEN.emails, error: null })
  let geschrieben: Record<string, unknown> | null = null
  let art: 'insert' | 'update' = 'insert'
  let zielId: string | null = null
  k['insert'] = vi.fn((arg: Record<string, unknown>) => {
    geschrieben = arg
    art = 'insert'
    ANTWORTEN.emailSchreibzugriffe.push({ art, arg })
    return k
  })
  k['update'] = vi.fn((arg: Record<string, unknown>) => {
    geschrieben = arg
    art = 'update'
    ANTWORTEN.emailSchreibzugriffe.push({ art, arg })
    return k
  })
  k['eq'] = vi.fn((spalte: string, wert: string) => {
    if (spalte === 'id') zielId = wert
    return k
  })
  k['single'] = vi.fn(async (): Promise<Antwort> => {
    if (ANTWORTEN.emailsFehler) return { data: null, error: ANTWORTEN.emailsFehler }
    const vorhanden = zielId ? ANTWORTEN.emails.find((e) => e.id === zielId) : undefined
    const zeile = email({
      ...(vorhanden ?? {}),
      ...(geschrieben ?? {}),
      id: vorhanden?.id ?? (art === 'insert' ? 'm-neu' : (zielId ?? 'm-neu')),
    })
    return { data: zeile, error: null }
  })
  return k
}

export function supabaseAntworten() {
  const basis = supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'leads':
        return { data: ANTWORTEN.lead, error: null }
      case 'members':
        return {
          data: [
            {
              id: MEMBER_V,
              display_name: 'Vincent Steiner',
              short_name: 'Vincent',
              email: 'vincent@steinerundco.de',
              email_address: 'vincent@steinerundco.de',
              signature: 'Vincent Steiner\nSteiner & Co.\nMusterstraße 1, 20095 Hamburg',
              preferences: {},
            },
            {
              id: MEMBER_M,
              display_name: 'Mike',
              short_name: 'Mike',
              email_address: 'mike@steinerundco.de',
              preferences: {},
            },
          ],
          error: null,
        }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      case 'templates':
        return { data: ANTWORTEN.templates, error: null }
      case 'sperrliste':
        return { data: ANTWORTEN.sperrliste, error: null }
      case 'v_today_queue':
        return ANTWORTEN.queueFehler
          ? { data: null, error: ANTWORTEN.queueFehler }
          : { data: ANTWORTEN.queue, error: null }
      case 'tasks':
        return { data: ANTWORTEN.tasks, error: null }
      case 'enrollments':
        return { data: ANTWORTEN.enrollments, error: null }
      case 'sequences':
        return { data: [], error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
  const from = basis.supabase.from
  basis.supabase.from = vi.fn((tabelle: string) =>
    tabelle === 'emails' ? emailsKette() : from(tabelle),
  ) as typeof from
  return basis
}

export function rendern(ui: ReactElement, pfad = '/email') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[pfad]}>{ui}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

export const taste = (key: string, extra: Record<string, unknown> = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })

/** Letzter Schreibzugriff auf `emails` einer Art. */
export const letzterEmailZugriff = (art: 'insert' | 'update') =>
  [...ANTWORTEN.emailSchreibzugriffe].reverse().find((z) => z.art === art)?.arg ?? null
