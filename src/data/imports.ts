// BAUPLAN § 3.1.6 imports.ts: useImportBatches() (ohne payload), useImportBatch(id) + Import-RPC-Hooks (M7).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ImportBatch } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

const OHNE_PAYLOAD =
  'id, source, label, preset, file_name, member_id, row_count, inserted, updated, skipped, blocked, summary, undone_at, created_at'
export type ImportBatchKurz = Omit<ImportBatch, 'payload'>

export function useImportBatches() {
  return useQuery({
    queryKey: qk.imports.all,
    queryFn: async (): Promise<ImportBatchKurz[]> =>
      pruefe(
        await supabase.from('import_batches').select(OHNE_PAYLOAD).order('created_at', { ascending: false }).limit(200),
      ),
  })
}

export function useImportBatch(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.imports.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<ImportBatch> =>
      pruefe(
        await supabase
          .from('import_batches')
          .select('*')
          .eq('id', id as string)
          .single(),
      ),
  })
}

function useImportInvalidierung() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qk.imports.all })
    void qc.invalidateQueries({ queryKey: qk.leads.all })
    void qc.invalidateQueries({ queryKey: qk.companies })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.nav })
    void qc.invalidateQueries({ queryKey: qk.kpis.all })
  }
}

export function useImportLeads() {
  const inval = useImportInvalidierung()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.importLeads>[0]) => rpc.importLeads(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      if (!p.dryRun) inval()
    },
  })
}

export function useUndoImport() {
  const inval = useImportInvalidierung()
  return useMutation({
    mutationFn: (p: { batchId: string }) => rpc.undoImport(p),
    onError: mutationFehler,
    onSettled: () => inval(),
  })
}

export function useImportTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { rows: Parameters<typeof rpc.importTemplates>[0]['rows'] }) => rpc.importTemplates(p),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.templates.all })
    },
  })
}
