// LinkedIn-Recherchelauf (Migration 17, 29.10.2026): Läufe, geprüfte Profile, Ausgangspunkte aus dem CRM und die RPCs
// recherche_starten · _pruefen · _eintragen · _kontrolle · _status. Die Regeln erzwingt die Datenbank; diese Hooks rufen nur auf.
// Fortschritt per Abfrage alle 4 s, solange ein Lauf aktiv ist (die Seite ist auch für einen zuschauenden Menschen gedacht).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export type RechercheLauf = Database['crm']['Tables']['recherche_laeufe']['Row']
export type RechercheProfil = Database['crm']['Tables']['recherche_profile']['Row']
export type RechercheErgebnis = 'gesendet' | 'dublette' | 'nicht_qualifiziert' | 'unklar' | 'fehler'
export type RechercheKategorie = 'A' | 'B' | 'C' | 'bedingt'
export type PruefErgebnis = {
  frei: boolean
  art: 'neu' | 'bekannt' | 'url' | 'lauf' | 'sperrliste' | 'crm' | 'verbindung' | 'name' | 'abgelehnt'
  grund: string
  lead_id?: string
}

const KEY = ['recherche'] as const
const aktiv = (s: string | null | undefined) => s === 'laeuft' || s === 'pausiert'

export function useLauf(id: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'lauf', id],
    enabled: !!id,
    queryFn: async (): Promise<RechercheLauf | null> =>
      (
        pruefe(
          await supabase
            .from('recherche_laeufe')
            .select('*')
            .eq('id', id as string)
            .limit(1),
        ) as RechercheLauf[]
      )[0] ?? null,
    refetchInterval: (q) => (aktiv(q.state.data?.status) ? 4000 : false),
  })
}

export function useLaufProfile(id: string | null | undefined, laufAktiv: boolean) {
  return useQuery({
    queryKey: [...KEY, 'profile', id],
    enabled: !!id,
    queryFn: async (): Promise<RechercheProfil[]> =>
      pruefe(
        await supabase
          .from('recherche_profile')
          .select('*')
          .eq('lauf_id', id as string)
          .order('created_at', { ascending: false })
          .range(0, 499),
      ),
    refetchInterval: laufAktiv ? 4000 : false,
  })
}

/** Aktiver Lauf der Person und die letzten Läufe (Startkarte auf /auftrag). */
export function useMeineLaeufe(memberId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'meine', memberId],
    enabled: !!memberId,
    queryFn: async (): Promise<RechercheLauf[]> =>
      pruefe(
        await supabase
          .from('recherche_laeufe')
          .select('*')
          .eq('member_id', memberId as string)
          .order('started_at', { ascending: false })
          .range(0, 4),
      ),
  })
}

export type Ausgangspunkt = Pick<
  Database['crm']['Tables']['leads']['Row'],
  'id' | 'full_name' | 'company_name' | 'role_title' | 'linkedin_url' | 'stage' | 'role'
>

/** Vernetzte Kontakte aus dem CRM als Startpunkte für „Ähnliche Profile“. Kein Rollenfilter: fast alle Leads haben die Rolle
 * „unbekannt“ – die Seite sortiert stattdessen nach dem Positionstitel (logik.ts). */
export function useAusgangspunkte() {
  return useQuery({
    queryKey: [...KEY, 'ausgangspunkte'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Ausgangspunkt[]> =>
      pruefe(
        await supabase
          .from('leads')
          .select('id, full_name, company_name, role_title, linkedin_url, stage, role')
          .is('deleted_at', null)
          .not('linkedin_url', 'is', null)
          .not('company_name', 'is', null)
          .in('stage', [
            'vernetzt',
            'gespraech_eroeffnet',
            'dm_follow_up',
            'dm_beantwortet',
            'bedarfsermittlung',
            'pitch',
            'erstgespraech_vereinbart',
            'erstgespraech',
            'strategiegespraech_vereinbart',
            'strategiegespraech',
            'sales_follow_up',
            'kunde',
            'langfristig',
          ])
          .order('stage_changed_at', { ascending: false })
          .range(0, 299),
      ),
  })
}

/** Gesendete Anfragen der Person in den letzten 7 Tagen (LinkedIn begrenzt kostenlose Konten wöchentlich). */
export function useAnfragenWoche(memberId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'woche', memberId],
    enabled: !!memberId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const seit = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const r = await supabase
        .from('linkedin_connections')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId as string)
        .gte('requested_at', seit)
      if (r.error) throw r.error
      return r.count ?? 0
    },
  })
}

function useInvalidieren() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: KEY })
    void qc.invalidateQueries({ queryKey: qk.leads.all })
    void qc.invalidateQueries({ queryKey: qk.kpis.all })
    void qc.invalidateQueries({ queryKey: qk.queue.all })
    void qc.invalidateQueries({ queryKey: qk.nav })
  }
}

export function useRechercheStarten() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (): Promise<RechercheLauf> =>
      pruefe(await supabase.rpc('recherche_starten', { p_ziel: 30 })) as unknown as RechercheLauf,
    onError: mutationFehler,
    onSettled: inval,
  })
}

/** Dublettenprüfung – schreibt nichts. Fehler hier landen im Formular, nicht als Toast. */
export async function recherchePruefen(p: {
  lauf: string
  url: string
  vorname?: string
  nachname?: string
  firma?: string
}): Promise<PruefErgebnis> {
  return pruefe(
    await supabase.rpc('recherche_pruefen', {
      p_lauf: p.lauf,
      p_url: p.url,
      p_vorname: p.vorname || undefined,
      p_nachname: p.nachname || undefined,
      p_firma: p.firma || undefined,
    }),
  ) as unknown as PruefErgebnis
}

export type EintragEingabe = {
  lauf: string
  url: string
  ergebnis: RechercheErgebnis
  vorname?: string
  nachname?: string
  firma?: string
  position?: string
  kategorie?: RechercheKategorie | null
  grund?: string
  ausgangspunkt?: string
  firmaWebsite?: string
}

/** Fehler werfen (die Seite zeigt den Wortlaut am Formular – der Agent muss ihn lesen können). */
export function useRechercheEintragen() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (e: EintragEingabe): Promise<RechercheLauf> =>
      pruefe(
        await supabase.rpc('recherche_eintragen', {
          p_lauf: e.lauf,
          p_url: e.url,
          p_ergebnis: e.ergebnis,
          p_vorname: e.vorname || undefined,
          p_nachname: e.nachname || undefined,
          p_firma: e.firma || undefined,
          p_position: e.position || undefined,
          p_kategorie: e.kategorie || undefined,
          p_grund: e.grund || undefined,
          p_ausgangspunkt: e.ausgangspunkt || undefined,
          p_firma_website: e.firmaWebsite || undefined,
        }),
      ) as unknown as RechercheLauf,
    onSettled: inval,
  })
}

export function useRechercheKontrolle() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (lauf: string): Promise<RechercheLauf> =>
      pruefe(await supabase.rpc('recherche_kontrolle', { p_lauf: lauf })) as unknown as RechercheLauf,
    onError: mutationFehler,
    onSettled: inval,
  })
}

export function useRechercheStatus() {
  const inval = useInvalidieren()
  return useMutation({
    mutationFn: async (p: {
      lauf: string
      status: 'laeuft' | 'pausiert' | 'abgeschlossen' | 'abgebrochen' | 'fehler'
      meldung?: string
    }): Promise<RechercheLauf> =>
      pruefe(
        await supabase.rpc('recherche_status', {
          p_lauf: p.lauf,
          p_status: p.status,
          p_meldung: p.meldung || undefined,
        }),
      ) as unknown as RechercheLauf,
    onError: mutationFehler,
    onSettled: inval,
  })
}
