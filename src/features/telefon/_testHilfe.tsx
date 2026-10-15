// oxlint-disable react/only-export-components -- Test-Hilfe, kein Fast-Refresh-Ziel
// Test-Hilfen M3: synthetische Leads/Tasks/Enrollments/Vorlagen/Calls, Render-Hülle mit Data-Router (useBlocker), Tastendruck.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { vorlage } from '@/test/fixtures/vorlagen'
import type { Antwort } from '@/test/supabaseMock'
import type { Call, Enrollment, Lead, LeadMitBezug, Task, Template } from '@/types/domain'

export const JETZT = new Date('2026-10-14T08:30:00.000Z') // Mi 14.10.2026 10:30 Berlin

export const LEAD_A = vollerLead(4, {
  full_name: 'Lukas Feldhaus',
  first_name: 'Lukas',
  last_name: 'Feldhaus',
  salutation: 'herr',
  company_name: 'Lichtwerk Solar GmbH',
  role: 'geschaeftsfuehrer',
  role_title: 'Geschäftsführer',
  city: 'Lüneburg',
  phone_e164: '+494131220418',
  phone_type: 'zentrale',
  phone_source: 'website_kontakt',
  call_basis: 'linkedin_vernetzt_antwort',
  stage: 'dm_beantwortet',
  owner_id: MEMBER_M,
  updated_at: '2026-10-14T06:00:00.000Z',
  website: 'https://lichtwerk-solar.de',
})
export const LEAD_B = vollerLead(8, {
  full_name: 'Timo Kranich',
  first_name: 'Timo',
  last_name: 'Kranich',
  company_name: 'Nordwind Energie GmbH',
  phone_e164: '+4940111111',
  call_basis: 'linkedin_vernetzt',
  stage: 'vernetzt',
  owner_id: MEMBER_M,
  created_at: '2026-09-01T09:00:00+02:00',
})
export const LEAD_C = vollerLead(12, {
  full_name: 'Lena Hartwig',
  first_name: 'Lena',
  last_name: 'Hartwig',
  company_name: 'Hartwig Solartechnik',
  phone_e164: '+4940222222',
  call_basis: 'bestandskontakt',
  stage: 'erstgespraech_vereinbart',
  owner_id: MEMBER_M,
  created_at: '2026-10-02T09:00:00+02:00',
})
/** ohne Anrufgrund, mit LinkedIn-Antwort → Bulk-Kandidat */
export const LEAD_OHNE_GRUND = vollerLead(3, {
  full_name: 'Niklas Behrend',
  company_name: 'Sonnenhof Elektro GmbH',
  phone_e164: '+4940333333',
  call_basis: null,
  stage: 'dm_beantwortet',
  last_inbound_channel: 'linkedin',
  last_inbound_at: '2026-10-05T10:00:00+02:00',
  owner_id: MEMBER_M,
})
export const LEAD_OHNE_NUMMER = vollerLead(7, {
  full_name: 'Nora Feld',
  company_name: 'Feld Energie',
  phone_e164: null,
  call_basis: 'linkedin_vernetzt',
  stage: 'vernetzt',
  owner_id: MEMBER_M,
})

export const TASK_RUECKRUF: Task = {
  id: 'task-rueckruf-1',
  lead_id: LEAD_A.id,
  member_id: MEMBER_M,
  kind: 'rueckruf',
  title: 'Rückruf',
  due_at: '2026-10-14T08:30:00.000Z',
  status: 'offen',
  done_at: null,
  snooze_count: 0,
  call_id: null,
  template_id: null,
  note: 'mit Zentrale',
  source: 'app',
  created_by: MEMBER_M,
  created_at: '2026-10-12T09:00:00.000Z',
  updated_at: '2026-10-12T09:00:00.000Z',
}

export function enrollment(
  leadId: string,
  position: number,
  nextDue: string | null,
  status: Enrollment['status'] = 'aktiv',
): Enrollment {
  return {
    id: `enr-${leadId.slice(-2)}-${position}`,
    lead_id: leadId,
    sequence_id: 'seq-telefon',
    channel: 'telefon',
    member_id: MEMBER_M,
    status,
    current_step_id: null,
    current_position: position,
    next_due_at: nextDue,
    started_at: '2026-10-10T09:00:00.000Z',
    last_step_at: null,
    completed_at: null,
    stopped_at: null,
    stopped_reason: null,
    snooze_count: 0,
    note: null,
    source: 'app',
    created_at: '2026-10-10T09:00:00.000Z',
    updated_at: '2026-10-10T09:00:00.000Z',
  }
}

export const TEMPLATES: Template[] = [
  vorlage(VORLAGE.tel_einstieg_1, {
    name: 'Einstieg V1',
    channel: 'telefon',
    phase: 'einstieg',
    body: 'Guten Tag, [Anrufer] hier. Ich hatte mit Herrn [Nachname] auf LinkedIn geschrieben – [Anlass].',
  }),
  vorlage(VORLAGE.tel_einstieg_2, {
    name: 'Einstieg V2',
    channel: 'telefon',
    phase: 'einstieg',
    body: 'Guten Tag, [Anrufer] – kalt.',
  }),
  vorlage('test_tel_zentrale', {
    name: 'Zentrale',
    channel: 'telefon',
    phase: 'gatekeeper',
    body: 'Ist [Anrede] [Nachname] zu erreichen? [Reaktion]',
  }),
  vorlage(VORLAGE.tel_mailbox_1, {
    name: 'Mailbox 1',
    channel: 'telefon',
    phase: 'mailbox',
    body: 'Mailbox eins [Vorname]',
  }),
  vorlage(VORLAGE.tel_mailbox_2, {
    name: 'Mailbox 2',
    channel: 'telefon',
    phase: 'mailbox',
    body: 'Mailbox zwei [Vorname]',
  }),
  vorlage(VORLAGE.tel_datenschutz_1, {
    name: 'Datenschutz',
    channel: 'telefon',
    phase: 'datenschutz',
    body: 'Ihre Kontaktdaten habe ich von LinkedIn.',
  }),
]

export function leadMitBezug(lead: Lead, patch: Partial<LeadMitBezug> = {}): LeadMitBezug {
  return {
    ...lead,
    companies: null,
    enrollments: [],
    tasks: [],
    meetings: [],
    linkedin_connections: [],
    lead_tags: [],
    ...patch,
  }
}

export function call(leadId: string, outcome: Call['outcome'], patch: Partial<Call> = {}): Call {
  return {
    id: `call-${Math.random().toString(16).slice(2, 8)}`,
    lead_id: leadId,
    member_id: MEMBER_M,
    direction: 'out',
    provider: 'manual',
    external_call_id: null,
    from_number: null,
    to_number: null,
    started_at: '2026-10-14T08:00:00.000Z',
    answered_at: null,
    ended_at: '2026-10-14T08:00:41.000Z',
    duration_sec: 41,
    talk_sec: null,
    attempt_no: 1,
    outcome,
    raw_outcome: null,
    reached_person: null,
    reached_name: null,
    note: null,
    template_id: null,
    enrollment_id: null,
    recording_url: null,
    corrected: false,
    kpi_relevant: true,
    source: 'app',
    created_at: '2026-10-14T08:00:41.000Z',
    updated_at: '2026-10-14T08:00:41.000Z',
    ...patch,
  }
}

export const MEMBERS = [
  {
    id: MEMBER_V,
    display_name: 'Vincent Test',
    short_name: 'Vincent',
    initial: 'V',
    caller_number_e164: '+4940999001',
    preferences: {},
  },
  {
    id: MEMBER_M,
    display_name: 'Mike Test',
    short_name: 'Mike',
    initial: 'M',
    caller_number_e164: '+4940999002',
    preferences: {},
  },
]

export const SETTINGS_ZEILEN = Object.entries(SETTINGS).map(([key, value]) => ({ key, value }))

/** Standard-Antworten je Tabelle; `ueberschreibung` gewinnt. */
export function antworten(ueberschreibung: Record<string, Antwort | undefined> = {}): (tabelle: string) => Antwort {
  return (tabelle) => {
    const u = ueberschreibung[tabelle]
    if (u) return u
    switch (tabelle) {
      case 'members':
        return { data: MEMBERS, error: null }
      case 'settings':
        return { data: SETTINGS_ZEILEN, error: null }
      case 'templates':
        return { data: TEMPLATES, error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  }
}

export function rendern(ui: ReactElement, pfad = '/', route = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: route, element: ui },
      { path: '*', element: <p data-testid="woanders">woanders</p> },
    ],
    { initialEntries: [pfad] },
  )
  const r = render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...r, router, qc }
}

export const taste = (key: string, extra: Record<string, unknown> = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })
