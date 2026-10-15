// Test-Hilfe (nur Komponenten): Hülle mit QueryClient + Tooltip + MemoryRouter und Anzeige von Pfad + Query (`data-testid="ort"`).
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { TooltipProvider } from '@/components/ui/Tooltip'

export function TestOrt() {
  const l = useLocation()
  return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>
}

export function TestHuelle({
  ui,
  qc,
  route,
  pfad,
}: {
  ui: ReactElement
  qc: QueryClient
  route?: string
  pfad?: string
}) {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route ?? '/']}>
          <Routes>
            <Route path={pfad ?? '*'} element={ui} />
            <Route path="*" element={null} />
          </Routes>
          <TestOrt />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
