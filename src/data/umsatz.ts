// Umsatz (Migration 13, 23.10.2026 aus Mikes Sales Hub): Aufträge (crm.contracts) und Zahlungseingänge (crm.payments).
// Beide Tabellen sind klein (eine Zeile je Kunde bzw. Zahlung) – vollständig laden, rechnen in features/umsatz/rechnung.ts.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Contract, ContractInsert, Payment, PaymentInsert } from '@/types/domain'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export function useAuftraege() {
  return useQuery({
    queryKey: [...qk.umsatz, 'auftraege'],
    queryFn: async (): Promise<Contract[]> =>
      pruefe(await supabase.from('contracts').select('*').order('start_date', { ascending: false }).range(0, 999)),
  })
}

export function useZahlungen() {
  return useQuery({
    queryKey: [...qk.umsatz, 'zahlungen'],
    queryFn: async (): Promise<Payment[]> =>
      pruefe(await supabase.from('payments').select('*').order('paid_on', { ascending: false }).range(0, 4999)),
  })
}

/** Anlegen (ohne `id`) oder Bearbeiten (mit `id`). */
export function useAuftragSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: ContractInsert): Promise<Contract> => {
      const { id, ...rest } = a
      return id
        ? pruefe(await supabase.from('contracts').update(rest).eq('id', id).select('*').single())
        : pruefe(await supabase.from('contracts').insert(rest).select('*').single())
    },
    onError: mutationFehler,
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.umsatz }),
  })
}

/** Löscht den Auftrag samt seinen Zahlungen (on delete cascade). */
export function useAuftragLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('contracts').delete().eq('id', id))
    },
    onError: mutationFehler,
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.umsatz }),
  })
}

export function useZahlungSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (z: PaymentInsert): Promise<Payment> => {
      const { id, ...rest } = z
      return id
        ? pruefe(await supabase.from('payments').update(rest).eq('id', id).select('*').single())
        : pruefe(await supabase.from('payments').insert(rest).select('*').single())
    },
    onError: mutationFehler,
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.umsatz }),
  })
}

export function useZahlungLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      pruefe(await supabase.from('payments').delete().eq('id', id))
    },
    onError: mutationFehler,
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.umsatz }),
  })
}
