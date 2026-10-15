// oxlint-disable react/only-export-components -- Test-Hilfe, kein Fast-Refresh-Ziel
// Test-Hilfen M7: Render-Hülle (QueryClient + Tooltip + MemoryRouter), supabase-Antworten je Tabelle, rpc-Antworten je Name.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import { supabaseMock, type Antwort } from '@/test/supabaseMock'

export { MEMBER_M, MEMBER_V }

export const MEMBERS = [
  // wie die echten Daten seit Runde 2: Vincent hat im Profil das Kürzel „VS“ gesetzt
  { id: MEMBER_V, display_name: 'Vincent Steiner', short_name: 'VS', preferences: {} },
  { id: MEMBER_M, display_name: 'Mike Muster', short_name: 'Mike', preferences: {} },
]

export function supabaseAntworten(extra: (tabelle: string) => Antwort | null = () => null) {
  return supabaseMock((tabelle) => {
    const e = extra(tabelle)
    if (e) return e
    switch (tabelle) {
      case 'members':
        return { data: MEMBERS, error: null }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      case 'companies':
        return { data: [{ id: 'c1', name: 'Sonnenfeld Solar Rostock & MV', do_not_contact: true }], error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
}

export function qcNeu() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

export function Huelle({ children, qc }: { children: ReactNode; qc?: QueryClient }) {
  return (
    <QueryClientProvider client={qc ?? qcNeu()}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}

/** Rendert eine Routen-Komponente unter `pfad` mit Ziel-Dummies für Navigationstests. */
export function rendernMitRouter(Component: () => ReactNode, start: string, pfad: string) {
  const Ziel = ({ name }: { name: string }) => <h1>{name}</h1>
  const router = createMemoryRouter(
    [
      { path: pfad, Component },
      { path: '/heute', element: <Ziel name="HEUTE" /> },
      { path: '/leads', element: <Ziel name="LEADS" /> },
      { path: '/import', element: <Ziel name="IMPORT" /> },
      { path: '/import/:batchId', element: <Ziel name="ERGEBNIS" /> },
      { path: '/kpis', element: <Ziel name="KPIS" /> },
      { path: '/leitfaeden', element: <Ziel name="LEITFAEDEN" /> },
    ],
    { initialEntries: [start] },
  )
  const r = render(
    <Huelle>
      <RouterProvider router={router} />
    </Huelle>,
  )
  return { router, ...r }
}

/** rpc-Mock: Antwort je Funktionsname (`{ data, error }`), zeichnet Aufrufe auf. */
export function rpcAntworten(
  rpc: ReturnType<typeof vi.fn>,
  handler: (name: string, args: Record<string, unknown>) => unknown,
) {
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => ({
    data: handler(name, args),
    error: null,
  }))
}

export const rpcAufrufe = (rpc: ReturnType<typeof vi.fn>, name: string) =>
  (rpc.mock.calls as unknown[][]).filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>)

export const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
