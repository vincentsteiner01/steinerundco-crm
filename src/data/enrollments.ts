// BAUPLAN § 3.1.6 enrollments.ts: useEnrollments(leadId), useEnrollmentStoppen() (= complete_step(abgebrochen)),
// useEnrollmentPausieren(), useEnrollmentFortsetzen().
// Konflikt: § 4.3 listet `enrollments` nicht unter den erlaubten Direkt-Schreibzugriffen, § 3.1.6 verlangt Pausieren/Fortsetzen ohne RPC
// → BAUPLAN-intern entschieden für einen Status-Patch (RLS erlaubt Update; Trigger enrollments_before_write ergänzt Zeitstempel).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rollToWeekday } from '@/lib/werktage'
import { tagZuDate } from '@/lib/zeit'
import type { Channel, Enrollment } from '@/types/domain'
import { heuteBerlin, pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { rpc } from './rpc'
import { useSettings } from './settings'
import { supabase } from './supabase'

export function useEnrollments(leadId: string | null | undefined) {
  return useQuery({
    queryKey: qk.enrollments(leadId ?? ''),
    enabled: !!leadId,
    queryFn: async (): Promise<Enrollment[]> =>
      pruefe(
        await supabase
          .from('enrollments')
          .select('*')
          .eq('lead_id', leadId as string)
          .order('started_at', { ascending: false }),
      ),
  })
}

/**
 * Alle aktiven/pausierten Enrollments eines Kanals – einer Person (`memberId`) oder aller (`null`); z. B. Anrufliste (M3).
 * Key `qk.enrollmentsKanal` (Präfix `['enrollments']` → Realtime/Undo frischen ihn mit auf).
 */
export function useEnrollmentsKanal(kanal: Channel, memberId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.enrollmentsKanal(kanal, memberId),
    enabled,
    queryFn: async (): Promise<Enrollment[]> => {
      let q = supabase.from('enrollments').select('*').eq('channel', kanal).in('status', ['aktiv', 'pausiert'])
      if (memberId) q = q.eq('member_id', memberId)
      return pruefe(await q.order('next_due_at', { ascending: true, nullsFirst: false }).range(0, 999))
    },
  })
}

export type EnrollmentZaehler = Map<string, number>

/** Zeilen `{ sequence_id }` → Anzahl je Sequenz. */
export function zaehleJeSequenz(zeilen: readonly { sequence_id: string }[]): EnrollmentZaehler {
  const m = new Map<string, number>()
  for (const z of zeilen) m.set(z.sequence_id, (m.get(z.sequence_id) ?? 0) + 1)
  return m
}

/** Laufende Leads (`aktiv` + `pausiert`) je `sequence_id` – Einstellungen → Sequenzen (BAUPLAN § 3.9). */
export function useEnrollmentZaehler() {
  return useQuery({
    queryKey: qk.enrollmentsLaufend,
    staleTime: 60_000,
    queryFn: async (): Promise<EnrollmentZaehler> =>
      zaehleJeSequenz(
        pruefe(await supabase.from('enrollments').select('sequence_id,status').in('status', ['aktiv', 'pausiert'])),
      ),
  })
}

function useEnrollmentInvalidierung() {
  const qc = useQueryClient()
  return (leadId: string) => {
    void qc.invalidateQueries({ queryKey: qk.enrollments(leadId) })
    void qc.invalidateQueries({ queryKey: ['enrollments', 'kanal'] })
    void qc.invalidateQueries({ queryKey: qk.enrollmentsLaufend })
    void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.nav })
  }
}

/** Sequenz beenden = `complete_step(abgebrochen)`; Undo über die entstehende Aktivität. */
export function useEnrollmentStoppen() {
  const inval = useEnrollmentInvalidierung()
  return useMutation({
    mutationFn: (p: { enrollmentId: string; leadId: string; note?: string | null }) =>
      rpc.completeStep({ enrollmentId: p.enrollmentId, outcome: 'abgebrochen', note: p.note }),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

async function statusSetzen(id: string, status: 'pausiert' | 'aktiv', nextDueAt?: string): Promise<Enrollment> {
  const patch = nextDueAt ? { status, next_due_at: nextDueAt } : { status }
  return pruefe(await supabase.from('enrollments').update(patch).eq('id', id).select('*').single())
}

/**
 * BAUPLAN § 5.1: „fortsetzen → aktiv (next_due_at = max(alt, heute 09:00))“ – heute auf einen Werktag gerollt. Ein wochenlang
 * pausiertes Enrollment landet so nicht sofort in „lange überfällig“ (Review: vorher nur der Status-Patch).
 */
export function fortsetzenFaellig(
  alt: string | null | undefined,
  o: { heute?: string; dueTime?: string; feiertage?: readonly string[] } = {},
): string {
  const basis = tagZuDate(rollToWeekday(o.heute ?? heuteBerlin(), o.feiertage), o.dueTime ?? '09:00')
  return alt && new Date(alt).getTime() > basis.getTime() ? alt : basis.toISOString()
}

export function useEnrollmentPausieren() {
  const inval = useEnrollmentInvalidierung()
  return useMutation({
    mutationFn: (p: { enrollmentId: string; leadId: string }) => statusSetzen(p.enrollmentId, 'pausiert'),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

export function useEnrollmentFortsetzen() {
  const inval = useEnrollmentInvalidierung()
  const { data: settings } = useSettings()
  return useMutation({
    mutationFn: async (p: { enrollmentId: string; leadId: string }) => {
      const alt = pruefe(await supabase.from('enrollments').select('next_due_at').eq('id', p.enrollmentId).single())
      const faellig = fortsetzenFaellig(alt.next_due_at, {
        dueTime: settings?.queue.due_time,
        feiertage: settings?.feiertage,
      })
      return statusSetzen(p.enrollmentId, 'aktiv', faellig)
    },
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** Sequenz starten (`enroll`, Key nur aus src/lib/vorlagenKeys.ts). */
export function useEnroll() {
  const inval = useEnrollmentInvalidierung()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.enroll>[0]) => rpc.enroll(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** Schritt erledigen / überspringen / Antwort erhalten (`complete_step`). */
export function useCompleteStep() {
  const inval = useEnrollmentInvalidierung()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.completeStep>[0] & { leadId: string }) => rpc.completeStep(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}

/** Schritt verschieben (`snooze_step`). */
export function useSnoozeStep() {
  const inval = useEnrollmentInvalidierung()
  return useMutation({
    mutationFn: (p: Parameters<typeof rpc.snoozeStep>[0] & { leadId: string }) => rpc.snoozeStep(p),
    onError: mutationFehler,
    onSettled: (_d, _e, p) => inval(p.leadId),
  })
}
