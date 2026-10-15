// BAUPLAN § 3.1.6 sequences.ts: useSequences() → SequenceMitSchritten[] (ein Request), stepsById, useSequenceStepSave().
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { SequenceMitSchritten, SequenceStep } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type SequenceStepInsert = Database['crm']['Tables']['sequence_steps']['Insert']
export type SequenceInsert = Database['crm']['Tables']['sequences']['Insert']

export async function ladeSequences(): Promise<SequenceMitSchritten[]> {
  const zeilen = pruefe(await supabase.from('sequences').select('*, sequence_steps(*)').order('channel').order('name'))
  return zeilen.map((z) => {
    const { sequence_steps, ...seq } = z as typeof z & { sequence_steps: SequenceStep[] }
    return { ...seq, steps: [...sequence_steps].sort((a, b) => a.position - b.position) }
  })
}

export function useSequences() {
  return useQuery({ queryKey: qk.sequences, queryFn: ladeSequences, staleTime: 5 * 60_000 })
}

/** Index über alle Sequenzen: `stepsById` (Opener-Erkennung § 5.4) und `byKey` (SequenzStartenMenue). */
export function useSequencesIndex() {
  return useQuery({
    queryKey: qk.sequences,
    queryFn: ladeSequences,
    staleTime: 5 * 60_000,
    select: (sequenzen: SequenceMitSchritten[]) => {
      const stepsById = new Map<string, SequenceStep & { sequence_key: string }>()
      const byKey = new Map<string, SequenceMitSchritten>()
      for (const s of sequenzen) {
        byKey.set(s.key, s)
        for (const st of s.steps) stepsById.set(st.id, { ...st, sequence_key: s.key })
      }
      return { sequenzen, stepsById, byKey }
    },
  })
}

export function useSequenceStepSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: SequenceStepInsert) =>
      pruefe(
        await supabase
          .from('sequence_steps')
          .upsert({ ...s, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sequences })
    },
  })
}

export function useSequenceSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: SequenceInsert) =>
      pruefe(
        await supabase
          .from('sequences')
          .upsert({ ...s, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sequences })
    },
  })
}

export function useSequenceStepLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('sequence_steps').delete().eq('id', id))
    },
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sequences })
    },
  })
}
