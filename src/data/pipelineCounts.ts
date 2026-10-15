// Zähler je Stufe (v_pipeline_counts) – eigenes Modul, weil die Navigation (useNavZaehler) ihn im Start-Bundle braucht:
// aus data/leads.ts importiert, zog er die ganze Lead-Datenschicht (≈ 3 kB gzip) ins initiale JS (E22, Runde 2).
import { useQuery } from '@tanstack/react-query'
import type { PipelineCount } from '@/types/domain'
import { pruefe } from './_helfer'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export function usePipelineCounts() {
  return useQuery({
    queryKey: qk.leads.pipeline,
    queryFn: async (): Promise<PipelineCount[]> => pruefe(await supabase.from('v_pipeline_counts').select('*')),
  })
}
