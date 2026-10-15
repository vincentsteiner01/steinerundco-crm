// ImportErgebnisSeite: Laden, nicht gefunden, Batch mit Zeilen + Rückgängig (I-04 Dialog → undo_import), Sheet-Batch ohne Undo, rückgängig gemacht.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let batch: Record<string, unknown> | null = null
vi.mock('@/data/supabase', async () => {
  const { supabaseAntworten } = await import('./_testHilfe')
  return supabaseAntworten((t) =>
    t === 'import_batches'
      ? { data: batch, error: batch ? null : { code: 'PGRST116', message: 'nicht gefunden' } }
      : null,
  )
})
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { status: string; member: { user_id: string } }) => unknown) =>
    sel({ status: 'mitglied', member: { user_id: '00000000-0000-4000-8000-000000000001' } }),
}))

import { supabase } from '@/data/supabase'
import { Component, undoMoeglich } from './ImportErgebnisSeite'
import { MEMBER_V, rendernMitRouter, rpcAntworten, rpcAufrufe } from './_testHilfe'

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
const JETZT = Date.now()
const vorTagen = (n: number) => new Date(JETZT - n * 86400 * 1000).toISOString()

function batchNeu(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'b1',
    source: 'schnellimport',
    label: 'ChatGPT · 14.10.2026',
    preset: 'schnellimport',
    file_name: null,
    member_id: MEMBER_V,
    row_count: 3,
    inserted: 2,
    updated: 1,
    skipped: 0,
    blocked: 0,
    summary: {
      rows: [
        {
          status: 'neu',
          name: 'Max Mustermann',
          company: 'Sonnenkraft GmbH',
          linkedin_url_norm: 'linkedin.com/in/max',
          existing_id: null,
          existing_stage: null,
          existing_owner: null,
        },
        {
          status: 'neu',
          name: 'Eva Lang',
          company: null,
          linkedin_url_norm: 'linkedin.com/in/eva',
          existing_id: null,
          existing_stage: null,
          existing_owner: null,
        },
        {
          status: 'duplikat',
          name: 'Tom Berg',
          company: 'Berg AG',
          linkedin_url_norm: 'linkedin.com/in/tom',
          existing_id: 'l1',
          existing_stage: 'vernetzt',
          existing_owner: MEMBER_V,
        },
      ],
    },
    undone_at: null,
    created_at: vorTagen(2),
    payload: null,
    ...patch,
  }
}

const rendern = () => rendernMitRouter(Component, '/import/b1', '/import/:batchId')

describe('ImportErgebnisSeite', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpcAntworten(rpc, (name) => (name === 'undo_import' ? { batch_id: 'b1', deleted_leads: 2 } : null))
  })

  it('undoMoeglich: nur undone_at null, Quelle schnellimport/import_csv, ≤ 30 Tage', () => {
    expect(undoMoeglich({ undone_at: null, created_at: vorTagen(29), source: 'schnellimport' }, JETZT)).toBe(true)
    expect(undoMoeglich({ undone_at: null, created_at: vorTagen(31), source: 'import_csv' }, JETZT)).toBe(false)
    expect(undoMoeglich({ undone_at: vorTagen(1), created_at: vorTagen(2), source: 'schnellimport' }, JETZT)).toBe(
      false,
    )
    expect(undoMoeglich({ undone_at: null, created_at: vorTagen(1), source: 'import_sheet' }, JETZT)).toBe(false)
  })

  it('nicht gefunden → Leerzustand mit Link zum Import', async () => {
    batch = null
    const { router } = rendern()
    await screen.findByRole('heading', { name: 'Import nicht gefunden.' })
    fireEvent.click(screen.getByRole('button', { name: 'Zum Import' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/import'))
  })

  it('Batch mit Zeilen: Kopf-Stats, Chips, Zähler, Rückgängig-Dialog → undo_import, Toast', async () => {
    batch = batchNeu()
    const { router } = rendern()
    await screen.findByRole('heading', { name: 'ChatGPT · 14.10.2026' })
    expect(screen.getByRole('table', { name: 'Zeilen des Imports' })).toBeInTheDocument()
    expect(screen.getAllByText('Neu')).toHaveLength(2)
    expect(screen.getByText('Dublette')).toBeInTheDocument()
    await screen.findByText('Vernetzt · Vincent')
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      /\(3 Zeilen\) rückgängig machen\? 2 Leads werden gelöscht; aktualisierte Leads bleiben auf dem neuen Stand/,
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückgängig machen' }))
    await waitFor(() => expect(rpcAufrufe(rpc, 'undo_import')[0]).toEqual({ p_batch_id: 'b1' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Zu den Leads (Filter: dieser Import)' }))
    await waitFor(() => expect(router.state.location.search).toBe('?quelle=b1'))
  })

  it('Sheet-Batch: Hinweise statt Zeilen, kein Rückgängig, Hinweis idempotent', async () => {
    batch = batchNeu({
      source: 'import_sheet',
      preset: 'sheet_crm',
      label: 'CRM-Sheet „CRM - Steiner & Co.“ (Tab CRM)',
      summary: { hinweise: [{ id: 4, name: 'Test Person', hinweis: 'Unternehmen fehlt' }] },
    })
    rendern()
    await screen.findByRole('list', { name: 'Hinweise' })
    expect(screen.getByText('Unternehmen fehlt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Zu den Leads/ })).not.toBeInTheDocument()
    expect(screen.getByText(/idempotent/)).toBeInTheDocument()
  })

  it('rückgängig gemacht: Chip mit Datum und gelöschten Leads, kein Button', async () => {
    batch = batchNeu({ undone_at: vorTagen(1), summary: { rows: [], undone_leads: 2 } })
    rendern()
    await screen.findByText(/rückgängig gemacht am \d{2}\.\d{2}\.\d{4} · 2 Leads gelöscht/)
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).not.toBeInTheDocument()
    expect(screen.getByText('Keine Zeilen gespeichert.')).toBeInTheDocument()
  })
})
