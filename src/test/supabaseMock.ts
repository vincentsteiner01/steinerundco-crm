// vi.mock von '@/data/supabase' mit from().select()-Kette, rpc(), channel() (BAUPLAN § 3.1.11).
// Nutzung:  vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
//           const { supabase } = await import('@/data/supabase')  →  vi.mocked(supabase.rpc).mockResolvedValue(…)
// `antwort` darf eine Funktion (tabelle) => Antwort sein, dann antwortet jede Tabelle anders.
import { vi } from 'vitest'

export type Antwort = { data: unknown; error: unknown; count?: number | null }
export type AntwortQuelle = Antwort | ((tabelle: string) => Antwort)

const STANDARD: Antwort = { data: [], error: null, count: 0 }

export function kette(antwort: Antwort = STANDARD) {
  const k: Record<string, unknown> = {}
  const methoden = [
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
  for (const m of methoden) k[m] = vi.fn(() => k)
  k['single'] = vi.fn(async () => antwort)
  k['maybeSingle'] = vi.fn(async () => antwort)
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(antwort).then(res, rej)
  return k
}

export type KanalMock = {
  name: string
  handler: { filter: { event: string; schema: string; table: string }; cb: (payload: unknown) => void }[]
  status: ((s: string) => void) | null
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
}

export function supabaseMock(antwort?: AntwortQuelle) {
  const antwortFuer = (tabelle: string): Antwort =>
    typeof antwort === 'function' ? antwort(tabelle) : (antwort ?? STANDARD)
  const from = vi.fn((tabelle: string) => kette(antwortFuer(tabelle)))
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const auth = {
    signInWithPassword: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
    updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  }
  const kanaele: KanalMock[] = []
  const channel = vi.fn((name: string) => {
    const k: KanalMock = {
      name,
      handler: [],
      status: null,
      on: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }
    k.on.mockImplementation(
      (_typ: string, filter: KanalMock['handler'][number]['filter'], cb: (p: unknown) => void) => {
        k.handler.push({ filter, cb })
        return k
      },
    )
    k.subscribe.mockImplementation((cb?: (s: string) => void) => {
      k.status = cb ?? null
      cb?.('SUBSCRIBED')
      return k
    })
    kanaele.push(k)
    return k
  })
  const supabase = {
    from,
    rpc,
    auth,
    channel,
    removeChannel: vi.fn(async () => 'ok'),
    removeAllChannels: vi.fn(async () => []),
    schema: vi.fn(() => ({ from })),
    /** Testzugriff: alle erzeugten Kanäle (Realtime-Simulation). */
    __kanaele: kanaele,
  }
  return {
    supabase,
    members: () => kette(antwortFuer('members')),
    bleibenStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setzeBleiben: vi.fn(),
    liesBleiben: () => true,
    speicher: () => globalThis.localStorage,
    BLEIBEN_KEY: 'crm.bleiben',
  }
}
