// QueueItems je Sektion (synthetisch) – Spalten wie v_today_queue (BAUPLAN § 4.2)
import type { QueueItem, QueueSection } from '@/types/domain'
import { LEADS, MEMBER_V } from './leads'

export function queueItem(section: QueueSection, i: number, patch: Partial<QueueItem> = {}): QueueItem {
  const lead = LEADS[i % LEADS.length] as (typeof LEADS)[number]
  const ORDER: Record<QueueSection, number> = {
    antworten: 1,
    ueberfaellig: 2,
    heute: 3,
    annahme_pruefen: 4,
    neue_anfragen: 5,
    zurueckziehen: 6,
    kommend: 7,
  }
  const basis = {
    member_id: MEMBER_V,
    section,
    section_order: ORDER[section],
    item_kind:
      section === 'antworten'
        ? 'antworten'
        : section === 'annahme_pruefen'
          ? 'annahme_pruefen'
          : section === 'neue_anfragen'
            ? 'neue_anfrage'
            : section === 'zurueckziehen'
              ? 'zurueckziehen'
              : 'sequenz_schritt',
    item_id: `40000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    lead_id: lead.id,
    lead_name: lead.full_name,
    company_name: lead.company_name,
    stage: lead.stage,
    stage_rank: 20,
    channel: 'linkedin',
    due_at: '2026-10-14T09:00:00+02:00',
    due_date: '2026-10-14',
    days_overdue: section === 'ueberfaellig' ? 2 : 0,
    title: 'Kurzfristig 2',
    subtitle: 'Tag 7 nach KF 1',
    template_id: null,
    enrollment_id: `50000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    step_id: null,
    task_id: null,
    meeting_id: null,
    connection_id: null,
    snooze_count: 0,
    linkedin_url: lead.linkedin_url,
    phone_e164: lead.phone_e164,
    email: lead.email,
    salutation: lead.salutation,
    first_name: lead.first_name,
    last_name: lead.last_name,
    owner_id: lead.owner_id,
    priority: 0,
    do_not_contact: false,
    last_activity_at: null,
    last_activity_type: null,
    follow_up_count: 1,
    rank_score: 100 - i,
    lead_created_at: lead.created_at,
  }
  return { ...(basis as unknown as QueueItem), ...patch }
}

export const QUEUE: QueueItem[] = [
  queueItem('antworten', 1),
  queueItem('ueberfaellig', 2),
  queueItem('ueberfaellig', 3),
  queueItem('heute', 4),
  queueItem('heute', 5),
  queueItem('annahme_pruefen', 6),
  queueItem('neue_anfragen', 7),
  queueItem('zurueckziehen', 8),
  queueItem('kommend', 9),
]
