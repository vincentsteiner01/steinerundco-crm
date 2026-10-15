// Invalidierung nach RPC-Aufrufen ohne Hook (log_request, mark_accepted): Detail, Listen, Vernetzungen, Timeline, Queue, Nav, KPIs.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { qk } from '@/data/queryKeys'

export function useLeadInvalidierungLokal(): (leadId: string) => void {
  const qc = useQueryClient()
  return useCallback(
    (leadId: string) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.connections.lead(leadId) })
      void qc.invalidateQueries({ queryKey: ['connections', 'offen'] })
      void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
      void qc.invalidateQueries({ queryKey: qk.enrollments(leadId) })
      void qc.invalidateQueries({ queryKey: qk.tasks.lead(leadId) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.nav })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
    [qc],
  )
}
