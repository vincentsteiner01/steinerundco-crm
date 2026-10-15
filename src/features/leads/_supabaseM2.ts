// Supabase-Ersatz für die M2-Tests (vi.mock-Fabrik): Antworten je Tabelle aus dem mutierbaren `DB`, alle Builder-Aufrufe protokolliert.
// Eigene Datei ohne Abhängigkeit zu `@/data/supabase` (sonst Zyklus in der Mock-Fabrik).
import { vi } from 'vitest'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SEQUENZEN } from '@/test/fixtures/sequenzen'
import { SETTINGS } from '@/test/fixtures/settings'
import type { Antwort } from '@/test/supabaseMock'
import type { Activity, Company, Lead, LeadMitBezug } from '@/types/domain'

export { MEMBER_M, MEMBER_V, vollerLead }

export const MEMBERS = [
  { id: MEMBER_V, display_name: 'Vincent Steiner', short_name: 'Vincent', initial: 'V', preferences: {} },
  { id: MEMBER_M, display_name: 'Mike Meier', short_name: 'Mike', initial: 'M', preferences: {} },
]

export const FIRMA_GESPERRT_ID = '20000000-0000-4000-8000-000000000001'
export const NEUE_FIRMA_ID = '20000000-0000-4000-8000-000000000099'
export const FIRMA_GESPERRT: Company = {
  id: FIRMA_GESPERRT_ID,
  name: 'Sperrfirma Energie',
  do_not_contact: true,
} as unknown as Company

/** Lead mit Bezügen (Detail-Embed) – Standard: Vincent zuständig, Phase Eröffnet, keine Kanäle aktiv. */
export function leadMitBezug(i: number, patch: Partial<LeadMitBezug> = {}): LeadMitBezug {
  return {
    ...vollerLead(i, { updated_at: '2026-10-14T08:00:00.000Z' }),
    companies: null,
    enrollments: [],
    tasks: [],
    meetings: [],
    linkedin_connections: [],
    lead_tags: [],
    ...patch,
  } as LeadMitBezug
}

let aktivitaetsId = 1000
export function aktivitaet(patch: Partial<Activity> = {}): Activity {
  aktivitaetsId += 1
  return {
    id: aktivitaetsId,
    lead_id: vollerLead(1).id,
    member_id: MEMBER_V,
    channel: 'linkedin',
    type: 'notiz',
    occurred_at: '2026-10-14T09:00:00+02:00',
    template_id: null,
    outcome: null,
    reply_label: null,
    note: null,
    metadata: {},
    enrollment_id: null,
    step_id: null,
    call_id: null,
    meeting_id: null,
    email_id: null,
    task_id: null,
    kpi_relevant: true,
    source: 'app',
    created_at: new Date().toISOString(),
    ...patch,
  }
}

export type Aufruf = { methode: string; args: unknown[] }
export type Zugriff = { tabelle: string; aufrufe: Aufruf[]; art: 'liste' | 'single' }

/** Mutierbare Antworten je Tabelle – Tests setzen sie vor dem Rendern (`zuruecksetzen()` in beforeEach). */
export const DB: {
  leads: Lead[]
  details: LeadMitBezug[]
  dubletten: Partial<Lead>[]
  suche: Partial<Lead>[]
  activities: Activity[]
  companies: Company[]
  sperrliste: unknown[]
  tags: unknown[]
  importBatches: unknown[]
  queue: unknown[]
  pipeline: unknown[]
  calls: unknown[]
  emails: unknown[]
  meetings: unknown[]
  konflikt: boolean
  leadsFehler: { code: string; message: string } | null
  zugriffe: Zugriff[]
} = {
  leads: [],
  details: [],
  dubletten: [],
  suche: [],
  activities: [],
  companies: [],
  sperrliste: [],
  tags: [],
  importBatches: [],
  queue: [],
  pipeline: [],
  calls: [],
  emails: [],
  meetings: [],
  konflikt: false,
  leadsFehler: null,
  zugriffe: [],
}

const hat = (z: Aufruf[], m: string) => z.some((a) => a.methode === m)
const arg = (z: Aufruf[], m: string, i = 0) => z.find((a) => a.methode === m)?.args[i]
const eqWert = (z: Aufruf[], spalte: string) =>
  z.find((a) => a.methode === 'eq' && a.args[0] === spalte)?.args[1] as string | undefined

function antwortFuer(tabelle: string, z: Aufruf[], art: 'liste' | 'single'): Antwort {
  switch (tabelle) {
    case 'leads': {
      if (DB.leadsFehler && art === 'liste') return { data: null, error: DB.leadsFehler }
      const update = arg(z, 'update') as Record<string, unknown> | undefined
      if (update) {
        if (DB.konflikt) return { data: null, error: null }
        const id = eqWert(z, 'id')
        const alt = DB.details.find((d) => d.id === id) ?? DB.leads.find((l) => l.id === id)
        return { data: { ...(alt ?? {}), ...update, updated_at: new Date().toISOString() }, error: null }
      }
      const insert = arg(z, 'insert') as Record<string, unknown> | undefined
      if (insert)
        return { data: { ...vollerLead(90), ...insert, id: '10000000-0000-4000-8000-000000000090' }, error: null }
      if (hat(z, 'delete')) return { data: null, error: null }
      if (art === 'single') {
        const id = eqWert(z, 'id')
        const d = DB.details.find((x) => x.id === id)
        return d ? { data: d, error: null } : { data: null, error: { code: 'PGRST116', message: 'nicht gefunden' } }
      }
      const or = String(arg(z, 'or') ?? '')
      if (/linkedin_url_norm\.eq|phone_e164\.eq|email\.ilike/.test(or)) return { data: DB.dubletten, error: null }
      if (hat(z, 'limit') && !hat(z, 'range')) return { data: DB.suche, error: null }
      const bereich = z.find((a) => a.methode === 'range')?.args as [number, number] | undefined
      const daten = bereich ? DB.leads.slice(bereich[0], bereich[1] + 1) : DB.leads
      return { data: daten, error: null, count: DB.leads.length }
    }
    case 'activities': {
      const insert = arg(z, 'insert') as Record<string, unknown> | undefined
      if (insert) return { data: aktivitaet(insert as Partial<Activity>), error: null }
      const update = arg(z, 'update') as Record<string, unknown> | undefined
      if (update) return { data: { ...aktivitaet(), ...update }, error: null }
      const typen = arg(z, 'in', 1) as string[] | undefined
      const leadId = eqWert(z, 'lead_id')
      const daten = DB.activities
        .filter((a) => !leadId || a.lead_id === leadId)
        .filter((a) => !typen || typen.includes(a.type))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      return art === 'single' ? { data: daten[0] ?? null, error: null } : { data: daten, error: null }
    }
    case 'members':
      return { data: MEMBERS, error: null }
    case 'settings':
      return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
    case 'sequences':
      return {
        data: SEQUENZEN.map(({ steps, ...s }) => ({ ...s, sequence_steps: steps })),
        error: null,
      }
    case 'companies': {
      // firmaFuerName (Review-Korrektur): Suche über name_norm, sonst Insert der neuen Firma
      const insert = arg(z, 'insert') as Record<string, unknown> | undefined
      if (insert)
        return {
          data: {
            id: NEUE_FIRMA_ID,
            do_not_contact: false,
            name_norm: String(insert.name ?? '').toLowerCase(),
            ...insert,
          },
          error: null,
        }
      const norm = eqWert(z, 'name_norm')
      if (norm !== undefined)
        return {
          data: DB.companies.filter((c) => (c.name_norm ?? c.name.toLowerCase().replace(/\s+/g, ' ').trim()) === norm),
          error: null,
        }
      return { data: DB.companies, error: null }
    }
    case 'sperrliste':
      return { data: DB.sperrliste, error: null }
    case 'tags':
      return { data: DB.tags, error: null }
    case 'import_batches':
      return { data: DB.importBatches, error: null }
    case 'v_today_queue':
      return { data: DB.queue, error: null }
    case 'v_pipeline_counts':
      return { data: DB.pipeline, error: null }
    case 'calls':
      return { data: DB.calls, error: null }
    case 'emails':
      return { data: DB.emails, error: null }
    case 'meetings': {
      const update = arg(z, 'update') as Record<string, unknown> | undefined
      if (update) return { data: { ...(DB.meetings[0] as object), ...update }, error: null }
      return { data: DB.meetings, error: null }
    }
    default:
      return { data: art === 'single' ? null : [], error: null, count: 0 }
  }
}

const METHODEN = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'in',
  'is',
  'or',
  'ilike',
  'gte',
  'lte',
  'gt',
  'lt',
  'order',
  'range',
  'limit',
  'match',
  'not',
  'filter',
  'textSearch',
  'contains',
]

/** Builder, der alle Aufrufe mitschreibt und erst beim Auflösen antwortet (DB wird zur Laufzeit gelesen). */
function protokollKette(tabelle: string) {
  const aufrufe: Aufruf[] = []
  const k: Record<string, unknown> = {}
  for (const m of METHODEN)
    k[m] = vi.fn((...args: unknown[]) => {
      aufrufe.push({ methode: m, args })
      return k
    })
  const antwort = (art: 'liste' | 'single') => {
    DB.zugriffe.push({ tabelle, aufrufe: [...aufrufe], art })
    return antwortFuer(tabelle, aufrufe, art)
  }
  k['single'] = vi.fn(async () => antwort('single'))
  k['maybeSingle'] = vi.fn(async () => antwort('single'))
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(antwort('liste')).then(res, rej)
  return k
}

/** Ersatz für `@/data/supabase` (vi.mock-Fabrik). */
export function supabaseM2() {
  const from = vi.fn((t: string) => protokollKette(t))
  const supabase = {
    from,
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(async () => 'ok'),
    removeAllChannels: vi.fn(async () => []),
    schema: vi.fn(() => ({ from })),
  }
  return {
    supabase,
    members: () => protokollKette('members'),
    bleibenStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setzeBleiben: vi.fn(),
    liesBleiben: () => true,
    speicher: () => globalThis.localStorage,
    BLEIBEN_KEY: 'crm.bleiben',
  }
}

/** Alle mitgeschriebenen Zugriffe auf eine Tabelle mit einer Methode (z. B. `update` auf `leads`). */
export function zugriffeMit(tabelle: string, methode: string): Aufruf[][] {
  return DB.zugriffe.filter((z) => z.tabelle === tabelle && hat(z.aufrufe, methode)).map((z) => z.aufrufe)
}
export function erstesArg(z: Aufruf[], methode: string): unknown {
  return arg(z, methode)
}
