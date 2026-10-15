// Ein-Klick-Lader für Exporte (BAUPLAN § 3.9 Export.tsx, § 1.5 Nr. 32 Auskunft): alle Zeilen einer Tabelle bzw. eines Leads,
// Seiten à 500 (E18). Integration M1–M8: vorher als lokale Kopien in features/einstellungen/daten und features/leads/daten.
import type { Json } from '@/types/database'
import type { Activity, Call, DailyActivity, Email, Lead, Tag } from '@/types/domain'
import { alleSeiten, pruefe, TIMELINE_SEITE } from './_helfer'
import { ladeTimelineSeite, type TimelineCursor } from './activities'
import { supabase } from './supabase'

/** CSV „Leads“: Ansicht „Alle“ ohne Papierkorb. */
export const ladeLeadsAlle = (): Promise<Lead[]> =>
  alleSeiten<Lead>((v, b) => supabase.from('leads').select('*').is('deleted_at', null).order('created_at').range(v, b))

export const ladeAktivitaetenAlle = (): Promise<Activity[]> =>
  alleSeiten<Activity>((v, b) => supabase.from('activities').select('*').order('occurred_at').range(v, b))

export const ladeCallsAlle = (): Promise<Call[]> =>
  alleSeiten<Call>((v, b) => supabase.from('calls').select('*').order('started_at').range(v, b))

export const ladeEmailsAlle = (): Promise<Email[]> =>
  alleSeiten<Email>((v, b) => supabase.from('emails').select('*').order('created_at').range(v, b))

export const ladeTageswerteAlle = (): Promise<DailyActivity[]> =>
  alleSeiten<DailyActivity>((v, b) => supabase.from('v_daily_activity').select('*').order('day').range(v, b))

/** Alle Aktivitäten eines Leads (Keyset-Seiten der Timeline bis zum Ende). */
export async function ladeAktivitaetenLead(leadId: string): Promise<Activity[]> {
  const alle: Activity[] = []
  let cursor: TimelineCursor = null
  for (let i = 0; i < 400; i++) {
    const seite = await ladeTimelineSeite(leadId, cursor)
    alle.push(...seite)
    const letzte = seite[seite.length - 1]
    if (seite.length < TIMELINE_SEITE || !letzte) break
    cursor = { occurredAt: letzte.occurred_at, id: letzte.id }
  }
  return alle
}

export const ladeCallsLead = (leadId: string): Promise<Call[]> =>
  alleSeiten<Call>((v, b) =>
    supabase.from('calls').select('*').eq('lead_id', leadId).order('started_at', { ascending: false }).range(v, b),
  )

export const ladeEmailsLead = (leadId: string): Promise<Email[]> =>
  alleSeiten<Email>((v, b) =>
    supabase.from('emails').select('*').eq('lead_id', leadId).order('status_at', { ascending: false }).range(v, b),
  )

export async function ladeTagsNachId(ids: readonly string[]): Promise<Tag[]> {
  if (ids.length === 0) return []
  return pruefe(
    await supabase
      .from('tags')
      .select('*')
      .in('id', [...ids]),
  )
}

/** Protokoll-Notiz „Auskunft exportiert (JSON)“ (`metadata.kind = 'auskunft_export'`, § 1.5 Nr. 32). */
export async function schreibeAuskunftNotiz(leadId: string, me: string | null, dateiname: string): Promise<Activity> {
  const metadata: Json = { kind: 'auskunft_export', file: dateiname }
  return pruefe(
    await supabase
      .from('activities')
      .insert({
        lead_id: leadId,
        type: 'notiz',
        channel: 'sonstiges',
        note: `Auskunft exportiert · ${dateiname}`,
        metadata,
        ...(me ? { member_id: me } : {}),
      })
      .select('*')
      .single(),
  )
}
