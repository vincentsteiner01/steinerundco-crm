// oxlint-disable react/only-export-components -- Test-Hilfen, keine Fast-Refresh-Komponenten
// Test-Hilfen Feedback: synthetische Meldungen, Render-Hülle (QueryClient + Router + TooltipProvider), Storage-Mock,
// matchMedia-Schalter (≥ 1280 px = Liste + Detail nebeneinander), blob:-URLs in jsdom.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { Feedback } from '@/data/feedback'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'

export { MEMBER_M, MEMBER_V }

export const MEMBERS = [
  { id: MEMBER_V, display_name: 'Vincent', short_name: 'Vincent', email: 'vincent@steinerundco.de', preferences: {} },
  { id: MEMBER_M, display_name: 'Mike', short_name: 'Mike', email: 'mike@steinerundco.de', preferences: {} },
]

export function meldung(teil: Partial<Feedback> = {}): Feedback {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    member_id: MEMBER_V,
    art: 'fehler',
    titel: null,
    beschreibung: 'Pipeline: Datum steht doppelt in der Karte',
    route: '/pipeline?lead=abc',
    url: 'http://localhost:8768/pipeline?lead=abc',
    viewport: '1440×900 @2x',
    user_agent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    app_version: 'test',
    konsole: [{ zeit: '2026-10-15T10:00:01.000Z', art: 'error', text: 'TypeError: x is undefined' }],
    screenshot_path: null,
    status: 'neu',
    antwort: null,
    antwort_at: null,
    notiz: null,
    notiz_at: null,
    notiz_von: null,
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
    ...teil,
  }
}

/** supabase.storage-Mock (upload, createSignedUrl) – an das gemockte supabase-Objekt hängen. */
export function storageMock() {
  const upload = vi.fn(async () => ({ data: { path: 'x' }, error: null as unknown }))
  const createSignedUrl = vi.fn(async () => ({
    data: { signedUrl: 'https://example.test/signed' },
    error: null as unknown,
  }))
  const from = vi.fn(() => ({ upload, createSignedUrl }))
  return { from, upload, createSignedUrl }
}

/** jsdom kennt keine blob:-URLs. */
export function blobUrlsStubben(): void {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: vi.fn(() => `blob:test/${++n}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: vi.fn() })
}

/** matchMedia: `breit` = (min-width: 1280px) trifft zu. */
export function setzeBreite(breit: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1280px') ? breit : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

export function rendere(element: ReactElement, pfad = '/', routen: { path: string; element: ReactElement }[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '*', element }, ...routen], { initialEntries: [pfad] })
  const r = render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...r, qc, router }
}
