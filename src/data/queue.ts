// BAUPLAN § 3.1.6 queue.ts: useQueue(memberId | null, tag) → QueueItem[] (View v_today_queue), useQueueZaehler(memberId).
// Sortierung E15: section_order, rank_score desc, company_name, lead_created_at. Die ux-Sektionen leitet M1 ab (§ 5.4).
import { notifyManager, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { QueueItem, QueueSection, SequenceMitSchritten } from '@/types/domain'
import { heuteBerlin, pruefe } from './_helfer'
import { qk } from './queryKeys'
import { supabase } from './supabase'

export const QUEUE_SEKTIONEN: QueueSection[] = [
  'antworten',
  'ueberfaellig',
  'heute',
  'annahme_pruefen',
  'neue_anfragen',
  'zurueckziehen',
  'kommend',
]

export async function ladeQueue(memberId: string | null): Promise<QueueItem[]> {
  let q = supabase.from('v_today_queue').select('*')
  q = memberId === null ? q.is('member_id', null) : q.eq('member_id', memberId)
  return pruefe(
    await q
      .order('section_order', { ascending: true })
      .order('rank_score', { ascending: false, nullsFirst: false })
      .order('company_name', { ascending: true, nullsFirst: false })
      .order('lead_created_at', { ascending: true })
      .range(0, 999),
  )
}

/** `tag` (YYYY-MM-DD, Europe/Berlin) ist Teil des Keys, damit der Tageswechsel neu lädt. */
export function useQueue(memberId: string | null, tag: string = heuteBerlin()) {
  return useQuery({ queryKey: qk.queue.member(memberId, tag), queryFn: () => ladeQueue(memberId), staleTime: 15_000 })
}

export type QueueZaehler = {
  je: Record<QueueSection, number>
  /** fällig + überfällig + Antworten (Sidebar-Zähler „Heute“) */
  faellig: number
  ueberfaellig: number
  /**
   * Überfällig wie die Sektion auf Heute (ohne Rückrufe und Opener – die haben eigene Sektionen). Runde 2: Team zeigte „63
   * überfällig“, Heute „60“. Ohne `istOpener` zählen Opener mit.
   */
  ueberfaelligSektion: number
  /** Sektion „Heute“ wie auf der Heute-Seite (ohne Rückrufe und Opener) */
  heuteSektion: number
  /** fällige Opener (eigene Sektion auf Heute) */
  opener: number
  rueckrufe: number
  telefon: number
  email: number
  gesamt: number
}

export function zaehleQueue(items: readonly QueueItem[], istOpener?: (stepId: string | null) => boolean): QueueZaehler {
  const je = Object.fromEntries(QUEUE_SEKTIONEN.map((s) => [s, 0])) as Record<QueueSection, number>
  let rueckrufe = 0
  let telefon = 0
  let email = 0
  let ueberfaelligSektion = 0
  let heuteSektion = 0
  let opener = 0
  for (const i of items) {
    const s = i.section as QueueSection | null
    if (s && s in je) je[s] += 1
    const faelligJetzt = s === 'ueberfaellig' || s === 'heute'
    // Reihenfolge wie features/heute/sektionen.ts sektionVon: Rückruf → Opener → Überfällig/Heute
    const istRueckruf = i.item_kind === 'rueckruf'
    const istOpenerSchritt = !istRueckruf && i.item_kind === 'sequenz_schritt' && !!istOpener?.(i.step_id ?? null)
    if (faelligJetzt && istOpenerSchritt) opener += 1
    if (s === 'ueberfaellig' && !istRueckruf && !istOpenerSchritt) ueberfaelligSektion += 1
    if (s === 'heute' && !istRueckruf && !istOpenerSchritt) heuteSektion += 1
    if (faelligJetzt && istRueckruf) rueckrufe += 1
    if (faelligJetzt && i.item_kind === 'sequenz_schritt' && i.channel === 'telefon') telefon += 1
    if (faelligJetzt && i.item_kind === 'sequenz_schritt' && i.channel === 'email') email += 1
  }
  return {
    je,
    faellig: je.antworten + je.ueberfaellig + je.heute,
    ueberfaellig: je.ueberfaellig,
    ueberfaelligSektion,
    heuteSektion,
    opener,
    rueckrufe,
    telefon: telefon + rueckrufe,
    email,
    gesamt: items.length,
  }
}

/**
 * Liest die Sequenzen nur aus dem Cache (kein Beobachter, kein Request). Runde 3: ein `useQuery({ queryKey: qk.sequences,
 * enabled: false })` ohne `queryFn` hängte seine Optionen an die Query – jede Invalidierung schrieb dann „No queryFn was passed …“
 * in die Konsole (hunderte Male je Sitzung). `skipToken` meldet beim Neuladen ebenfalls einen Fehler.
 */
function useGecachteSequenzen(): SequenceMitSchritten[] | undefined {
  const qc = useQueryClient()
  // batchCalls wie useIsFetching: Cache-Ereignisse aus dem Render einer anderen Komponente (neue Query → „added“) melden erst
  // danach – sonst „Cannot update a component (Sidebar) while rendering a different component“.
  const abonnieren = useCallback(
    (melden: () => void) => qc.getQueryCache().subscribe(notifyManager.batchCalls(melden)),
    [qc],
  )
  const lesen = useCallback(() => qc.getQueryData<SequenceMitSchritten[]>(qk.sequences), [qc])
  return useSyncExternalStore(abonnieren, lesen, lesen)
}

/**
 * Zähler der Queue einer Person – EINE Zählweise für Heute-Kopf, Team-Vergleich und Sidebar (Runde 3). Ohne `istOpener` erkennt
 * der Hook Opener über die schon geladenen Sequenzen (`qk.sequences`, `is_opener`) – nur aus dem Cache, ohne eigenen Request und
 * ohne `sequences.ts` im Start-Bundle (Sidebar); Heute und Team laden die Sequenzen ohnehin.
 */
export function useQueueZaehler(
  memberId: string | null,
  tag: string = heuteBerlin(),
  istOpener?: (stepId: string | null) => boolean,
) {
  const sequenzen = useGecachteSequenzen()
  const opener = useMemo(() => {
    if (istOpener) return istOpener
    const ids = new Set((sequenzen ?? []).flatMap((s) => s.steps.filter((st) => st.is_opener).map((st) => st.id)))
    return (id: string | null) => !!id && ids.has(id)
  }, [istOpener, sequenzen])
  return useQuery({
    queryKey: qk.queue.member(memberId, tag),
    queryFn: () => ladeQueue(memberId),
    staleTime: 15_000,
    select: (items: QueueItem[]) => zaehleQueue(items, opener),
  })
}

/** Nimmt passende Zeilen sofort aus allen gecachten Queues (optimistisch, ux § 4.2); Rückgabe = Stand davor für `onError`. */
export function queueOptimistischEntfernen(qc: QueryClient, passt: (i: QueueItem) => boolean): [QueryKey, unknown][] {
  const vorher = qc.getQueriesData<QueueItem[]>({ queryKey: qk.queue.all })
  qc.setQueriesData<QueueItem[]>({ queryKey: qk.queue.all }, (alt) => alt?.filter((i) => !passt(i)))
  return vorher
}
