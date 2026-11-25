// Realtime (E17, BAUPLAN § 3.1.6): ein Kanal `crm:sync`, postgres_changes auf 11 Tabellen, Invalidierung nach Tabelle.
// Nicht architektur § 4.3 (dort stehen falsche Tabellennamen). Status → uiStore.realtime.
// Neustart 25.11.2026: nur noch Invalidierung – die Toasts „übergeben“/„Termin der anderen Person“ gehörten zum alten CRM.
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export const REALTIME_KANAL = 'crm:sync'

/** Die Tabellen der Publikation `supabase_realtime` (Migration 1 Abschnitt 11; Umsatz seit Migration 13). */
export const REALTIME_TABELLEN = [
  'leads',
  'activities',
  'enrollments',
  'tasks',
  'meetings',
  'linkedin_connections',
  'calls',
  'emails',
  'daily_counters',
  'templates',
  'settings',
  'contracts',
  'payments',
] as const
export type RealtimeTabelle = (typeof REALTIME_TABELLEN)[number]

type Zeile = Record<string, unknown>
const str = (z: Zeile | undefined, k: string): string | undefined => {
  const v = z?.[k]
  return typeof v === 'string' ? v : undefined
}

/**
 * Invalidierungs-Tabelle (BAUPLAN § 3.1.6, wörtlich). Reine Funktion: Tabelle + Zeile (new ∪ old) → Query-Keys.
 * Präfix-Keys (z. B. ['activities', 'zeitraum']) invalidieren per TanStack-Prefix-Match alle Verlängerungen.
 */
export function invalidierungsKeys(tabelle: RealtimeTabelle, zeile: Zeile): QueryKey[] {
  const id = str(zeile, 'id')
  const leadId = str(zeile, 'lead_id')
  switch (tabelle) {
    case 'leads':
      return [qk.leads.all, ...(id ? [qk.leads.detail(id)] : []), qk.queue.all, qk.nav]
    case 'activities':
      return [
        ...(leadId ? [qk.activities(leadId)] : [['activities']]),
        ['activities', 'zeitraum'],
        ...(leadId ? [qk.leads.detail(leadId)] : []),
        qk.kpis.all,
        qk.templates.perf,
        // Spalte „Letzte Notiz“ in den Telefon-Listen (23.10.2026)
        [...qk.leads.telefon, 'notizen'],
      ]
    // Integration M1–M8: zusätzlich Kanal-Listen/Zähler (Anrufliste M3, Einstellungen M8) und `['tasks', 'faellig']`
    // (Rückrufe der anderen Person in der Anrufliste) – Ergänzung zur Tabelle § 3.1.6, FOUNDATION-WUNSCH M3/M8.
    case 'enrollments':
      return [
        ...(leadId ? [qk.enrollments(leadId), ['enrollments', 'kanal'], qk.enrollmentsLaufend] : [['enrollments']]),
        ...(leadId ? [qk.leads.detail(leadId)] : []),
        qk.queue.all,
        qk.nav,
      ]
    // Telefon-Ansichten (Kontakte · Deal-Pipeline · Follow-ups) betten Aufgaben und Termine ein (23.10.2026)
    case 'tasks':
      return [
        ...(leadId ? [qk.tasks.lead(leadId), ['tasks', 'faellig']] : [['tasks']]),
        qk.queue.all,
        qk.nav,
        qk.leads.telefon,
      ]
    case 'meetings':
      return [...(leadId ? [qk.meetings.lead(leadId)] : [['meetings']]), qk.queue.all, qk.kpis.all, qk.leads.telefon]
    case 'linkedin_connections':
      return [...(leadId ? [qk.connections.lead(leadId)] : [['connections']]), qk.queue.all, qk.kpis.all]
    case 'calls':
      return [
        ...(leadId ? [qk.calls.lead(leadId), ['calls', 'letzte']] : [['calls']]),
        ['calls', 'zeitraum'],
        qk.kpis.all,
        [...qk.leads.telefon, 'notizen'],
      ]
    case 'emails':
      return [...(leadId ? [qk.emails.lead(leadId)] : [['emails']]), ['emails', 'zeitraum'], qk.queue.all]
    case 'daily_counters':
      return [['counters'], qk.kpis.all]
    case 'templates':
      return [qk.templates.all]
    case 'settings':
      return [qk.settings]
    case 'contracts':
    case 'payments':
      return [qk.umsatz]
  }
}

export type RealtimeEreignis = {
  tabelle: RealtimeTabelle
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  neu: Zeile
  alt: Zeile
}

/** Wendet die Invalidierungs-Tabelle auf einen Payload an. */
export function invalidiere(qc: QueryClient, e: RealtimeEreignis): void {
  const zeile = { ...e.alt, ...e.neu }
  for (const queryKey of invalidierungsKeys(e.tabelle, zeile)) void qc.invalidateQueries({ queryKey })
}

/** Ruhe nach dem letzten Ereignis, bevor neu geladen wird – und Obergrenze bei Dauerfeuer. */
export const BUENDEL_RUHE_MS = 400
export const BUENDEL_MAX_MS = 2000

/**
 * Bündelt Invalidierungen (16.10.2026): Eine Annahme erzeugt ~7 Ereignisse (Verbindung, 3 Aktivitäten, Lead, Sequenz,
 * Aufgabe); 37 Annahmen über die Auftragsseite lösten so je Tab Hunderte Neuladungen von Queue/KPIs aus. Jetzt wird
 * jeder Key pro Welle einmal invalidiert – nach 400 ms Ruhe, bei Dauerfeuer spätestens alle 2 s.
 */
export function invalidierungsBuendler(qc: QueryClient, ruheMs = BUENDEL_RUHE_MS, maxMs = BUENDEL_MAX_MS) {
  const offen = new Map<string, QueryKey>()
  let ruhe: ReturnType<typeof setTimeout> | null = null
  let spaetestens: ReturnType<typeof setTimeout> | null = null
  const leeren = () => {
    if (ruhe) clearTimeout(ruhe)
    if (spaetestens) clearTimeout(spaetestens)
    ruhe = spaetestens = null
    const keys = [...offen.values()]
    offen.clear()
    for (const queryKey of keys) void qc.invalidateQueries({ queryKey })
  }
  return {
    add(e: RealtimeEreignis): void {
      for (const k of invalidierungsKeys(e.tabelle, { ...e.alt, ...e.neu })) offen.set(JSON.stringify(k), k)
      if (ruhe) clearTimeout(ruhe)
      ruhe = setTimeout(leeren, ruheMs)
      spaetestens ??= setTimeout(leeren, maxMs)
    },
    stop(): void {
      if (ruhe) clearTimeout(ruhe)
      if (spaetestens) clearTimeout(spaetestens)
      ruhe = spaetestens = null
      offen.clear()
    },
  }
}

function zuEreignis(tabelle: RealtimeTabelle, p: RealtimePostgresChangesPayload<Zeile>): RealtimeEreignis {
  return {
    tabelle,
    eventType: p.eventType,
    neu: (p.new ?? {}) as Zeile,
    alt: (p.old ?? {}) as Zeile,
  }
}

/** Ein Kanal pro Sitzung; nur als Mitglied (Realtime prüft RLS mit dem JWT). In providers.tsx: `<RealtimeSync/>` = `useRealtimeSync()`. */
export function useRealtimeSync(): void {
  const qc = useQueryClient()
  const status = useAuth((s) => s.status)
  const me = useAuth((s) => s.member?.user_id ?? null)
  const setRealtime = useUiStore((s) => s.setRealtime)

  useEffect(() => {
    if (status !== 'mitglied' || !me) {
      setRealtime('getrennt')
      return
    }
    const buendler = invalidierungsBuendler(qc)
    let kanal = supabase.channel(REALTIME_KANAL)
    for (const tabelle of REALTIME_TABELLEN) {
      kanal = kanal.on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: tabelle },
        (p: RealtimePostgresChangesPayload<Zeile>) => {
          buendler.add(zuEreignis(tabelle, p))
        },
      )
    }
    kanal.subscribe((s) => setRealtime(s === 'SUBSCRIBED' ? 'live' : 'getrennt'))
    return () => {
      buendler.stop()
      setRealtime('getrennt')
      void supabase.removeChannel(kanal)
    }
  }, [qc, status, me, setRealtime])
}
