// BAUPLAN § 3.1.6 sperrliste.ts: useSperrliste(), useSperrlisteEintrag(), useSperrlisteEntfernen() (§ 8.4).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { sperrlistenEintraege } from '@/lib/gates'
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

/** Felder eines Leads, über die die Sperrliste trifft (Lead-ID, Telefon, E-Mail, LinkedIn-URL). */
export type SperrlistenPerson = Parameters<typeof sperrlistenEintraege>[1]
export type SperrlistenStatus = { eintraege: SperrlisteEintrag[]; gesperrt: boolean }

/**
 * Sperrlisten-Treffer genau dieser Person (QA Runde 3: der rote Chip „Sperrliste“ stand an jedem Lead, weil ein leeres
 * Treffer-Array als wahr galt). `gesperrt` ist nur bei mindestens einem Treffer wahr – Komponenten prüfen `gesperrt`, nie das Array.
 * Solange die Liste lädt: keine Treffer.
 */
export function sperrlistenStatus(
  liste: readonly SperrlisteEintrag[] | null | undefined,
  person: SperrlistenPerson | null | undefined,
): SperrlistenStatus {
  const eintraege = person ? sperrlistenEintraege(liste, person) : []
  return { eintraege, gesperrt: eintraege.length > 0 }
}

/** Hook zu `sperrlistenStatus` (teilt den Cache mit `useSperrliste`; Ergebnis stabil, solange Liste und Person-Felder gleich bleiben). */
export function useSperrlistenTreffer(person: SperrlistenPerson | null | undefined) {
  const { data } = useSperrliste()
  const hatPerson = !!person
  const id = person?.id
  const tel = person?.phone_e164
  const mail = person?.email
  const url = person?.linkedin_url_norm
  return useMemo(
    () => sperrlistenStatus(data, hatPerson ? { id, phone_e164: tel, email: mail, linkedin_url_norm: url } : null),
    [data, hatPerson, id, tel, mail, url],
  )
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
