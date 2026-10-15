// Schreibwege für Felder, die NICHT direkt am Lead liegen (Review-Korrektur M2): Unternehmen (`company_id`, sonst überschreibt
// `leads_before_write` den Namen aus der verknüpften Firma) und „Nächste Aktion“ (`next_action_*` pflegt recompute_lead_next_action
// aus Enrollments/Tasks/Meetings – der Client verschiebt deshalb die Quelle, nie `next_action_at` selbst).
import { useCallback } from 'react'
import { toast } from '@/components/toast'
import { firmaFuerName } from '@/data/companies'
import { useSnoozeStep } from '@/data/enrollments'
import { useMeId } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useSnoozeTask, useTaskErstellen } from '@/data/tasks'
import { fmtDatum, fmtDatumKurz, MINUS } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import type { Lead, LeadUpdate } from '@/types/domain'
import { naechsteAktionIso } from './hilfen'

/** Titel der Aufgabe, wenn ein Lead ohne nächste Aktion ein Datum bekommt. */
export const NACHFASSEN_TITEL = 'Nachfassen'

/** Unternehmen setzen: Firma per Name finden oder anlegen und verknüpfen; leer = Verknüpfung lösen. */
export async function firmaPatch(name: string | null | undefined): Promise<LeadUpdate> {
  const n = name?.trim()
  if (!n) return { company_id: null, company_name: null }
  const firma = await firmaFuerName(n)
  return { company_id: firma.id, company_name: firma.name }
}

export type NaechsteAktionLead = Pick<Lead, 'id' | 'owner_id' | 'next_action_kind' | 'next_action_ref'>

/**
 * „Nächste Aktion“ auf einen Tag legen (LE-06): Sequenzschritt → `snooze_step(until)`, Rückruf/Wiedervorlage/Aufgabe →
 * `snooze_task(until)`, ohne nächste Aktion → neue Aufgabe „Nachfassen“. Termine verschiebt man im Termin selbst.
 * Rückgabe: `true`, wenn etwas gespeichert wurde.
 */
export function useNaechsteAktionSetzen(): (lead: NaechsteAktionLead, tag: string | null) => Promise<boolean> {
  const snoozeStep = useSnoozeStep()
  const snoozeTask = useSnoozeTask()
  const aufgabe = useTaskErstellen()
  const me = useMeId()
  const { data: settings } = useSettings()
  return useCallback(
    async (lead, tag) => {
      if (!tag) {
        toast('Nächste Aktion lässt sich nicht leeren – Schritt erledigen, verschieben oder beenden.')
        return false
      }
      const until = naechsteAktionIso(tag, settings?.queue.due_time)
      const ref = lead.next_action_ref
      try {
        switch (lead.next_action_kind) {
          case 'sequenz_schritt':
            if (!ref) return false
            await snoozeStep.mutateAsync({ enrollmentId: ref, leadId: lead.id, until })
            break
          case 'rueckruf':
          case 'wiedervorlage':
          case 'aufgabe':
            if (!ref) return false
            await snoozeTask.mutateAsync({ taskId: ref, leadId: lead.id, until })
            break
          case 'meeting':
            toast('Termine verschiebst du im Termin selbst.')
            return false
          default:
            await aufgabe.mutateAsync({
              lead_id: lead.id,
              member_id: lead.owner_id ?? me,
              kind: 'aufgabe',
              title: NACHFASSEN_TITEL,
              due_at: until,
              created_by: me,
            })
        }
      } catch {
        return false // Fehler-Toast kommt aus den Hooks (onError)
      }
      toast(`Nächste Aktion am ${fmtDatumKurz(tag)}`) // Datum endet mit Punkt („Do 22.10.“)
      return true
    },
    [snoozeStep, snoozeTask, aufgabe, me, settings],
  )
}

/** Nächster Follow-up: Datum, bei Überfälligkeit mit „−n T“ (Runde 3: 07.10.2026 stand bei −8 T in ink, nur die Timeline war Amber). */
export function naechsterFollowUp(
  nextActionAt: string | null,
  label: string | null,
  jetzt: Date | string = new Date(),
): { wert: string | null; ueberfaellig: boolean } {
  if (!nextActionAt) return { wert: null, ueberfaellig: false }
  const diff = tageDifferenz(berlinTag(jetzt), berlinTag(nextActionAt))
  const ueberfaellig = diff < 0
  const teile = [`${fmtDatum(nextActionAt)}${ueberfaellig ? ` ${MINUS}${Math.abs(diff)}\u00a0T` : ''}`]
  if (label) teile.push(label)
  return { wert: teile.join(' · '), ueberfaellig }
}
