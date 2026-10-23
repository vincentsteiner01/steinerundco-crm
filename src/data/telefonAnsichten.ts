// Telefon-Ansichten nach Mikes Sales Hub (23.10.2026): Kontakte (Leads mit Nummer), Deal-Pipeline (ab Erstgespräch) und
// Follow-ups (offene Aufgaben + geplante Termine). Nur Lesen – bearbeitet wird im Lead (Peek) und im Anruf-Screen.
// Keys unter qk.leads.telefon: invalidiert über leads (Präfix ['leads']), tasks und meetings (realtime.ts).
import { useQuery } from '@tanstack/react-query'
import type { CallOutcome, Enrollment, Lead, LeadStage, Meeting, Task } from '@/types/domain'
import { pruefe } from './_helfer'
import { qk } from './queryKeys'
import { supabase } from './supabase'

const LEAD_FELDER =
  'id, full_name, first_name, last_name, salutation, role_title, company_name, city, phone_e164, phone_type, phone_numbers, stage, owner_id, sales_owner_id, next_action_at, next_action_label, last_activity_at, do_not_contact, created_at'
const TERMIN_FELDER = 'id, type, status, scheduled_at, booked_at, member_id'
const AUFGABE_FELDER = 'id, kind, title, due_at, status, member_id'
const SEQUENZ_FELDER = 'id, channel, status, next_due_at'

export type TelefonTermin = Pick<Meeting, 'id' | 'type' | 'status' | 'scheduled_at' | 'booked_at' | 'member_id'>
export type TelefonAufgabe = Pick<Task, 'id' | 'kind' | 'title' | 'due_at' | 'status' | 'member_id'>
export type TelefonSequenz = Pick<Enrollment, 'id' | 'channel' | 'status' | 'next_due_at'>
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
> & { meetings: TelefonTermin[]; tasks: TelefonAufgabe[]; enrollments?: TelefonSequenz[] }

const MIT_BEZUG = `${LEAD_FELDER}, meetings(${TERMIN_FELDER}), tasks(${AUFGABE_FELDER}), enrollments(${SEQUENZ_FELDER})`

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

export type LetzterKontakt = { zeit: string; art: 'notiz' | 'anruf'; outcome: CallOutcome | null; text: string | null }

/**
 * Letzte Notizen und Anrufe je Lead (neueste zuerst, max. 5 je Lead) – Spalte „Letzte Notiz“ und Verlauf in der Schnellnotiz
 * (23.10.2026, Mike: „direkt eine Notiz machen, ohne in der Akte zu wühlen“).
 */
export function useLetzteKontakte(leadIds: readonly string[]) {
  const ids = [...leadIds].sort()
  return useQuery({
    queryKey: [...qk.leads.telefon, 'notizen', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, LetzterKontakt[]>> => {
      const notizen: { lead_id: string; note: string | null; occurred_at: string }[] = []
      const anrufe: { lead_id: string; outcome: CallOutcome; note: string | null; started_at: string }[] = []
      for (let i = 0; i < ids.length; i += 150) {
        const teil = ids.slice(i, i + 150)
        const [n, a] = await Promise.all([
          supabase
            .from('activities')
            .select('lead_id, note, occurred_at')
            .eq('type', 'notiz')
            .in('lead_id', teil)
            .order('occurred_at', { ascending: false })
            .range(0, 999),
          supabase
            .from('calls')
            .select('lead_id, outcome, note, started_at')
            .eq('corrected', false)
            .in('lead_id', teil)
            .order('started_at', { ascending: false })
            .range(0, 999),
        ])
        notizen.push(...(pruefe(n) as typeof notizen))
        anrufe.push(...(pruefe(a) as typeof anrufe))
      }
      const m = new Map<string, LetzterKontakt[]>()
      const dazu = (id: string, k: LetzterKontakt) => m.set(id, [...(m.get(id) ?? []), k])
      for (const x of notizen) dazu(x.lead_id, { zeit: x.occurred_at, art: 'notiz', outcome: null, text: x.note })
      for (const x of anrufe) dazu(x.lead_id, { zeit: x.started_at, art: 'anruf', outcome: x.outcome, text: x.note })
      for (const [id, liste] of m) m.set(id, liste.sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 5))
      return m
    },
  })
}
