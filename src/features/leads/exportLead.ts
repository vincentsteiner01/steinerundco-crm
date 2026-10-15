// BAUPLAN § 3.3 `exportLead.ts` / § 1.5 Nr. 32 (LD-12): Lead + Firma + Aktivitäten + Anrufe + E-Mails + Termine + Aufgaben +
// Vernetzungen + Enrollments + Tags → JSON `lead-<kurzId>-<YYYY-MM-DD>.json` (lib/csv.downloadJson); protokolliert als Notiz
// `metadata.kind = 'auskunft_export'`. Kein Voll-Backup, keine Auskunft über alle Leads (v1.1 Nr. 11).
import {
  ladeAktivitaetenLead,
  ladeCallsLead,
  ladeEmailsLead,
  ladeTagsNachId,
  schreibeAuskunftNotiz,
} from '@/data/export'
import { ladeLead } from '@/data/leads'
import { queryClient } from '@/data/queryClient'
import { qk } from '@/data/queryKeys'
import { downloadJson } from '@/lib/csv'
import { heuteBerlin } from '@/lib/format'
import { kurzId } from '@/lib/ids'
import type {
  Activity,
  Call,
  Company,
  Email,
  Enrollment,
  Lead,
  LinkedinConnection,
  Meeting,
  Tag,
  Task,
} from '@/types/domain'

export type Auskunft = {
  exported_at: string
  lead: Lead
  company: Company | null
  activities: Activity[]
  calls: Call[]
  emails: Email[]
  meetings: Meeting[]
  tasks: Task[]
  linkedin_connections: LinkedinConnection[]
  enrollments: Enrollment[]
  tags: Tag[]
}

/** Die zehn Abschnitte der Auskunft (Test LD-12 prüft Vollständigkeit). */
export const AUSKUNFT_ABSCHNITTE = [
  'lead',
  'company',
  'activities',
  'calls',
  'emails',
  'meetings',
  'tasks',
  'linkedin_connections',
  'enrollments',
  'tags',
] as const

export function auskunftDateiname(leadId: string, heute: string = heuteBerlin()): string {
  return `lead-${kurzId(leadId)}-${heute}.json`
}

export async function ladeAuskunft(leadId: string): Promise<Auskunft> {
  const voll = await ladeLead(leadId)
  const { companies, enrollments, tasks, meetings, linkedin_connections, lead_tags, ...lead } = voll
  const [activities, calls, emails, tags] = await Promise.all([
    ladeAktivitaetenLead(leadId),
    ladeCallsLead(leadId),
    ladeEmailsLead(leadId),
    ladeTagsNachId((lead_tags ?? []).map((t) => t.tag_id)),
  ])
  return {
    exported_at: new Date().toISOString(),
    lead: lead as Lead,
    company: companies ?? null,
    activities,
    calls,
    emails,
    meetings: meetings ?? [],
    tasks: tasks ?? [],
    linkedin_connections: linkedin_connections ?? [],
    enrollments: enrollments ?? [],
    tags,
  }
}

/** Lädt, lädt herunter, protokolliert. Fehler wirft der Aufrufer in den Toast (zeigeFehler). */
export async function exportLead(
  leadId: string,
  me: string | null,
): Promise<{ auskunft: Auskunft; dateiname: string }> {
  const auskunft = await ladeAuskunft(leadId)
  const dateiname = auskunftDateiname(leadId)
  downloadJson(auskunft, dateiname)
  await schreibeAuskunftNotiz(leadId, me, dateiname)
  void queryClient.invalidateQueries({ queryKey: qk.activities(leadId) })
  void queryClient.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
  return { auskunft, dateiname }
}
