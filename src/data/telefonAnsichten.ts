// Telefon-Ansichten nach Mikes Sales Hub (23.10.2026): Kontakte (Leads mit Nummer), Deal-Pipeline (ab Erstgespräch) und
// Follow-ups (offene Aufgaben + geplante Termine). Nur Lesen – bearbeitet wird im Lead (Peek) und im Anruf-Screen.
// Keys unter qk.leads.telefon: invalidiert über leads (Präfix ['leads']), tasks und meetings (realtime.ts).
import { useQuery } from '@tanstack/react-query'
import type { Lead, LeadStage, Meeting, Task } from '@/types/domain'
import { pruefe } from './_helfer'
import { qk } from './queryKeys'
import { supabase } from './supabase'

const LEAD_FELDER =
  'id, full_name, first_name, last_name, salutation, role_title, company_name, city, phone_e164, phone_type, phone_numbers, stage, owner_id, sales_owner_id, next_action_at, next_action_label, last_activity_at, do_not_contact, created_at'
const TERMIN_FELDER = 'id, type, status, scheduled_at, booked_at, member_id'
const AUFGABE_FELDER = 'id, kind, title, due_at, status, member_id'

export type TelefonTermin = Pick<Meeting, 'id' | 'type' | 'status' | 'scheduled_at' | 'booked_at' | 'member_id'>
export type TelefonAufgabe = Pick<Task, 'id' | 'kind' | 'title' | 'due_at' | 'status' | 'member_id'>
export type TelefonLead = Pick<
  Lead,
  | 'id'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'salutation'
  | 'role_title'
  | 'company_name'
  | 'city'
  | 'phone_e164'
  | 'phone_type'
  | 'phone_numbers'
  | 'stage'
  | 'owner_id'
  | 'sales_owner_id'
  | 'next_action_at'
  | 'next_action_label'
  | 'last_activity_at'
  | 'do_not_contact'
  | 'created_at'
> & { meetings: TelefonTermin[]; tasks: TelefonAufgabe[] }

const MIT_BEZUG = `${LEAD_FELDER}, meetings(${TERMIN_FELDER}), tasks(${AUFGABE_FELDER})`

/** Alle Leads mit Telefonnummer (Mikes „Leads“-Tabelle). */
export function useTelefonKontakte() {
  return useQuery({
    queryKey: [...qk.leads.telefon, 'kontakte'],
    queryFn: async (): Promise<TelefonLead[]> =>
      pruefe(
        await supabase
          .from('leads')
          .select(MIT_BEZUG)
          .is('deleted_at', null)
          .not('phone_e164', 'is', null)
          .order('created_at', { ascending: false })
          .range(0, 1999),
      ) as unknown as TelefonLead[],
  })
}

/** Stufen ab dem Erstgespräch (Deal-Pipeline); „beendet“ nur mit Termin-Historie (eigene Abfrage). */
export const DEAL_STUFEN: readonly LeadStage[] = [
  'erstgespraech_vereinbart',
  'erstgespraech',
  'strategiegespraech_vereinbart',
  'strategiegespraech',
  'sales_follow_up',
  'kunde',
]

export function useDeals() {
  return useQuery({
    queryKey: [...qk.leads.telefon, 'deals'],
    queryFn: async (): Promise<TelefonLead[]> => {
      const [laufend, beendet] = await Promise.all([
        supabase
          .from('leads')
          .select(MIT_BEZUG)
          .is('deleted_at', null)
          .in('stage', [...DEAL_STUFEN])
          .range(0, 1999),
        // `!inner` ohne Filter: nur beendete Leads, die mindestens einen Termin hatten (also wirklich ein Deal waren)
        supabase
          .from('leads')
          .select(`${LEAD_FELDER}, meetings!inner(${TERMIN_FELDER}), tasks(${AUFGABE_FELDER})`)
          .is('deleted_at', null)
          .eq('stage', 'beendet')
          .range(0, 1999),
      ])
      return [...pruefe(laufend), ...pruefe(beendet)] as unknown as TelefonLead[]
    },
  })
}

export type FollowUpLead = Pick<
  Lead,
  'id' | 'full_name' | 'company_name' | 'city' | 'phone_e164' | 'phone_type' | 'stage' | 'deleted_at'
>
export type FollowUpAufgabe = Pick<Task, 'id' | 'kind' | 'title' | 'due_at' | 'member_id' | 'lead_id'> & {
  leads: FollowUpLead | null
}
export type FollowUpTermin = Pick<Meeting, 'id' | 'type' | 'scheduled_at' | 'member_id' | 'lead_id'> & {
  leads: FollowUpLead | null
}

const FOLLOWUP_LEAD = 'leads!inner(id, full_name, company_name, city, phone_e164, phone_type, stage, deleted_at)'

/** Offene Aufgaben (Rückruf · Wiedervorlage · Aufgabe) und geplante Termine – Mikes „Follow-ups & nächste Schritte“. */
export function useFollowUps() {
  return useQuery({
    queryKey: [...qk.leads.telefon, 'followups'],
    queryFn: async (): Promise<{ aufgaben: FollowUpAufgabe[]; termine: FollowUpTermin[] }> => {
      const [a, t] = await Promise.all([
        supabase
          .from('tasks')
          .select(`id, kind, title, due_at, member_id, lead_id, ${FOLLOWUP_LEAD}`)
          .eq('status', 'offen')
          .is('leads.deleted_at', null)
          .order('due_at', { ascending: true, nullsFirst: false })
          .range(0, 999),
        supabase
          .from('meetings')
          .select(`id, type, scheduled_at, member_id, lead_id, ${FOLLOWUP_LEAD}`)
          .eq('status', 'geplant')
          .is('leads.deleted_at', null)
          .order('scheduled_at', { ascending: true })
          .range(0, 999),
      ])
      return {
        aufgaben: pruefe(a) as unknown as FollowUpAufgabe[],
        termine: pruefe(t) as unknown as FollowUpTermin[],
      }
    },
  })
}
