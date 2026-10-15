// BAUPLAN § 3.1.6 undo.ts: useUndo() → { anbieten(activityId, label, leadId?), ausfuehren() } (E16, § 1.5 Nr. 8/29/43).
// `anbieten` zeigt den Undo-Toast (6 s, „Rückgängig Z“); `Z`/Klick ruft rpc.undoActivity und invalidiert leads.all, queue.all, activities(leadId).
import { useCallback } from 'react'
import { registriereUndo, toast, toastUndo, undoAusfuehren } from '@/components/toast'
import { TOAST } from '@/texte/de'
import { zeigeFehler } from './errors'
import { queryClient } from './queryClient'
import { qk } from './queryKeys'
import { rpc } from './rpc'

const leadJeActivity = new Map<number, string>()

/** Führt das Undo aus (vom Toast/`Z` über registriereUndo aufgerufen) – eine Activity oder ein Stapel (Bulk, LE-08). */
export async function undoActivityAusfuehren(ziel: number | readonly number[]): Promise<void> {
  const ids = typeof ziel === 'number' ? [ziel] : [...ziel]
  try {
    for (const activityId of ids) await rpc.undoActivity({ activityId })
    const leadIds = ids.map((id) => leadJeActivity.get(id))
    for (const id of ids) leadJeActivity.delete(id)
    const alleBekannt = leadIds.every((l): l is string => !!l)
    void queryClient.invalidateQueries({ queryKey: qk.leads.all })
    void queryClient.invalidateQueries({ queryKey: qk.queue.all })
    if (alleBekannt)
      for (const l of new Set(leadIds)) void queryClient.invalidateQueries({ queryKey: qk.activities(l) })
    else void queryClient.invalidateQueries({ queryKey: ['activities'] })
    void queryClient.invalidateQueries({ queryKey: ['activities', 'zeitraum'] })
    void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['connections'] })
    void queryClient.invalidateQueries({ queryKey: qk.kpis.all })
    void queryClient.invalidateQueries({ queryKey: qk.nav })
    toast(TOAST.rueckgaengigGemacht)
  } catch (e) {
    zeigeFehler(e)
  }
}

registriereUndo(undoActivityAusfuehren)

export function useUndo() {
  /** Undo-Toast für eine Activity oder einen Stapel (Bulk); ein leerer Stapel zeigt nur den Text. */
  const anbieten = useCallback((activityId: number | readonly number[], label: string, leadId?: string) => {
    const ids = typeof activityId === 'number' ? [activityId] : activityId
    if (leadId) for (const id of ids) leadJeActivity.set(id, leadId)
    return toastUndo(label, activityId)
  }, [])
  const ausfuehren = useCallback(() => undoAusfuehren(), [])
  return { anbieten, ausfuehren }
}
