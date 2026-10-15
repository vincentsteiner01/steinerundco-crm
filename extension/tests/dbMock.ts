// Minimaler Supabase-Mock: jede Abfrage-Kette wird aufgezeichnet ({ tabelle, ops }) und von `antworte` beantwortet.
import { vi } from 'vitest'
import type { Db } from '../src/background/supabase'

export type Op = { m: string; a: unknown[] }
export type Abfrage = { schema: string; tabelle: string; ops: Op[] }
export type DbAntwort = { data: unknown; error: unknown }

export function hat(a: Abfrage, m: string, ...args: unknown[]): boolean {
  return a.ops.some((o) => o.m === m && args.every((x, i) => JSON.stringify(o.a[i]) === JSON.stringify(x)))
}
export function op(a: Abfrage, m: string): Op | undefined {
  return a.ops.find((o) => o.m === m)
}

export function erstelleMock(opts: {
  antworte: (a: Abfrage) => DbAntwort
  rpc?: (name: string, args: Record<string, unknown>) => DbAntwort
  userId?: string | null
}) {
  const log: Abfrage[] = []
  const kette = (schema: string, tabelle: string) => {
    const a: Abfrage = { schema, tabelle, ops: [] }
    const p: unknown = new Proxy(
      {},
      {
        get(_z, prop) {
          if (prop === 'then')
            return (ok: (v: DbAntwort) => unknown, fehler: (e: unknown) => unknown) => {
              log.push(a)
              return Promise.resolve()
                .then(() => opts.antworte(a))
                .then(ok, fehler)
            }
          return (...args: unknown[]) => {
            a.ops.push({ m: String(prop), a: args })
            return p
          }
        },
      },
    )
    return p
  }
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) =>
    opts.rpc ? opts.rpc(name, args) : { data: null, error: { message: `unerwartete RPC ${name}` } },
  )
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? 'u-vincent' } } },
      error: null,
    })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null })),
  }
  const db = {
    from: (t: string) => kette('crm', t),
    schema: (s: string) => ({ from: (t: string) => kette(s, t) }),
    rpc,
    auth,
  }
  return { db: db as unknown as Db, log, rpc, auth }
}
