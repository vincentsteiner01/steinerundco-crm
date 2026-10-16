// TanStack-Defaults (architektur § 4.8, BAUPLAN § 3.1.6).
import { QueryClient } from '@tanstack/react-query'

type FehlerArtig = { code?: string; status?: number; message?: string; name?: string }
const f = (e: unknown): FehlerArtig => (e && typeof e === 'object' ? (e as FehlerArtig) : {})

/** Netzwerkfehler (fetch wirft `TypeError: Failed to fetch`) oder Zeitlimit (wiederholen.ts). Mapping: src/data/errors.ts. */
export const istNetzwerkfehler = (e: unknown): boolean => {
  const x = f(e)
  return (
    x.name === 'TimeoutError' ||
    (x.name === 'TypeError' && /fetch/i.test(x.message ?? '')) ||
    /Failed to fetch|NetworkError|Load failed/i.test(x.message ?? '')
  )
}
/** RLS/Grant oder abgelaufene Sitzung → landet im errorElement der Route. */
export const istAuthfehler = (e: unknown): boolean => {
  const x = f(e)
  return x.code === '42501' || x.code === 'PGRST301' || x.status === 401
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (n, e) => istNetzwerkfehler(e) && n < 2,
      refetchOnWindowFocus: true,
      networkMode: 'online',
      throwOnError: (e) => istAuthfehler(e),
    },
    mutations: {
      networkMode: 'online',
      retry: 0,
    },
  },
})
