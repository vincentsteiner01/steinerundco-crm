// Team (/team): Abfragen, die src/data nicht hat (BAUPLAN § 3.0 Nr. 4) – Team-Protokoll (Aktivitäten beider Personen im Zeitraum,
// Keyset 50, mit Lead-Namen) und „zuletzt aktiv“. Keys verlängern qk.activitiesZeitraum: Realtime invalidiert das Präfix
// ['activities', 'zeitraum'] bei jeder Aktivität (data/realtime.ts) – das Protokoll ist damit live.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { pruefe, qk, zeitraumGrenzen } from '@/data'
import { supabase } from '@/data/supabase'
import type { Activity, Channel } from '@/types/domain'
import { juengster } from '../kennzahlen'

export const PROTOKOLL_SEITE = 50

export type ProtokollLead = { full_name: string | null; company_name: string | null; deleted_at: string | null }
export type ProtokollZeile = Activity & { lead: ProtokollLead | null }
export type ProtokollCursor = { occurredAt: string; id: number } | null
export type ProtokollFilter = {
  /** Mitglieder (Beide = beide IDs); leer = keine Abfrage */
  memberIds: readonly string[]
  kanal: Channel | null
  von: string
  bis: string
}

// `!activities_lead_id_fkey`: activities.lead_id zeigt auch auf die View v_leads_ohne_bewegung – ohne Hinweis wäre das Embed mehrdeutig
const SPALTEN = '*, lead:leads!activities_lead_id_fkey(full_name, company_name, deleted_at)'

/** PostgREST-Keyset „älter als (occurred_at, id)“ – gleiches Muster wie die Lead-Timeline (data/activities.ts). */
export function keysetFilter(c: NonNullable<ProtokollCursor>): string {
  return `occurred_at.lt.${c.occurredAt},and(occurred_at.eq.${c.occurredAt},id.lt.${c.id})`
}

export function naechsterCursor(seite: readonly Pick<Activity, 'occurred_at' | 'id'>[]): ProtokollCursor | undefined {
  const l = seite[seite.length - 1]
  return seite.length < PROTOKOLL_SEITE || !l ? undefined : { occurredAt: l.occurred_at, id: l.id }
}

export async function ladeProtokollSeite(f: ProtokollFilter, cursor: ProtokollCursor): Promise<ProtokollZeile[]> {
  const { ab, vor } = zeitraumGrenzen(f.von, f.bis)
  let q = supabase
    .from('activities')
    .select(SPALTEN)
    .in('member_id', [...f.memberIds])
    .gte('occurred_at', ab)
    .lt('occurred_at', vor)
  if (f.kanal) q = q.eq('channel', f.kanal)
  if (cursor) q = q.or(keysetFilter(cursor))
  const zeilen = pruefe(
    await q.order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(PROTOKOLL_SEITE),
  )
  return zeilen as unknown as ProtokollZeile[]
}

export function useTeamProtokoll(f: ProtokollFilter) {
  const person = f.memberIds.length === 1 ? (f.memberIds[0] as string) : 'team'
  return useInfiniteQuery({
    queryKey: [
      ...qk.activitiesZeitraum(person, f.von, f.bis, []),
      'team-protokoll',
      [...f.memberIds].sort().join(','),
      f.kanal ?? 'alle',
    ] as const,
    enabled: f.memberIds.length > 0,
    initialPageParam: null as ProtokollCursor,
    queryFn: ({ pageParam }) => ladeProtokollSeite(f, pageParam),
    getNextPageParam: (letzte) => naechsterCursor(letzte),
  })
}

/**
 * Zuletzt aktiv: jüngste in der App erfasste Aktivität (`created_at`, Quelle `app` – zählt auch rückdatierte Einträge als „jetzt
 * aktiv“) oder, falls jünger, der jüngste Zeitpunkt einer Aktivität überhaupt (`occurred_at` ≤ jetzt, z. B. aus dem Import).
 */
export async function ladeZuletztAktiv(memberId: string): Promise<string | null> {
  const jetzt = new Date().toISOString()
  const [app, alle] = await Promise.all([
    supabase
      .from('activities')
      .select('created_at')
      .eq('member_id', memberId)
      .eq('source', 'app')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('activities')
      .select('occurred_at')
      .eq('member_id', memberId)
      .lte('occurred_at', jetzt)
      .order('occurred_at', { ascending: false })
      .limit(1),
  ])
  const a = pruefe(app)[0]?.created_at ?? null
  const b = pruefe(alle)[0]?.occurred_at ?? null
  return juengster(a, b)
}

export function useZuletztAktiv(memberId: string | null | undefined) {
  return useQuery({
    queryKey: [...qk.activitiesZeitraum(memberId ?? '', 'zuletzt', 'zuletzt', []), 'team-zuletzt-aktiv'] as const,
    enabled: !!memberId,
    queryFn: () => ladeZuletztAktiv(memberId as string),
    staleTime: 30_000,
  })
}
