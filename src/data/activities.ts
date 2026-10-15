// BAUPLAN § 3.1.6 activities.ts: Timeline (Keyset 50, useInfiniteQuery), Notiz erstellen (optimistisch)/bearbeiten,
// generische Aktivität (z. B. Anrufgrund-Beleg § 1.5 Nr. 14), useActivitiesZeitraum (§ 1.5 Nr. 40).
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/authStore'
import type { Database, Json } from '@/types/database'
import type { Activity, ActivityType, Channel } from '@/types/domain'
import { pruefe, pruefeNull, TIMELINE_SEITE, useAlleSeiten, zeitraumGrenzen } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type ActivityInsert = Database['crm']['Tables']['activities']['Insert']
export type ActivityFilter = { types?: ActivityType[]; channel?: Channel }
export type TimelineCursor = { occurredAt: string; id: number } | null

// `kanaele` = `metadata->channels` (Widerspruch: Kanal-Umfang, KPI „Widersprüche (E-Mail)“); `email_id` für die Doppel-Erkennung unten.
export const ZEITRAUM_SPALTEN =
  'id, lead_id, member_id, channel, type, occurred_at, template_id, outcome, reply_label, enrollment_id, step_id, email_id, kanaele:metadata->channels'
export type ActivityZeitraum = Pick<
  Activity,
  | 'id'
  | 'lead_id'
  | 'member_id'
  | 'channel'
  | 'type'
  | 'occurred_at'
  | 'template_id'
  | 'outcome'
  | 'reply_label'
  | 'enrollment_id'
  | 'step_id'
> &
  Partial<Pick<Activity, 'email_id'>> & { kanaele?: Json }

type SendungsTeile = Pick<Activity, 'type' | 'lead_id' | 'enrollment_id' | 'step_id'> & { email_id?: string | null }

/**
 * Doppelte `email_gesendet` einer Sequenz-Mail ausblenden: „Gesendet? Ja“ (M-06) setzt die Mail auf `sent_confirmed`
 * (`emails_after_write` loggt `email_gesendet` mit `email_id`) und ruft danach `complete_step('gesendet')`, dessen E-Mail-Zweig ein
 * zweites `email_gesendet` ohne `email_id` schreibt. Bis eine Migration den zweiten Eintrag unterdrückt, zählt nur der Eintrag mit
 * `email_id` (gleicher Lead, gleiches Enrollment, gleicher Schritt). Review-Korrektur; Server-View `v_template_performance` bleibt offen.
 */
export function ohneDoppelteEmailSendung<A extends SendungsTeile>(zeilen: readonly A[]): A[] {
  const schluessel = (a: SendungsTeile) => `${a.lead_id}|${a.enrollment_id}|${a.step_id}`
  const mitMail = new Set(
    zeilen.filter((a) => a.type === 'email_gesendet' && a.email_id && a.enrollment_id && a.step_id).map(schluessel),
  )
  if (mitMail.size === 0) return zeilen as A[]
  return zeilen.filter(
    (a) => !(a.type === 'email_gesendet' && !a.email_id && a.enrollment_id && a.step_id && mitMail.has(schluessel(a))),
  )
}

export async function ladeTimelineSeite(
  leadId: string,
  cursor: TimelineCursor,
  filter?: ActivityFilter,
): Promise<Activity[]> {
  let q = supabase.from('activities').select('*').eq('lead_id', leadId)
  if (filter?.types?.length) q = q.in('type', filter.types)
  if (filter?.channel) q = q.eq('channel', filter.channel)
  if (cursor)
    q = q.or(`occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`)
  return pruefe(
    await q.order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(TIMELINE_SEITE),
  )
}

/**
 * Jüngste Aktivität eines Typs am Lead, sofern sie gerade eben entstanden ist (die vom Trigger geschriebene Zeile für den
 * Undo-Toast, E16). Fehler → `null`. Integration M1–M8: vorher in components/aktionen, features/heute und features/leads.
 */
export async function nachleseAktivitaet(
  leadId: string,
  types: ActivityType[],
  hoechstensMs = 20_000,
): Promise<Activity | null> {
  try {
    const a = (await ladeTimelineSeite(leadId, null, { types }))[0]
    if (!a) return null
    const alter = Date.now() - new Date(a.created_at).getTime()
    return Number.isFinite(alter) && alter > hoechstensMs ? null : a
  } catch {
    return null
  }
}

/** Ergänzt `metadata` einer Aktivität (z. B. `via = 'pipeline'` am Stufenwechsel, P-02); Rückgabe = Zeile mit neuem metadata. */
export async function aktivitaetMetadataErgaenzen(a: Activity, extra: Record<string, Json>): Promise<Activity> {
  const alt = a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata) ? a.metadata : {}
  const metadata: Json = { ...alt, ...extra }
  pruefeNull(await supabase.from('activities').update({ metadata }).eq('id', a.id))
  return { ...a, metadata }
}

export function useActivities(leadId: string | null | undefined, filter?: ActivityFilter) {
  return useInfiniteQuery({
    queryKey: [...qk.activities(leadId ?? ''), filter ?? {}],
    enabled: !!leadId,
    initialPageParam: null as TimelineCursor,
    queryFn: ({ pageParam }) => ladeTimelineSeite(leadId as string, pageParam, filter),
    getNextPageParam: (letzte): TimelineCursor | undefined => {
      const l = letzte[letzte.length - 1]
      return letzte.length < TIMELINE_SEITE || !l ? undefined : { occurredAt: l.occurred_at, id: l.id }
    },
    // Doppelte Sequenz-Mail nur in der Anzeige ausblenden – die Seitenlänge (Cursor) bleibt die der Rohdaten
    select: (d) => ({ ...d, pages: d.pages.map((p) => ohneDoppelteEmailSendung(p)) }),
  })
}

function timelineEinfuegen(qc: ReturnType<typeof useQueryClient>, leadId: string, a: Activity): void {
  qc.setQueriesData<InfiniteData<Activity[], TimelineCursor>>({ queryKey: qk.activities(leadId) }, (alt) => {
    if (!alt) return alt
    const [erste = [], ...rest] = alt.pages
    return { ...alt, pages: [[a, ...erste], ...rest] }
  })
}

function invalidiereLead(qc: ReturnType<typeof useQueryClient>, leadId: string): void {
  void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
  void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
  void qc.invalidateQueries({ queryKey: qk.leads.all })
}

/** Notiz (optimistisch: sofort oben in der Timeline, negative Platzhalter-ID). */
export function useNotizErstellen() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.member?.user_id ?? null)
  return useMutation({
    mutationFn: async (p: {
      leadId: string
      note: string
      occurredAt?: string
      metadata?: ActivityInsert['metadata']
    }): Promise<Activity> =>
      pruefe(
        await supabase
          .from('activities')
          .insert({
            lead_id: p.leadId,
            type: 'notiz',
            channel: 'sonstiges',
            note: p.note,
            occurred_at: p.occurredAt,
            metadata: p.metadata,
            ...(me ? { member_id: me } : {}),
          })
          .select('*')
          .single(),
      ),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: qk.activities(p.leadId) })
      const vorher = qc.getQueriesData<InfiniteData<Activity[], TimelineCursor>>({ queryKey: qk.activities(p.leadId) })
      const platzhalter = {
        id: -Date.now(),
        lead_id: p.leadId,
        member_id: me,
        channel: 'sonstiges',
        type: 'notiz',
        occurred_at: p.occurredAt ?? new Date().toISOString(),
        note: p.note,
        metadata: p.metadata ?? {},
        created_at: new Date().toISOString(),
        kpi_relevant: true,
        source: 'app',
      } as Activity
      timelineEinfuegen(qc, p.leadId, platzhalter)
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      for (const [key, daten] of ctx?.vorher ?? []) qc.setQueryData(key, daten)
      mutationFehler(e)
    },
    onSettled: (_d, _e, p) => invalidiereLead(qc, p.leadId),
  })
}

export type NotizVersion = { note: string | null; at: string; by: string | null }

/** Frühere Fassungen einer bearbeiteten Notiz (`metadata.versions`, ux § 3.3.4, LD-07). */
export function notizVersionen(a: Pick<Activity, 'metadata'>): NotizVersion[] {
  const m = a.metadata
  if (!m || typeof m !== 'object' || Array.isArray(m)) return []
  const v = (m as { versions?: unknown }).versions
  return Array.isArray(v) ? (v as NotizVersion[]) : []
}

/**
 * Notiz bearbeiten: neuer Text, die bisherige Fassung wandert nach `metadata.versions` (ux § 3.3.4, LD-07);
 * `metadata.kind` wird `bearbeitet` (Timeline „Notiz bearbeitet“), sofern die Notiz keine eigene Art trägt.
 */
export function useNotizBearbeiten() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.member?.user_id ?? null)
  return useMutation({
    mutationFn: async (p: { activity: Activity; note: string; me?: string | null }): Promise<Activity> => {
      const alt =
        p.activity.metadata && typeof p.activity.metadata === 'object' && !Array.isArray(p.activity.metadata)
          ? (p.activity.metadata as Record<string, Json | undefined>)
          : {}
      const versions = [
        ...notizVersionen(p.activity),
        { note: p.activity.note, at: new Date().toISOString(), by: p.me ?? me },
      ]
      const metadata = { ...alt, kind: alt.kind ?? 'bearbeitet', versions } as Json
      return pruefe(
        await supabase
          .from('activities')
          .update({ note: p.note, metadata })
          .eq('id', p.activity.id)
          .select('*')
          .single(),
      )
    },
    onError: mutationFehler,
    onSettled: (_d, _e, p) => invalidiereLead(qc, p.activity.lead_id),
  })
}

/** Generische Aktivität (Insert `notiz`/`einwilligung` erlaubt, § 4.3) – z. B. Anrufgrund-Beleg `metadata.kind = 'anrufgrund'`. */
export function useAktivitaetErstellen() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.member?.user_id ?? null)
  return useMutation({
    mutationFn: async (a: ActivityInsert): Promise<Activity> =>
      pruefe(
        await supabase
          .from('activities')
          .insert({ ...(me ? { member_id: me } : {}), ...a })
          .select('*')
          .single(),
      ),
    onError: mutationFehler,
    onSuccess: (a) => timelineEinfuegen(qc, a.lead_id, a),
    onSettled: (_d, _e, a) => {
      invalidiereLead(qc, a.lead_id)
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
  })
}

/** Aktivitäten je Mitglied/Zeitraum/Typen (M5-Kacheln, § 1.5 Nr. 40); `member = 'team'` ohne Personenfilter; alle Seiten. */
export function useActivitiesZeitraum(member: string | 'team', von: string, bis: string, types: ActivityType[]) {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  const r = useAlleSeiten<ActivityZeitraum>(
    qk.activitiesZeitraum(member, von, bis, types),
    async (seiteVon, seiteBis) => {
      let q = supabase.from('activities').select(ZEITRAUM_SPALTEN).gte('occurred_at', ab).lt('occurred_at', vor)
      if (types.length) q = q.in('type', types)
      if (member !== 'team') q = q.eq('member_id', member)
      return pruefe(
        await q.order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(seiteVon, seiteBis),
      )
    },
    types.length > 0,
  )
  return { ...r, data: ohneDoppelteEmailSendung(r.data) }
}

/** Wie `v_template_performance`: Sendungen = Aktivitäten mit `template_id` dieser Typen. */
export const VORLAGE_SENDE_TYPEN: ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'anruf',
]
export const VORLAGE_ANTWORT_TYPEN: ActivityType[] = ['nachricht_erhalten', 'email_erhalten']

export type VorlagenAktivitaeten = { sendungen: ActivityZeitraum[]; antworten: ActivityZeitraum[] }

/**
 * Sendungen einer Vorlage (Aktivitäten mit `template_id` ab `von`) und die eingehenden Antworten derselben Leads bis `bis`
 * (Europe/Berlin-Grenzen) – Vorlagen-Statistik (M6, LF-06). Key verlängert `qk.activitiesZeitraum` → Realtime-Präfix.
 */
export function useTemplateActivities(templateId: string | null | undefined, von: string, bis: string) {
  const { ab, vor } = zeitraumGrenzen(von, bis)
  return useQuery({
    queryKey: [...qk.activitiesZeitraum('team', von, bis, VORLAGE_SENDE_TYPEN), 'vorlage', templateId ?? ''] as const,
    enabled: !!templateId,
    staleTime: 60_000,
    queryFn: async (): Promise<VorlagenAktivitaeten> => {
      const sendungen: ActivityZeitraum[] = pruefe(
        await supabase
          .from('activities')
          .select(ZEITRAUM_SPALTEN)
          .eq('template_id', templateId as string)
          .in('type', VORLAGE_SENDE_TYPEN)
          .gte('occurred_at', ab)
          .lt('occurred_at', vor)
          .order('occurred_at', { ascending: true })
          .limit(1000),
      )
      const leadIds = [...new Set(sendungen.map((s) => s.lead_id))]
      if (leadIds.length === 0) return { sendungen: ohneDoppelteEmailSendung(sendungen), antworten: [] }
      const antworten: ActivityZeitraum[] = pruefe(
        await supabase
          .from('activities')
          .select(ZEITRAUM_SPALTEN)
          .in('lead_id', leadIds)
          .in('type', VORLAGE_ANTWORT_TYPEN)
          .gte('occurred_at', ab)
          .lt('occurred_at', vor)
          .order('occurred_at', { ascending: true })
          .limit(1000),
      )
      return { sendungen: ohneDoppelteEmailSendung(sendungen), antworten }
    },
  })
}
