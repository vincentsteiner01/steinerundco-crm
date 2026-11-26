// BAUPLAN § 3.1.6 leads.ts: Liste (PostgREST-Filter aus LeadFilter, range 500, count exact), Detail (Embeds),
// Update mit updated_at-Bedingung (optimistisch), Soft-Delete. Suche, Erstellen, Wiederherstellen, Dubletten-Check und die
// Views sind seit dem Neustart (25.11.2026) ohne Verwendung entfernt – das Board hat seine eigenen Hooks (data/board.ts).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toastFehler } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import type { Lead, LeadFilter, LeadMitBezug, LeadStage, LeadUpdate, PhaseKey } from '@/types/domain'
import {
  berlinMitternachtIso,
  heuteBerlin,
  orWert,
  pruefe,
  pruefeNull,
  SEITE,
  tagPlus,
  zeitraumGrenzen,
} from './_helfer'
import { MELDUNG, mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'
import { anzeigeName } from '@/lib/mitglied'

/** Phase → Feinstufen (§ 1.5 Nr. 1). Lokale Kopie der Daten-Schicht; die UI-Quelle ist src/lib/stufen.ts (anderer Besitzer). */
export const PHASE_STUFEN: Record<PhaseKey, LeadStage[]> = {
  angefragt: ['neu', 'vernetzung_gesendet'],
  vernetzt: ['vernetzt'],
  eroeffnet: ['gespraech_eroeffnet', 'dm_follow_up'],
  beantwortet: ['dm_beantwortet', 'bedarfsermittlung'],
  gepitcht: ['pitch'],
  erstgespraech: ['erstgespraech_vereinbart', 'erstgespraech'],
  strategiegespraech: ['strategiegespraech_vereinbart', 'strategiegespraech', 'sales_follow_up'],
  kunde: ['kunde'],
  wiedervorlage: ['langfristig'],
  beendet: ['beendet'],
}

export const LEAD_EMBED =
  '*, companies(*), enrollments(*), tasks(*), meetings(*), linkedin_connections(*), lead_tags(tag_id)'

export type LeadSeite = { zeilen: LeadListenZeile[]; gesamt: number; seite: number; hatMehr: boolean }

/** Firmensperre je Zeile (BAUPLAN § 3.3, § 1.5 Nr. 27): Listen tragen `companies(id, do_not_contact)` – Integration M2. */
export const LISTEN_FIRMA = 'companies(id, do_not_contact)'
export type LeadListenZeile = Lead & { companies?: { id: string; do_not_contact: boolean } | null }

/** Select-Teil für Filter über Embeds (`!inner` filtert die Elternzeilen). */
function embedSelect(f: LeadFilter): string {
  const teile: string[] = ['*', LISTEN_FIRMA]
  if (f.kanal?.length || f.sequenz?.key || f.sequenz?.position !== undefined)
    teile.push('enrollments!inner(id, channel, status, current_position, sequences!inner(key))')
  if (f.tag?.length) teile.push('lead_tags!inner(tag_id)')
  const e = f.ereignis
  if (e?.art === 'aktivitaet') teile.push('activities!inner(id)')
  if (e?.art === 'anfrage' || e?.art === 'annahme') teile.push('linkedin_connections!inner(id)')
  if (e?.art === 'termin' || e?.art === 'termin_vereinbart') teile.push('meetings!inner(id)')
  return teile.join(', ')
}

/** § 7.5: Ereignis-Filter über `!inner`-Embeds, Zeitraum als Europe/Berlin-Grenzen (§ 1.5 Nr. 40). */
// oxlint-disable-next-line typescript/no-explicit-any -- PostgREST-Builder-Generics sind bei dynamischen Embeds nicht abbildbar
function wendeEreignisAn<Q extends { [k: string]: any }>(q: Q, e: NonNullable<LeadFilter['ereignis']>): Q {
  const { ab, vor } = zeitraumGrenzen(e.von, e.bis)
  let b = q
  if (e.art === 'aktivitaet') {
    if (e.typ) b = b.eq('activities.type', e.typ)
    b = b.gte('activities.occurred_at', ab).lt('activities.occurred_at', vor)
    if (e.person) b = b.eq('activities.member_id', e.person)
  } else if (e.art === 'anfrage' || e.art === 'annahme') {
    const feld = e.art === 'anfrage' ? 'linkedin_connections.requested_at' : 'linkedin_connections.accepted_at'
    b = b.gte(feld, ab).lt(feld, vor)
    if (e.person) b = b.eq('linkedin_connections.member_id', e.person)
  } else if (e.art === 'termin') {
    b = b.eq('meetings.status', 'stattgefunden')
    b = e.typ ? b.eq('meetings.type', e.typ) : b.in('meetings.type', ['erstgespraech', 'strategiegespraech'])
    b = b.gte('meetings.scheduled_at', ab).lt('meetings.scheduled_at', vor)
    if (e.person) b = b.eq('meetings.member_id', e.person)
  } else {
    b = b.eq('meetings.type', 'erstgespraech').neq('meetings.status', 'verschoben')
    b = b.gte('meetings.booked_at', ab).lt('meetings.booked_at', vor)
    if (e.person) b = b.eq('meetings.member_id', e.person)
  }
  return b
}

/** Baut die PostgREST-Abfrage aus `LeadFilter` (gruppe/sort-Gruppierung bleibt clientseitig). */
// oxlint-disable-next-line typescript/no-explicit-any -- PostgREST-Builder-Generics sind bei dynamischen Embeds nicht abbildbar
export function wendeLeadFilterAn<Q extends { [k: string]: any }>(q: Q, f: LeadFilter, me: string | null): Q {
  let b = q
  b = f.papierkorb ? b.not('deleted_at', 'is', null) : b.is('deleted_at', null)
  if (f.q?.trim()) {
    const w = orWert(f.q)
    if (w) b = b.or(`full_name.ilike.*${w}*,company_name.ilike.*${w}*,search.fts(german).${w}`)
  }
  const z = f.zustaendig
  if (Array.isArray(z)) b = b.in('owner_id', z)
  else if (z === 'me' && me) b = b.eq('owner_id', me)
  else if (z === 'andere' && me) b = b.neq('owner_id', me).not('owner_id', 'is', null)
  else if (z === 'frei') b = b.or('owner_id.is.null,released.eq.true')
  const stufen = new Set<LeadStage>(f.stage ?? [])
  for (const p of f.phase ?? []) for (const s of PHASE_STUFEN[p]) stufen.add(s)
  if (stufen.size) b = b.in('stage', [...stufen])
  if (f.kanal?.length) b = b.in('enrollments.channel', f.kanal).eq('enrollments.status', 'aktiv')
  if (f.sequenz?.key) b = b.eq('enrollments.sequences.key', f.sequenz.key).eq('enrollments.status', 'aktiv')
  if (f.sequenz?.position !== undefined) b = b.eq('enrollments.current_position', f.sequenz.position)
  if (f.faellig) {
    const heute = heuteBerlin()
    const morgen = berlinMitternachtIso(tagPlus(heute, 1))
    const inEinerWoche = berlinMitternachtIso(tagPlus(heute, 8))
    // Überfällig = vor heute 00:00 (BAUPLAN § 3.3, ux § 3.2.3) – nicht „vor jetzt“, sonst steht ein Schritt von heute 09:00 in beiden
    if (f.faellig === 'ueberfaellig') b = b.lt('next_action_at', berlinMitternachtIso(heute))
    else if (f.faellig === 'heute')
      b = b.gte('next_action_at', berlinMitternachtIso(heute)).lt('next_action_at', morgen)
    else if (f.faellig === 'woche') b = b.gte('next_action_at', morgen).lt('next_action_at', inEinerWoche)
    else if (f.faellig === 'spaeter') b = b.gte('next_action_at', inEinerWoche)
    else if (f.faellig === 'ohne') b = b.is('next_action_at', null)
  }
  if (f.tag?.length) b = b.in('lead_tags.tag_id', f.tag)
  if (f.quelle) b = b.eq('source_batch_id', f.quelle)
  if (f.rolle?.length) b = b.in('role', f.rolle)
  if (f.anrede?.length) b = b.in('salutation', f.anrede)
  if (f.erlaubnis?.length) b = b.in('email_consent_basis', f.erlaubnis)
  if (f.ohneUnternehmen) b = b.is('company_id', null)
  if (f.released !== undefined) b = b.eq('released', f.released)
  if (f.ereignis) b = wendeEreignisAn(b, f.ereignis)
  const sort = f.sort?.length ? f.sort : [{ feld: 'next_action_at' as const, richtung: 'asc' as const }]
  for (const s of sort) b = b.order(s.feld, { ascending: s.richtung === 'asc', nullsFirst: false })
  b = b.order('id', { ascending: true })
  return b
}

export async function ladeLeadSeite(f: LeadFilter, seite: number, me: string | null): Promise<LeadSeite> {
  const von = seite * SEITE
  const q = wendeLeadFilterAn(supabase.from('leads').select(embedSelect(f), { count: 'exact' }), f, me).range(
    von,
    von + SEITE - 1,
  )
  const { data, error, count } = await q
  if (error) throw error
  const zeilen = (data ?? []) as unknown as LeadListenZeile[]
  const gesamt = count ?? zeilen.length
  return { zeilen, gesamt, seite, hatMehr: von + zeilen.length < gesamt }
}

export function useLeads(filter: LeadFilter, seite = 0) {
  const me = useAuth((s) => s.member?.user_id ?? null)
  return useQuery({
    queryKey: qk.leads.liste(filter, seite),
    queryFn: () => ladeLeadSeite(filter, seite, me),
    placeholderData: (p) => p,
  })
}

export async function ladeLead(id: string): Promise<LeadMitBezug> {
  const z = pruefe(await supabase.from('leads').select(LEAD_EMBED).eq('id', id).single())
  return z as unknown as LeadMitBezug
}

/**
 * `frisch` (Lead-Blatt, 25.11.2026): beim Einhängen immer neu laden – das Formular des Blatts darf nicht aus dem Cache von
 * vorhin entstehen (falsche Liste nach einem Zug, fremde Notiz unsichtbar und beim Speichern überschrieben).
 */
export function useLead(id: string | null | undefined, opt?: { frisch?: boolean }) {
  return useQuery({
    queryKey: qk.leads.detail(id ?? ''),
    queryFn: () => ladeLead(id as string),
    enabled: !!id,
    ...(opt?.frisch ? { refetchOnMount: 'always' as const } : {}),
  })
}

export type LeadTreffer = Pick<
  Lead,
  'id' | 'full_name' | 'company_name' | 'stage' | 'owner_id' | 'linkedin_url' | 'deleted_at'
>

export type LeadPatch = { id: string; erwartetUpdatedAt: string; patch: LeadUpdate }

/** Patch mit `updated_at`-Bedingung (architektur § 4.4): 0 Zeilen → Konflikt-Toast + Reload. Optimistisch im Detail-Cache. */
export function useLeadUpdate() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.member?.user_id ?? null)
  return useMutation({
    mutationFn: async ({ id, erwartetUpdatedAt, patch }: LeadPatch): Promise<Lead> => {
      const z = pruefeNull(
        await supabase
          .from('leads')
          .update(patch)
          .eq('id', id)
          .eq('updated_at', erwartetUpdatedAt)
          .select('*')
          .maybeSingle(),
      )
      if (!z) {
        const err = new Error('konflikt') as Error & { code: string }
        err.code = 'KONFLIKT'
        throw err
      }
      return z
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.leads.detail(id) })
      const vorher = qc.getQueryData<LeadMitBezug>(qk.leads.detail(id))
      if (vorher) qc.setQueryData<LeadMitBezug>(qk.leads.detail(id), { ...vorher, ...patch })
      return { vorher }
    },
    onError: (e, { id }, ctx) => {
      if (ctx?.vorher) qc.setQueryData(qk.leads.detail(id), ctx.vorher)
      if ((e as { code?: string }).code === 'KONFLIKT') {
        // Die andere Person relativ zur angemeldeten (LE-16) – im Team von zwei hat sie den Lead zuletzt geändert
        const andere = qc
          .getQueryData<
            { id: string | null; short_name: string | null; display_name?: string | null; email?: string | null }[]
          >(qk.members)
          ?.find((m) => m.id !== me)
        toastFehler(MELDUNG.konflikt(anzeigeName(andere, 'Jemand')))
        void qc.invalidateQueries({ queryKey: qk.leads.detail(id) })
        void qc.invalidateQueries({ queryKey: qk.leads.all })
        return
      }
      mutationFehler(e)
    },
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(id) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
    },
  })
}

/** Soft-Delete (`deleted_at`); Papierkorb-Ansicht zeigt ihn weiter. */
export function useLeadLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<Lead> =>
      pruefe(
        await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('*').single(),
      ),
    onError: mutationFehler,
    onSettled: (_d, _e, id) => {
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.leads.detail(id) })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.nav })
    },
  })
}
