// BAUPLAN § 3.1.6 settings.ts: useSettings() (alle Keys als Objekt), useSetting(key), useSettingsUpdate() (Upsert mit Objekt-Merge).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/types/database'
import type { Settings } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type SettingsKey = keyof Settings

export async function ladeSettings(): Promise<Settings> {
  const zeilen = pruefe(await supabase.from('settings').select('key,value'))
  const o: Record<string, unknown> = {}
  for (const z of zeilen) o[z.key] = z.value
  return o as Settings
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: ladeSettings, staleTime: 5 * 60_000 })
}

export function useSetting<K extends SettingsKey>(key: K): Settings[K] | undefined {
  const { data } = useSettings()
  return data?.[key]
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** `value` ist bei Objekt-Keys ein Teil-Objekt (Merge), sonst der ganze Wert. */
export type SettingsPatch = {
  [K in SettingsKey]: { key: K; value: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] }
}[SettingsKey]

/** Upsert eines Keys. Objekt-Werte werden flach gemergt (wie der Seed: `excluded.value || value`), Skalare/Arrays ersetzt. Optimistisch. */
export function useSettingsUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: SettingsPatch) => {
      const aktuell = qc.getQueryData<Settings>(qk.settings)?.[p.key]
      const wert = istObjekt(aktuell) && istObjekt(p.value) ? { ...aktuell, ...p.value } : p.value
      const z = pruefe(
        await supabase
          .from('settings')
          .upsert({ key: p.key, value: wert as Json, updated_at: new Date().toISOString() }, { onConflict: 'key' })
          .select('key,value')
          .single(),
      )
      return z
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: qk.settings })
      const vorher = qc.getQueryData<Settings>(qk.settings)
      if (vorher) {
        const aktuell = vorher[p.key]
        const wert = istObjekt(aktuell) && istObjekt(p.value) ? { ...aktuell, ...p.value } : p.value
        qc.setQueryData<Settings>(qk.settings, { ...vorher, [p.key]: wert })
      }
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      if (ctx?.vorher) qc.setQueryData(qk.settings, ctx.vorher)
      mutationFehler(e)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.settings }),
  })
}
