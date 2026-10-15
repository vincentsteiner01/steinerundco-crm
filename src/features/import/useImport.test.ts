// useImport: Schrittfolge, Dry-Run-Pflicht vor Ausführung, Datei-Validierung, Zuständig-Pflicht (BAUPLAN § 3.8 Unit-Tests).
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { status: string; member: { user_id: string } }) => unknown) =>
    sel({ status: 'mitglied', member: { user_id: '00000000-0000-4000-8000-000000000001' } }),
}))

import { supabase } from '@/data/supabase'
import { Huelle, MEMBER_V, rpcAntworten, rpcAufrufe } from './_testHilfe'
import { useImport } from './useImport'

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const wrapper = ({ children }: { children: ReactNode }) => createElement(Huelle, null, children)

function csvDatei(text: string, name = 'leads.csv'): File {
  const f = new File([text], name, { type: 'text/csv' })
  if (typeof (f as Blob).arrayBuffer !== 'function')
    Object.defineProperty(f, 'arrayBuffer', { value: async () => new TextEncoder().encode(text).buffer })
  return f
}

const CSV =
  'Name;Unternehmen;LinkedIn\nMax Mustermann;Sonnenkraft GmbH;https://www.linkedin.com/in/max-mustermann/\nEva Lang;;https://www.linkedin.com/in/eva-lang/\n'

describe('useImport', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpcAntworten(rpc, (name, args) => {
      if (name === 'import_leads')
        return {
          batch_id: args['p_dry_run'] ? null : 'b1',
          dry_run: !!args['p_dry_run'],
          inserted: 1,
          updated: 1,
          skipped: 0,
          blocked: 0,
          invalid: 0,
          rows: [
            {
              status: 'neu',
              name: 'Max Mustermann',
              company: 'Sonnenkraft GmbH',
              linkedin_url_norm: 'linkedin.com/in/max-mustermann',
              existing_id: null,
              existing_stage: null,
              existing_owner: null,
            },
            {
              status: 'duplikat',
              name: 'Eva Lang',
              company: null,
              linkedin_url_norm: 'linkedin.com/in/eva-lang',
              existing_id: 'l9',
              existing_stage: 'vernetzt',
              existing_owner: MEMBER_V,
            },
          ],
        }
      return null
    })
  })

  it('Schrittfolge 1 → 2 (Datei) → 3 (Dry-Run) → 4 (Import) mit korrekten RPC-Argumenten', async () => {
    const { result } = renderHook(() => useImport(MEMBER_V), { wrapper })
    expect(result.current.state.schritt).toBe(1)
    act(() => result.current.waehlePreset('allgemein'))
    await act(() => result.current.setzeDatei(csvDatei(CSV)))
    expect(result.current.state.schritt).toBe(2)
    expect(result.current.state.quelle?.csv?.kopf).toEqual(['Name', 'Unternehmen', 'LinkedIn'])
    expect(result.current.state.mapping).toEqual(['name', 'company', 'linkedin_url'])
    expect(result.current.allgemein?.rows).toHaveLength(2)

    await act(() => result.current.pruefen())
    expect(result.current.state.schritt).toBe(3)
    expect(result.current.state.dryRun?.art).toBe('leads')
    const dry = rpcAufrufe(rpc, 'import_leads')[0]
    expect(dry).toMatchObject({ p_dry_run: true, p_source: 'import_csv', p_owner: MEMBER_V, p_label: 'leads.csv' })
    expect(dry?.['p_rows']).toHaveLength(2)

    act(() => result.current.setzeEntscheidung(1, 'ueberspringen'))
    await act(() => result.current.ausfuehren())
    expect(result.current.state.schritt).toBe(4)
    expect(result.current.state.fertig?.art).toBe('leads')
    const echt = rpcAufrufe(rpc, 'import_leads')[1]
    expect(echt?.['p_dry_run']).toBe(false)
    expect(echt?.['p_rows']).toHaveLength(1) // Dublette übersprungen
  })

  it('Dry-Run-Pflicht: Ausführen ohne Prüfen wird abgelehnt', async () => {
    const { result } = renderHook(() => useImport(MEMBER_V), { wrapper })
    act(() => result.current.waehlePreset('allgemein'))
    await act(() => result.current.setzeDatei(csvDatei(CSV)))
    act(() => result.current.geheZu(3))
    await act(() => result.current.ausfuehren())
    expect(result.current.state.schritt).toBe(3)
    expect(result.current.state.fehler).toBe('Erst prüfen (Dry-Run), dann importieren.')
    expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(0)
  })

  it('weist falsche Endung, zu große Datei und falsches Preset-Format ab', async () => {
    const { result } = renderHook(() => useImport(MEMBER_V), { wrapper })
    act(() => result.current.waehlePreset('crm_tabelle'))
    await act(() => result.current.setzeDatei(csvDatei('a;b', 'x.pdf')))
    expect(result.current.state.fehler).toMatch(/Nur XLSX oder CSV/)
    await act(() => result.current.setzeDatei(csvDatei('a;b', 'x.csv')))
    expect(result.current.state.fehler).toMatch(/erwartet XLSX/)
    const gross = csvDatei('x', 'x.xlsx')
    Object.defineProperty(gross, 'size', { value: 11 * 1024 * 1024 })
    await act(() => result.current.setzeDatei(gross))
    expect(result.current.state.fehler).toMatch(/10 MB/)
    expect(result.current.state.schritt).toBe(1)
  })

  it('Mapping: Zielfeld nur einmal, ohne Name/URL kein Dry-Run', async () => {
    const { result } = renderHook(() => useImport(MEMBER_V), { wrapper })
    act(() => result.current.waehlePreset('allgemein'))
    await act(() => result.current.setzeDatei(csvDatei('A;B\n1;2\n')))
    expect(result.current.state.mapping).toEqual([null, null])
    await act(() => result.current.pruefen())
    expect(result.current.state.fehler).toMatch(/Name oder LinkedIn-URL/)
    act(() => result.current.setzeMapping(0, 'company'))
    act(() => result.current.setzeMapping(1, 'company'))
    expect(result.current.state.mapping).toEqual([null, 'company'])
  })

  it('zurück/weiter respektieren Grenzen und laufende Aktionen', async () => {
    const { result } = renderHook(() => useImport(MEMBER_V), { wrapper })
    act(() => result.current.zurueck())
    expect(result.current.state.schritt).toBe(1)
    act(() => result.current.weiter())
    expect(result.current.state.schritt).toBe(1) // ohne Datei
    act(() => result.current.waehlePreset('allgemein'))
    await act(() => result.current.setzeDatei(csvDatei(CSV)))
    act(() => result.current.zurueck())
    expect(result.current.state.schritt).toBe(1)
    act(() => result.current.weiter())
    expect(result.current.state.schritt).toBe(2)
    act(() => result.current.neu())
    await waitFor(() => expect(result.current.state.preset).toBeNull())
  })
})
