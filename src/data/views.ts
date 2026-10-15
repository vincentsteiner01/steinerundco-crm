// BAUPLAN § 3.1.6 views.ts: useSavedViews(entity) + Speichern/Löschen (M2 „Ansichten“).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { SavedView } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type SavedViewInsert = Database['crm']['Tables']['saved_views']['Insert']

export function useSavedViews(entity: string) {
  return useQuery({
    queryKey: qk.views(entity),
    queryFn: async (): Promise<SavedView[]> =>
      pruefe(await supabase.from('saved_views').select('*').eq('entity', entity).order('sort_order').order('name')),
  })
}

export function useSavedViewSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SavedViewInsert): Promise<SavedView> =>
      pruefe(
        await supabase
          .from('saved_views')
          .upsert({ ...v, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: qk.views(v.entity) })
    },
  })
}

export function useSavedViewLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; entity: string }) => {
      pruefe(await supabase.from('saved_views').delete().eq('id', p.id))
    },
    onError: mutationFehler,
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.views(p.entity) })
    },
  })
}
