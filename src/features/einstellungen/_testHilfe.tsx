// Test-Hilfe M8: Render-Hülle (QueryClient + Tooltip + Router). Daten und Mock-Helfer: _testDaten.ts.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { TooltipProvider } from '@/components/ui/Tooltip'

export function rendern(ui: ReactElement, start = '/einstellungen/profil') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/einstellungen/:bereich', element: ui },
      { path: '*', element: ui },
    ],
    {
      initialEntries: [start],
    },
  )
  const ergebnis = render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...ergebnis, router, qc }
}
