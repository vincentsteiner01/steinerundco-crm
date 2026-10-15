// Eingang – Daten (BAUPLAN § 3.0 Nr. 4: fehlende Hooks im eigenen Ordner, Keys nur als Verlängerung von `qk`).
// Tabellen crm.eingang / crm.eingang_tokens und die RPCs eingang_zuordnen · eingang_ignorieren · eingang_token_erzeugen ·
// eingang_token_widerrufen (Migration 7). Realtime: eigener Kanal `crm:eingang` (die Tabelle ist nicht im Kanal `crm:sync`).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { mutationFehler, pruefe, pruefeNull, qk } from '@/data'
import { supabase } from '@/data/supabase'
import type { Lead } from '@/types/domain'
import { EINGANG_OFFEN, type EingangZeile, type SchluesselInfo } from './logik'

/** Alle Eingangs-Keys hängen unter `qk.nav` – die Sidebar-Zähler werden mit ihnen frisch. */
export const qkEingang = {
  alle: [...qk.nav, 'eingang'] as const,
  liste: [...qk.nav, 'eingang', 'liste'] as const,
  offen: [...qk.nav, 'eingang', 'offen'] as const,
  status: (me: string) => [...qk.nav, 'eingang', 'status', me] as const,
}

export const LISTE_MAX = 300
const SPALTEN =
  'id, member_id, quelle, art, status, empfangen_at, created_at, absender_name, linkedin_slug, text, ergebnis, lead_id, activity_id'

export type LeadKurz = Pick<Lead, 'id' | 'full_name' | 'company_name' | 'stage' | 'owner_id'>
export type EingangListe = { zeilen: EingangZeile[]; leads: Record<string, LeadKurz> }

export async function ladeEingang(): Promise<EingangListe> {
  const zeilen = pruefe(
    await supabase.from('eingang').select(SPALTEN).order('empfangen_at', { ascending: false }).limit(LISTE_MAX),
  ) as EingangZeile[]
  const ids = [...new Set(zeilen.map((z) => z.lead_id).filter((x): x is string => !!x))]
  const leads: Record<string, LeadKurz> = {}
  if (ids.length) {
    const rows = pruefe(
      await supabase.from('leads').select('id, full_name, company_name, stage, owner_id').in('id', ids),
    ) as LeadKurz[]
    for (const l of rows) leads[l.id] = l
  }
  return { zeilen, leads }
}

export function useEingangListe() {
  return useQuery({ queryKey: qkEingang.liste, queryFn: ladeEingang, staleTime: 30_000, refetchInterval: 60_000 })
}

/** Anzahl offener Einträge (neu · unbekannt · fehler) beider Personen – für Badge und Tab-Zähler. */
export async function ladeOffenAnzahl(): Promise<number> {
  const r = await supabase
    .from('eingang')
    .select('id', { count: 'exact', head: true })
    .in('status', [...EINGANG_OFFEN])
  if (r.error) throw r.error
  return r.count ?? 0
}

export function useEingangOffenAnzahl() {
  return useQuery({ queryKey: qkEingang.offen, queryFn: ladeOffenAnzahl, staleTime: 30_000, refetchInterval: 120_000 })
}

export type EingangStatusDaten = {
  schluessel: SchluesselInfo | null
  /** Jüngster Eingang der Person (unabhängig vom Zeitraum). */
  letzter: Pick<EingangZeile, 'id' | 'art' | 'status' | 'created_at' | 'empfangen_at' | 'absender_name'> | null
  /** Status der letzten 7 Tage (nach Eingang im CRM). */
  woche: Pick<EingangZeile, 'status'>[]
}

export async function ladeEingangStatus(me: string, jetzt: Date = new Date()): Promise<EingangStatusDaten> {
  const seit = new Date(jetzt.getTime() - 7 * 86_400_000).toISOString()
  const [tok, letzte, woche] = await Promise.all([
    supabase
      .from('eingang_tokens')
      .select('created_at, last_used_at, label')
      .eq('member_id', me)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('eingang')
      .select('id, art, status, created_at, empfangen_at, absender_name')
      .eq('member_id', me)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('eingang').select('status').eq('member_id', me).gte('created_at', seit).limit(2000),
  ])
  const s = (pruefeNull(tok) ?? []) as SchluesselInfo[]
  const l = (pruefeNull(letzte) ?? []) as EingangStatusDaten['letzter'][]
  return {
    schluessel: s[0] ?? null,
    letzter: l[0] ?? null,
    woche: (pruefeNull(woche) ?? []) as EingangStatusDaten['woche'],
  }
}

export function useEingangStatus(me: string | null) {
  return useQuery({
    queryKey: qkEingang.status(me ?? ''),
    enabled: !!me,
    queryFn: () => ladeEingangStatus(me as string),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ── Realtime ──────────────────────────────────────────────────────────────
// Ein Kanal für alle Nutzer der Seite (Badge + Liste + Status); erst der letzte Abmelder entfernt ihn.
const hoerer = new Set<() => void>()
let kanal: RealtimeChannel | null = null

export const EINGANG_KANAL = 'crm:eingang'

export function invalidiereEingang(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: qkEingang.alle })
}

/** Neue oder geänderte Eingänge erscheinen ohne Neuladen (Publikation `supabase_realtime` enthält crm.eingang). */
export function useEingangLive(): void {
  const qc = useQueryClient()
  useEffect(() => {
    const h = () => invalidiereEingang(qc)
    hoerer.add(h)
    if (!kanal) {
      kanal = supabase
        .channel(EINGANG_KANAL)
        .on('postgres_changes', { event: '*', schema: 'crm', table: 'eingang' }, () => {
          for (const f of hoerer) f()
        })
        .subscribe()
    }
    return () => {
      hoerer.delete(h)
      if (hoerer.size === 0 && kanal) {
        void supabase.removeChannel(kanal)
        kanal = null
      }
    }
  }, [qc])
}

// ── Schreiben (nur über die RPCs) ─────────────────────────────────────────
export type EingangErgebnis = Pick<EingangZeile, 'id' | 'status' | 'ergebnis' | 'lead_id'>

function nachSchreiben(qc: QueryClient, leadId: string | null | undefined) {
  invalidiereEingang(qc)
  if (leadId) {
    void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
    void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
  }
  void qc.invalidateQueries({ queryKey: qk.leads.all })
  void qc.invalidateQueries({ queryKey: qk.queue.all })
}

/** Lead zuordnen → das CRM verbucht sofort im Namen des Postfach-Inhabers (Annahme bzw. Antwort). */
export function useEingangZuordnen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; leadId: string }): Promise<EingangErgebnis> =>
      pruefe(await supabase.rpc('eingang_zuordnen', { p_id: p.id, p_lead_id: p.leadId })) as EingangErgebnis,
    onError: mutationFehler,
    onSettled: (_d, _e, p) => nachSchreiben(qc, p.leadId),
  })
}

export function useEingangIgnorieren() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string }): Promise<EingangErgebnis> =>
      pruefe(await supabase.rpc('eingang_ignorieren', { p_id: p.id })) as EingangErgebnis,
    onError: mutationFehler,
    onSettled: () => invalidiereEingang(qc),
  })
}

/** Klartext-Schlüssel: genau einmal zurückgegeben, nie im Query-Cache, nie im Log. */
export const SCHLUESSEL_MUSTER = /^[A-Za-z0-9_-]{43}$/

export async function schluesselErzeugen(): Promise<string> {
  const t = pruefe(await supabase.rpc('eingang_token_erzeugen', { p_label: 'Gmail (Apps Script) · CRM-App' }))
  if (typeof t !== 'string' || !SCHLUESSEL_MUSTER.test(t)) throw new Error('Der Schlüssel kam unvollständig an.')
  return t
}

export async function schluesselWiderrufen(): Promise<number> {
  return (pruefeNull(await supabase.rpc('eingang_token_widerrufen')) as number | null) ?? 0
}
