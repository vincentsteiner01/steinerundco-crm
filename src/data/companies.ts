// BAUPLAN § 3.1.6 companies.ts: useCompanies() (inkl. do_not_contact → Chip „Firma gesperrt“, § 1.5 Nr. 27) + Upsert.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { Company } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type CompanyInsert = Database['crm']['Tables']['companies']['Insert']

export function useCompanies() {
  return useQuery({
    queryKey: qk.companies,
    staleTime: 60_000,
    queryFn: async (): Promise<Company[]> =>
      pruefe(await supabase.from('companies').select('*').order('name').range(0, 999)),
  })
}

/** Normalform wie `crm.company_norm` (Leerraum zusammengefasst, getrimmt, klein) – Schlüssel des Unique-Index `name_norm`. */
export function firmaNorm(name: string | null | undefined): string | null {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return n || null
}

/** Firma aus einer geladenen Liste (useCompanies) zum Namen – ohne Request (z. B. Chip „Firma gesperrt“ im Formular). */
export function firmaInListe(
  liste: readonly Company[] | null | undefined,
  name: string | null | undefined,
): Company | null {
  const norm = firmaNorm(name)
  if (!norm || !liste) return null
  return liste.find((c) => (c.name_norm ?? firmaNorm(c.name)) === norm) ?? null
}

/**
 * Firma zum Namen: vorhandene Zeile über `name_norm`, sonst neu anlegen. Leads verknüpfen damit `company_id` – die Firmensperre
 * (§ 1.5 Nr. 27) wirkt nur über die Verknüpfung, und `leads_before_write` überschreibt `company_name` aus der Firma (Review M2).
 */
export async function firmaFuerName(name: string): Promise<Company> {
  const norm = firmaNorm(name)
  if (!norm) throw new Error('Firmenname fehlt')
  const finde = async (): Promise<Company | null> =>
    pruefe(await supabase.from('companies').select('*').eq('name_norm', norm).limit(1))[0] ?? null
  const da = await finde()
  if (da) return da
  const neu = await supabase
    .from('companies')
    .insert({ name: name.replace(/\s+/g, ' ').trim() })
    .select('*')
    .single()
  if (!neu.error && neu.data) return neu.data
  // Zeitgleich von der anderen Person angelegt (Unique-Index name_norm) → deren Zeile verwenden
  const nochmal = await finde()
  if (nochmal) return nochmal
  throw neu.error ?? new Error('Firma nicht angelegt')
}

export function useCompanyUpsert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CompanyInsert): Promise<Company> =>
      pruefe(
        await supabase
          .from('companies')
          .upsert({ ...c, updated_at: new Date().toISOString() })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.companies })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
    },
  })
}
