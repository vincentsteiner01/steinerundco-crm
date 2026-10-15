// BAUPLAN § 3.1.6 templates.ts: useTemplates(filter?), useTemplate(id), useTemplateSave(), useTemplatePerformance() (View).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Channel, Template, TemplatePerformance, TemplatePhase } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type TemplateFilter = { channel?: Channel; phase?: TemplatePhase; active?: boolean }
export type TemplateInsert = Database['crm']['Tables']['templates']['Insert']

export async function ladeTemplates(): Promise<Template[]> {
  return pruefe(
    await supabase.from('templates').select('*').order('channel').order('phase').order('sort_order').order('name'),
  )
}

/** Eine Query für alle Vorlagen (64 Zeilen); der Filter läuft clientseitig über `select`. */
export function useTemplates(filter?: TemplateFilter) {
  return useQuery({
    queryKey: qk.templates.all,
    queryFn: ladeTemplates,
    staleTime: 5 * 60_000,
    select: (alle: Template[]) =>
      filter
        ? alle.filter(
            (t) =>
              (filter.channel === undefined || t.channel === filter.channel) &&
              (filter.phase === undefined || t.phase === filter.phase) &&
              (filter.active === undefined || t.active === filter.active),
          )
        : alle,
  })
}

export function useTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.templates.all,
    queryFn: ladeTemplates,
    staleTime: 5 * 60_000,
    enabled: !!id,
    select: (alle: Template[]) => alle.find((t) => t.id === id) ?? null,
  })
}

/** Upsert (nach `id`; neue Vorlage ohne id → Insert, Key vergibt der Trigger templates_before_write, falls leer). */
export function useTemplateSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: TemplateInsert) =>
      pruefe(
        await supabase
          .from('templates')
          .upsert({ ...t, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.templates.all })
    },
  })
}

export function useTemplatePerformance() {
  return useQuery({
    queryKey: qk.templates.perf,
    queryFn: async (): Promise<TemplatePerformance[]> =>
      pruefe(await supabase.from('v_template_performance').select('*')),
  })
}

/** Vorlage endgültig löschen – nur erlaubt, wenn ungenutzt (BAUPLAN § 3.7 „Regeln“; die Seite prüft vorher). */
export function useTemplateLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const r = await supabase.from('templates').delete().eq('id', id)
      if (r.error) throw r.error
    },
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.templates.all })
      void qc.invalidateQueries({ queryKey: qk.templates.perf })
    },
  })
}
