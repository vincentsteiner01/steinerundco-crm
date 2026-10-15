// Test-Hilfen M1 (Heute + Sequenzen): Render-Hülle (QueryClient + Tooltip + Router), supabase-Antworten je Tabelle (mutierbar je
// Test), RPC-Antworten je Funktion, synthetische Sequenzen/Vorlagen/Leads (BAUPLAN § 3.0 Nr. 9). Schlüssel nur aus
// lib/vorlagenKeys (§ 3.0 Nr. 12), auch in Tests.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { Ort } from './_testOrt'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { SEQUENZ, VORLAGE } from '@/lib/vorlagenKeys'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { queueItem } from '@/test/fixtures/queue'
import { SETTINGS } from '@/test/fixtures/settings'
import { vorlage } from '@/test/fixtures/vorlagen'
import { kette, supabaseMock, type Antwort } from '@/test/supabaseMock'
import type {
  Activity,
  DailyActivity,
  LeadMitBezug,
  QueueItem,
  QueueSection,
  SequenceMitSchritten,
  Template,
} from '@/types/domain'

// ── Sequenzen (E14, Seed-Struktur) ───────────────────────────────────────────

let seqNr = 0
export function sequenz(
  key: string,
  name: string,
  channel: 'linkedin' | 'telefon' | 'email',
  schritte: { name: string; delay: number; opener?: boolean; template_id?: string | null }[],
  patch: Partial<SequenceMitSchritten> = {},
): SequenceMitSchritten {
  seqNr += 1
  const id = `30000000-0000-4000-8000-${String(seqNr).padStart(12, '0')}`
  const steps = schritte.map((s, i) => ({
    id: `31000000-0000-4000-8000-${String(seqNr * 100 + i + 1).padStart(12, '0')}`,
    sequence_id: id,
    position: i + 1,
    name: s.name,
    kind: channel === 'telefon' ? 'anruf' : channel === 'email' ? 'email' : 'nachricht',
    channel,
    delay_days: s.delay,
    template_id: s.template_id ?? null,
    is_opener: !!s.opener,
    instructions: null,
    sets_stage: null,
    created_at: '2026-10-01T09:00:00+02:00',
    updated_at: '2026-10-01T09:00:00+02:00',
  }))
  const basis = {
    id,
    key,
    name,
    channel,
    active: true,
    version: 1,
    description: null,
    trigger_kind: 'manuell',
    stop_on_meeting: true,
    stop_on_reply: true,
    weekdays_only: true,
    created_at: '2026-10-01T09:00:00+02:00',
    updated_at: '2026-10-01T09:00:00+02:00',
  }
  return {
    ...(basis as unknown as SequenceMitSchritten),
    steps: steps as unknown as SequenceMitSchritten['steps'],
    ...patch,
  }
}

export const SEQ_A = sequenz(SEQUENZ.linkedin_standard, 'LinkedIn Standard', 'linkedin', [
  { name: 'Opener', delay: 0, opener: true },
  { name: 'Kurzfristig 1', delay: 3 },
  { name: 'Kurzfristig 2', delay: 7 },
  { name: 'Kurzfristig 3', delay: 10 },
  { name: 'Langfristig 1', delay: 70 },
  { name: 'Langfristig 2', delay: 84 },
])
export const SEQ_C = sequenz(SEQUENZ.linkedin_nachfassen_im_gespraech, 'Nachfassen im Gespräch', 'linkedin', [
  { name: 'Nachfassen 1', delay: 3 },
  { name: 'Nachfassen 2', delay: 7 },
  { name: 'Langfristig', delay: 70 },
])
export const SEQ_A_ALT = sequenz(
  SEQUENZ.linkedin_sheet_regel,
  'A alt',
  'linkedin',
  [
    { name: 'Opener', delay: 0, opener: true },
    { name: 'Follow-up 1', delay: 3 },
    { name: 'Follow-up 2', delay: 3 },
    { name: 'Follow-up 3', delay: 3 },
    { name: 'Langfristig 1', delay: 30 },
    { name: 'Langfristig 2', delay: 30 },
  ],
  { active: false },
)
export const SEQ_TEL = sequenz(SEQUENZ.telefon_standard, 'Telefon-Standard', 'telefon', [
  { name: 'Versuch 1', delay: 0 },
  { name: 'Versuch 2', delay: 2 },
  { name: 'Versuch 3', delay: 3 },
  { name: 'Versuch 4', delay: 4 },
  { name: 'Versuch 5', delay: 5 },
  { name: 'Langfristig', delay: 90 },
])
export const SEQ_NOSHOW = sequenz(SEQUENZ.email_noshow_erstgespraech, 'No-Show Erstgespräch', 'email', [
  { name: 'N0', delay: 0 },
  { name: 'N1', delay: 3 },
])
export const SEQUENZEN: SequenceMitSchritten[] = [SEQ_A, SEQ_C, SEQ_A_ALT, SEQ_TEL, SEQ_NOSHOW]

// ── Vorlagen (synthetische Texte, Seed-Keys aus VORLAGE) ───────────────────────

export const T_OPENER = vorlage(VORLAGE.li_eroeffnung_v1, {
  id: 'tmpl-opener',
  name: 'Gesprächseröffnung (V1)',
  body: 'Hallo [Anrede] [Nachname], danke fürs Vernetzen.',
})
export const T_OPENER_KB = vorlage(VORLAGE.li_eroeffnung_kundenbetreuer, {
  id: 'tmpl-opener-kb',
  name: 'ZG – Kundenbetreuer',
  body: 'Hallo [Vorname], danke fürs Vernetzen.',
})
export const T_KF2 = vorlage(VORLAGE.li_fu_kurz_2, {
  id: 'tmpl-kf2',
  name: 'Kurzfristig 2',
  phase: 'follow_up',
  body: 'Hallo [Anrede] [Nachname], kurze Nachfrage zu [Unternehmen].',
})
export const T_JA = vorlage(VORLAGE.li_bedarf_ja_v1, {
  id: 'tmpl-ja',
  name: 'Ja (V1)',
  phase: 'bedarfsermittlung',
  body: 'Danke, [Anrede] [Nachname] – [Reaktion] höre ich oft.',
})
export const T_JA3 = vorlage(VORLAGE.li_bedarf_ja_v3, {
  id: 'tmpl-ja3',
  name: 'Ja (V3)',
  phase: 'bedarfsermittlung',
  body: 'Gute Frage, [Anrede] [Nachname].',
})
export const T_NEIN_OHNE = vorlage(VORLAGE.li_bedarf_nein_ohne_grund, {
  id: 'tmpl-nein-ohne',
  name: 'Nein (ohne Grund)',
  phase: 'bedarfsermittlung',
  body: 'Danke für die Rückmeldung, [Anrede] [Nachname].',
})
export const T_NEIN_MIT = vorlage(VORLAGE.li_bedarf_nein_mit_grund, {
  id: 'tmpl-nein-mit',
  name: 'Nein (mit Grund)',
  phase: 'bedarfsermittlung',
  body: 'Verstehe, [Anrede] [Nachname] – [Grund].',
})
export const T_PARTNER = vorlage(VORLAGE.li_bedarf_hat_partner, {
  id: 'tmpl-partner',
  name: 'Hat Partner',
  phase: 'bedarfsermittlung',
  body: 'Schön, [Anrede] [Nachname].',
})
export const T_FALSCH = vorlage(VORLAGE.li_bedarf_nein_falsches_problem, {
  id: 'tmpl-falsch',
  name: 'Falsches Problem',
  phase: 'bedarfsermittlung',
  body: 'Danke, [Anrede] [Nachname].',
})
export const T_PITCH_A = vorlage(VORLAGE.li_pitch_a, {
  id: 'tmpl-pitch-a',
  name: 'Pitch A',
  phase: 'pitch',
  body: 'Wollen wir sprechen, [Anrede] [Nachname]?',
})
export const T_PITCH_B = vorlage(VORLAGE.li_pitch_b, {
  id: 'tmpl-pitch-b',
  name: 'Pitch B',
  phase: 'pitch',
  body: 'Passt [Tag/Uhrzeit 1] oder [Tag/Uhrzeit 2]?',
})
export const T_LF1 = vorlage(VORLAGE.li_fu_lang_1, {
  id: 'tmpl-lf1',
  name: 'Langfristig 1',
  phase: 'follow_up',
  body: 'Hallo [Anrede] [Nachname], ich melde mich wie besprochen.',
})
export const T_TEL = vorlage(VORLAGE.tel_einstieg_1, {
  id: 'tmpl-tel',
  name: 'Einstieg V1',
  channel: 'telefon',
  phase: 'einstieg',
  body: '- Guten Tag [Anrede] [Nachname]\n- Anlass nennen\n- Eine Frage stellen',
})
export const T_INFO = vorlage(VORLAGE.em_info_nach_linkedin_zusage, {
  id: 'tmpl-info',
  name: 'Infomail',
  channel: 'email',
  phase: 'infomail',
  subject: 'Kurzinfo für [Unternehmen]',
  body: 'Hallo [Anrede] [Nachname], hier die Infos.',
})
export const T_NOSHOW = vorlage(VORLAGE.em_noshow_erstgespraech, {
  id: 'tmpl-noshow',
  name: 'No-Show',
  channel: 'email',
  phase: 'transaktional',
  subject: 'Unser Termin',
  body: 'Hallo [Anrede] [Nachname], schade, dass es nicht geklappt hat.',
})
export const VORLAGEN: Template[] = [
  T_OPENER,
  T_OPENER_KB,
  T_KF2,
  T_JA,
  T_JA3,
  T_NEIN_OHNE,
  T_NEIN_MIT,
  T_PARTNER,
  T_FALSCH,
  T_PITCH_A,
  T_PITCH_B,
  T_LF1,
  T_TEL,
  T_INFO,
  T_NOSHOW,
]

// ── Leads und Queue-Zeilen ──────────────────────────────────────────────────

export function leadMitBezug(i: number, patch: Partial<LeadMitBezug> = {}): LeadMitBezug {
  return {
    ...vollerLead(i, {
      salutation: 'herr',
      first_name: 'Max',
      last_name: `Muster${i}`,
      full_name: `Max Muster${i}`,
      role: 'geschaeftsfuehrer',
      role_title: 'Geschäftsführer',
      owner_id: MEMBER_V,
      updated_at: '2026-10-14T08:00:00.000Z',
    }),
    companies: null,
    enrollments: [],
    tasks: [],
    meetings: [],
    linkedin_connections: [],
    lead_tags: [],
    ...patch,
  } as LeadMitBezug
}

/** Queue-Zeile mit Lead `i` (Name/Firma passend zu leadMitBezug). */
export function zeile(section: QueueSection, i: number, patch: Partial<QueueItem> = {}): QueueItem {
  const lead = leadMitBezug(i)
  return queueItem(section, i, {
    lead_id: lead.id,
    lead_name: lead.full_name,
    first_name: lead.first_name,
    last_name: lead.last_name,
    salutation: lead.salutation,
    company_name: lead.company_name,
    owner_id: MEMBER_V,
    member_id: MEMBER_V,
    ...patch,
  })
}

export const ICH = { user_id: MEMBER_V, email: 'vincent@steinerundco.de', display_name: 'Vincent Steiner' }

// ── Mutierbare Antworten ─────────────────────────────────────────────────────

type RpcAntwort = { data: unknown; error: unknown }

export const ANTWORTEN: {
  queue: QueueItem[]
  sequenzen: SequenceMitSchritten[]
  templates: Template[]
  leads: Map<string, LeadMitBezug>
  activities: Partial<Activity>[]
  daily: Partial<DailyActivity>[]
  calls: unknown[]
  emails: unknown[]
  enrollments: unknown[]
  pipeline: unknown[]
  frei: unknown[]
  settings: Record<string, unknown>
  rpc: Record<string, RpcAntwort | ((args: Record<string, unknown>) => RpcAntwort)>
  /** Fehler der Queue-View (Fehlerzeile statt Leerzustand, ux § 4.3) */
  queueFehler: { code: string; message: string } | null
  /** Patches auf Tabellen in Reihenfolge (leads, linkedin_connections, meetings, sequence_steps …) */
  schreiben: { tabelle: string; art: 'update' | 'insert' | 'upsert'; arg: Record<string, unknown> }[]
} = {
  queue: [],
  sequenzen: SEQUENZEN,
  templates: VORLAGEN,
  leads: new Map(),
  activities: [],
  daily: [],
  calls: [],
  emails: [],
  enrollments: [],
  pipeline: [{ stage: 'vernetzt', leads: 5 }],
  frei: [],
  settings: SETTINGS as unknown as Record<string, unknown>,
  rpc: {},
  queueFehler: null,
  schreiben: [],
}

export function zuruecksetzen(): void {
  ANTWORTEN.queue = []
  ANTWORTEN.sequenzen = SEQUENZEN
  ANTWORTEN.templates = VORLAGEN
  ANTWORTEN.leads = new Map()
  ANTWORTEN.activities = []
  ANTWORTEN.daily = []
  ANTWORTEN.calls = []
  ANTWORTEN.emails = []
  ANTWORTEN.enrollments = []
  ANTWORTEN.pipeline = [{ stage: 'vernetzt', leads: 5 }]
  ANTWORTEN.frei = []
  ANTWORTEN.settings = SETTINGS as unknown as Record<string, unknown>
  ANTWORTEN.rpc = {}
  ANTWORTEN.queueFehler = null
  ANTWORTEN.schreiben = []
}

/** Lead(s) registrieren, die useLead/ladeLead liefern. */
export function leadsSetzen(...leads: LeadMitBezug[]): void {
  for (const l of leads) ANTWORTEN.leads.set(l.id, l)
}

const antwortOk = (data: unknown): Antwort => ({ data, error: null, count: Array.isArray(data) ? data.length : null })

function filterKette(tabelle: string, alle: () => Record<string, unknown>[]) {
  const k = kette(antwortOk([]))
  const eq: [string, unknown][] = []
  const ins: [string, unknown[]][] = []
  let schreib: { art: 'update' | 'insert' | 'upsert'; arg: Record<string, unknown> } | null = null
  const ergebnis = () => {
    let z = alle()
    for (const [sp, w] of eq) z = z.filter((r) => r[sp] === undefined || r[sp] === w)
    for (const [sp, ws] of ins) z = z.filter((r) => r[sp] === undefined || ws.includes(r[sp]))
    return z
  }
  k['eq'] = vi.fn((sp: string, w: unknown) => {
    eq.push([sp, w])
    return k
  })
  k['in'] = vi.fn((sp: string, ws: unknown[]) => {
    ins.push([sp, ws])
    return k
  })
  for (const art of ['update', 'insert', 'upsert'] as const)
    k[art] = vi.fn((arg: Record<string, unknown>) => {
      schreib = { art, arg }
      ANTWORTEN.schreiben.push({ tabelle, art, arg })
      return k
    })
  k['single'] = vi.fn(async () => {
    if (schreib) return antwortOk({ ...(ergebnis()[0] ?? {}), ...schreib.arg })
    const z = ergebnis()[0]
    return z ? antwortOk(z) : { data: null, error: { code: 'PGRST116', message: 'nicht gefunden' } }
  })
  k['maybeSingle'] = vi.fn(async () => antwortOk(ergebnis()[0] ?? null))
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(antwortOk(schreib ? [schreib.arg] : ergebnis())).then(res, rej)
  return k
}

const MEMBERS = [
  {
    id: MEMBER_V,
    display_name: 'Vincent Steiner',
    short_name: 'Vincent',
    email: 'vincent@steinerundco.de',
    signature: 'Vincent',
    daily_target: null,
    weekly_budget: null,
    linkedin_plan: 'premium',
    preferences: {},
  },
  {
    id: MEMBER_M,
    display_name: 'Mike Mustermann',
    short_name: 'Mike',
    email: 'mike@steinerundco.de',
    daily_target: null,
    weekly_budget: null,
    linkedin_plan: 'premium',
    preferences: {},
  },
]

const STANDARD_RPC: Record<string, RpcAntwort> = {
  complete_step: { data: null, error: null },
  log_outbound: { data: 501, error: null },
  enroll: { data: 'enr-neu', error: null },
  set_wiedervorlage: { data: null, error: null },
  mark_accepted: { data: { id: 'con-1' }, error: null },
  log_request: { data: { id: 'con-2' }, error: null },
  set_counter: { data: null, error: null },
  snooze_step: { data: null, error: null },
  snooze_task: { data: null, error: null },
  complete_task: { data: null, error: null },
  undo_activity: { data: null, error: null },
}

export function supabaseAntworten() {
  const basis = supabaseMock()
  const from = vi.fn((tabelle: string) => {
    switch (tabelle) {
      case 'v_today_queue':
        if (ANTWORTEN.queueFehler) return kette({ data: null, error: ANTWORTEN.queueFehler })
        return filterKette(tabelle, () => ANTWORTEN.queue as unknown as Record<string, unknown>[])
      case 'sequences': {
        const k = kette(antwortOk(ANTWORTEN.sequenzen.map(({ steps, ...s }) => ({ ...s, sequence_steps: steps }))))
        for (const art of ['update', 'upsert'] as const)
          k[art] = vi.fn((arg: Record<string, unknown>) => {
            ANTWORTEN.schreiben.push({ tabelle, art, arg })
            k['single'] = vi.fn(async () => antwortOk(arg))
            return k
          })
        return k
      }
      case 'sequence_steps':
        return filterKette(
          tabelle,
          () => ANTWORTEN.sequenzen.flatMap((s) => s.steps) as unknown as Record<string, unknown>[],
        )
      case 'settings':
        return kette(antwortOk(Object.entries(ANTWORTEN.settings).map(([key, value]) => ({ key, value }))))
      case 'members':
        return kette(antwortOk(MEMBERS))
      case 'templates':
        return kette(antwortOk(ANTWORTEN.templates))
      case 'leads': {
        // Detail (`.single()`) liefert den registrierten Lead; Listen (`.range()`, z. B. „freigegeben“) liefern ANTWORTEN.frei
        const k = filterKette(tabelle, () => [...ANTWORTEN.leads.values()] as unknown as Record<string, unknown>[])
        k['range'] = vi.fn(() => {
          k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve(antwortOk(ANTWORTEN.frei)).then(res, rej)
          return k
        })
        return k
      }
      case 'activities':
        return filterKette(tabelle, () => ANTWORTEN.activities as Record<string, unknown>[])
      case 'v_daily_activity':
        return kette(antwortOk(ANTWORTEN.daily))
      case 'calls':
        return kette(antwortOk(ANTWORTEN.calls))
      case 'emails':
        return kette(antwortOk(ANTWORTEN.emails))
      case 'enrollments':
        return filterKette(tabelle, () => ANTWORTEN.enrollments as Record<string, unknown>[])
      case 'v_pipeline_counts':
        return kette(antwortOk(ANTWORTEN.pipeline))
      default:
        return filterKette(tabelle, () => [])
    }
  })
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    const a = ANTWORTEN.rpc[name] ?? STANDARD_RPC[name] ?? { data: null, error: null }
    return typeof a === 'function' ? a(args) : a
  })
  const supabase = { ...basis.supabase, from, rpc, schema: vi.fn(() => ({ from })) }
  return { ...basis, supabase, members: () => kette(antwortOk(MEMBERS)) }
}

export function rendern(ui: ReactElement, opts: { pfad?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const pfad = opts.pfad ?? '/heute'
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <Routes>
              <Route
                path="*"
                element={
                  <>
                    {ui}
                    <Ort />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  }
}

export const taste = (key: string, extra: Record<string, unknown> = {}, ziel: Element = document.body) =>
  fireEvent.keyDown(ziel, { key, ...extra })

/** Aufrufe von supabase.rpc als [name, args]. */
export function rpcAufrufe(rpc: unknown): [string, Record<string, unknown>][] {
  return (rpc as { mock: { calls: unknown[][] } }).mock.calls.map(
    (c) => [c[0] as string, (c[1] ?? {}) as Record<string, unknown>] as [string, Record<string, unknown>],
  )
}

/** Toast-Modul als Mock (vi.mock('@/components/toast', …)). */
export function toastMock() {
  return {
    toast: vi.fn(),
    toastUndo: vi.fn(() => 1),
    toastFehler: vi.fn(),
    toastRealtime: vi.fn(),
    registriereUndo: vi.fn(),
    undoAusfuehren: vi.fn(async () => true),
    retryAusfuehren: vi.fn(() => false),
    fehlerSchliessen: vi.fn(() => false),
    hatFehlerToast: () => false,
    UNDO_MS: 6000,
    TOAST_MS: 4000,
    sonnerToast: { custom: vi.fn(() => 'v1'), dismiss: vi.fn() },
  }
}
