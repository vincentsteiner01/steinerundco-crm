// Routen nach dem Neustart (25.11.2026): Start und alte Adressen (Lesezeichen, installierte App, Chrome-Erweiterung) führen aufs
// Board; `/leads/:id` öffnet das Lead-Blatt über `?lead=`; `/leitfaeden/:id` gibt es nicht mehr. 26.11.2026: `/kpis` ist wieder
// eine echte Seite, `/ziele` ist neu (Reiter „Ziele“, OKR).
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, matchRoutes, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/features/auth/RequireAuth', () => ({ RequireAuth: () => <Outlet /> }))
vi.mock('./shell/AppShell', () => ({ AppShell: () => <Outlet /> }))
// Die Seiten selbst gehören anderen Teilaufgaben – hier zählt nur, wohin eine Adresse führt
vi.mock('@/features/board/BoardSeite', () => ({ Component: () => <h1>BOARD</h1> }))
vi.mock('@/features/leitfaeden/Leitfaeden', () => ({ Component: () => <h1>LEITFAEDEN</h1> }))
vi.mock('@/features/kpis/KpisSeite', () => ({ Component: () => <h1>KPIS</h1> }))
vi.mock('@/features/okr/OkrSeite', () => ({ Component: () => <h1>ZIELE</h1> }))

import { PFADE, ROUTEN } from './router'

async function ziel(start: string): Promise<string> {
  const router = createMemoryRouter(ROUTEN, { initialEntries: [start] })
  const { unmount } = render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1 })
  const ort = router.state.location.pathname + router.state.location.search
  unmount()
  return ort
}

describe('Routen', () => {
  it('Start führt aufs Board', async () => {
    expect(await ziel('/')).toBe('/leads')
  })

  it('alte Seiten leiten auf /leads um', async () => {
    for (const alt of [
      '/heute',
      '/auftrag',
      '/auftrag/recherche/r1',
      '/pipeline',
      '/leads/neu',
      '/leads/papierkorb',
      '/leads/pipeline',
      '/telefon',
      '/telefon/anruf/l1',
      '/telefon/kpis',
      '/umsatz',
      '/import',
      '/import/schnell',
      '/feedback',
    ])
      expect(await ziel(alt), alt).toBe('/leads')
  })

  it('/kpis ist eine echte Seite – auch mit alten Parametern im Lesezeichen, keine Weiterleitung', async () => {
    expect(PFADE.kpis).toBe('/kpis')
    const route = matchRoutes(ROUTEN, PFADE.kpis)?.at(-1)?.route
    expect(route?.path).toBe('kpis')
    expect(route?.lazy).toBeTypeOf('function')
    const router = createMemoryRouter(ROUTEN, { initialEntries: ['/kpis?kanal=linkedin'] })
    const { unmount } = render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'KPIS' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/kpis')
    unmount()
  })

  it('/ziele ist eine echte Seite (Reiter „Ziele“), keine Weiterleitung', async () => {
    expect(PFADE.ziele).toBe('/ziele')
    const route = matchRoutes(ROUTEN, PFADE.ziele)?.at(-1)?.route
    expect(route?.path).toBe('ziele')
    expect(route?.lazy).toBeTypeOf('function')
    const router = createMemoryRouter(ROUTEN, { initialEntries: ['/ziele'] })
    const { unmount } = render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'ZIELE' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/ziele')
    unmount()
  })

  it('/leads/:id öffnet das Lead-Blatt über ?lead= – wie PFADE.lead', async () => {
    expect(PFADE.lead('l1')).toBe('/leads?lead=l1')
    expect(await ziel('/leads/l1')).toBe('/leads?lead=l1')
  })

  it('/leitfaeden/:id gibt es nicht mehr – zurück zur Liste', async () => {
    const router = createMemoryRouter(ROUTEN, { initialEntries: ['/leitfaeden/neu?kanal=telefon'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'LEITFAEDEN' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/leitfaeden'))
  })
})
