// BAUPLAN § 3.1.6 tags.ts: Liste + Upsert; Lead-Tag setzen/entfernen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Tag } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type TagInsert = Database['crm']['Tables']['tags']['Insert']

export function useTags() {
  return useQuery({
    queryKey: qk.tags,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Tag[]> =>
      pruefe(await supabase.from('tags').select('*').order('sort_order').order('name')),
  })
}

export function useTagUpsert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: TagInsert): Promise<Tag> =>
      pruefe(await supabase.from('tags').upsert(t, { onConflict: 'name' }).select('*').single()),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.tags })
    },
  })
}

export function useLeadTagSetzen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { leadId: string; tagId: string }) => {
      pruefe(await supabase.from('lead_tags').upsert({ lead_id: p.leadId, tag_id: p.tagId }))
    },
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
    },
  })
}

export function useLeadTagEntfernen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { leadId: string; tagId: string }) => {
      pruefe(await supabase.from('lead_tags').delete().eq('lead_id', p.leadId).eq('tag_id', p.tagId))
    },
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
    },
  })
}
