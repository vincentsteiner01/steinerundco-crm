// BAUPLAN § 3.1.6 outbound.ts: useLogOutbound() → rpc.logOutbound (§ 1.5 Nr. 25); optimistisch verschwindet die Antworten-Karte.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueueItem } from '@/types/domain'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'

export type LogOutboundEingabe = Parameters<typeof rpc.logOutbound>[0]

export function useLogOutbound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: LogOutboundEingabe) => rpc.logOutbound(p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: qk.queue.all })
      const vorher = qc.getQueriesData<QueueItem[]>({ queryKey: qk.queue.all })
      qc.setQueriesData<QueueItem[]>({ queryKey: qk.queue.all }, (alt) =>
        alt?.filter((i) => !(i.lead_id === p.leadId && i.section === 'antworten')),
      )
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      for (const [key, daten] of ctx?.vorher ?? []) qc.setQueryData(key, daten)
      mutationFehler(e)
    },
    onSettled: (_d, _e, p) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.activities(p.leadId) })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}
