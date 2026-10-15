// BAUPLAN § 3.1.6 sperrliste.ts: useSperrliste(), useSperrlisteEintrag(), useSperrlisteEntfernen() (§ 8.4).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { SperrlisteEintrag } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type SperrlisteInsert = Database['crm']['Tables']['sperrliste']['Insert']

/** Ganze Sperrliste (auch außerhalb von Komponenten, z. B. Palette-Befehl mit Gate-Prüfung). */
export async function ladeSperrliste(): Promise<SperrlisteEintrag[]> {
  return pruefe(await supabase.from('sperrliste').select('*').order('created_at', { ascending: false }))
}

export function useSperrliste() {
  return useQuery({ queryKey: qk.sperrliste, queryFn: ladeSperrliste })
}

export function useSperrlisteEintrag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: SperrlisteInsert): Promise<SperrlisteEintrag> =>
      pruefe(await supabase.from('sperrliste').insert(e).select('*').single()),
    onError: mutationFehler,
    onSettled: (_d, _e, e) => {
      void qc.invalidateQueries({ queryKey: qk.sperrliste })
      if (e.lead_id) void qc.invalidateQueries({ queryKey: qk.leads.detail(e.lead_id) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
    },
  })
}

export function useSperrlisteEntfernen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('sperrliste').delete().eq('id', id))
    },
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sperrliste })
    },
  })
}
