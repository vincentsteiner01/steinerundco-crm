// BAUPLAN § 3.2 useHeuteQueue: useQueue → ux-Sektionen (§ 5.4), Sortierung, eingefrorene Reihenfolge (E15/H-16),
// Batch-Filter (?schritt=, ⌥1–9/⌥0), Zähler Fällig/Überfällig, Realtime-Neuzugänge (Chip „neu“ 4 s) und
// „Schon erledigt von …“ (Zeile 4 s), wenn die andere Person eine Karte wegnimmt.
// Sitzungszustand (Reihenfolge, Marker) liegt in einem kleinen zustand-Store je Hook-Instanz: Effekte schreiben,
// der Render liest – keine Refs im Render, kein setState im Effekt (oxlint react/*).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useQueue } from '@/data/queue'
import { useAndere } from '@/data/members'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { fmtZeit, heuteBerlin } from '@/lib/format'
import type { QueueItem, UiSektion } from '@/types/domain'
import { jetzt } from './karten'
import {
  batchChips,
  filtereSektionen,
  itemKey,
  leereSektionen,
  SEKTIONEN,
  sektionenAbleiten,
  stabileReihenfolge,
  zaehleFaellig,
  type BatchChip,
  type BatchFilter,
  type Sektionen,
} from './sektionen'
import { anzeigeName } from '@/lib/mitglied'

export const NEU_MS = 4000

export type FremdErledigt = { key: string; sektion: UiSektion; name: string; zeit: string; von: string }

type Reihenfolge = Record<UiSektion, string[]>

type QueueStore = {
  /** eingefrorene Reihenfolge je Sektion; `null` = (neu) aus der Sortierung aufbauen */
  reihenfolge: Reihenfolge | null
  neu: ReadonlySet<string>
  fremd: FremdErledigt[]
  eigen: Set<string>
  vorher: Map<string, { item: QueueItem; sektion: UiSektion }>
}

export type HeuteQueue = {
  laden: boolean
  fehler: unknown
  /** Erneut laden (Fehlerzeile „erneut versuchen R“, ux § 4.3) */
  nachladen: () => void
  items: QueueItem[]
  byKey: ReadonlyMap<string, QueueItem>
  /** Sektionen nach Batch-Filter, in eingefrorener Reihenfolge */
  sektionen: Sektionen
  /** Sektionen ohne Filter (Zähler, Später-Spalte) */
  alleSektionen: Sektionen
  /** Eingefrorene Schlüssel je Sektion – enthält auch `behalten` (Erledigt-Zeilen bleiben an ihrer Position) */
  reihenfolge: Reihenfolge
  chips: BatchChip[]
  batch: BatchFilter
  setBatch: (f: BatchFilter) => void
  /** Schlüssel, die seit dem letzten Laden per Realtime dazukamen (Chip „neu“) */
  neu: ReadonlySet<string>
  fremdErledigt: FremdErledigt[]
  /** ⌥R: Reihenfolge neu aus der Sortierung aufbauen */
  neuSortieren: () => void
  /** `S` auf einer Abhakzeile: ans Sektionsende */
  ansEnde: (key: string) => void
  /** Vor einer eigenen Mutation aufrufen – dann gilt das Verschwinden nicht als „schon erledigt von …“ */
  markiereEigen: (key: string) => void
  zaehler: { faellig: number; ueberfaellig: number }
  /** Sequenzschritt-Infos (Name, Position, Opener) aus useSequencesIndex */
  schritt: (
    stepId: string | null | undefined,
  ) => { name: string; position: number; isOpener: boolean; sequenceKey: string } | null
}

export type HeuteQueueOptionen = {
  /** Schlüssel, die in der Reihenfolge bleiben, obwohl die View sie nicht mehr liefert (Erledigt-/Später-Zeilen) */
  behalten?: ReadonlySet<string>
  /** `?sektion=zurueckziehen` */
  zeigeZurueckziehen?: boolean
  /** `?schritt=<step_id>` als Startfilter */
  schritt?: string | null
  heute?: string
}

const LEER: ReadonlySet<string> = new Set()

const gleicheReihenfolge = (a: Reihenfolge | null, b: Reihenfolge): boolean =>
  !!a && SEKTIONEN.every((s) => a[s].length === b[s].length && a[s].every((k, i) => k === b[s][i]))

export function useHeuteQueue(memberId: string | null, opts: HeuteQueueOptionen = {}): HeuteQueue {
  const heute = opts.heute ?? heuteBerlin()
  const { data: items, isPending, error, refetch } = useQueue(memberId, heute)
  const { data: idx } = useSequencesIndex()
  const { data: settings } = useSettings()
  const andere = useAndere()
  const behalten = opts.behalten ?? LEER

  const [store] = useState(() =>
    createStore<QueueStore>(() => ({
      reihenfolge: null,
      neu: new Set(),
      fremd: [],
      eigen: new Set(),
      vorher: new Map(),
    })),
  )
  const reihenfolgeAlt = useStore(store, (s) => s.reihenfolge)
  const neu = useStore(store, (s) => s.neu)
  const fremdErledigt = useStore(store, (s) => s.fremd)

  const stepsById = idx?.stepsById
  const schritt = useCallback<HeuteQueue['schritt']>(
    (stepId) => {
      if (!stepId || !stepsById) return null
      const s = stepsById.get(stepId)
      return s ? { name: s.name, position: s.position, isOpener: s.is_opener, sequenceKey: s.sequence_key } : null
    },
    [stepsById],
  )

  const roh = useMemo(
    () =>
      sektionenAbleiten(items ?? [], {
        heute,
        istOpener: (id) => !!(id && stepsById?.get(id)?.is_opener),
        withdrawWeekday: settings?.queue.withdraw_weekday ?? 5,
        kommendDays: settings?.queue.kommend_days ?? 7,
        zeigeZurueckziehen: opts.zeigeZurueckziehen,
      }),
    [items, heute, stepsById, settings?.queue.withdraw_weekday, settings?.queue.kommend_days, opts.zeigeZurueckziehen],
  )

  const byKey = useMemo(() => {
    const m = new Map<string, QueueItem>()
    for (const i of items ?? []) m.set(itemKey(i), i)
    return m
  }, [items])

  // ── eingefrorene Reihenfolge (rein aus roh + letzter Reihenfolge) ──
  const berechnet = useMemo(() => {
    const out = leereSektionen()
    const reihen = Object.fromEntries(SEKTIONEN.map((s) => [s, [] as string[]])) as Reihenfolge
    const neue: string[] = []
    for (const s of SEKTIONEN) {
      const sortiert = roh[s].map(itemKey)
      const r = stabileReihenfolge(reihenfolgeAlt?.[s], sortiert, behalten)
      reihen[s] = r.reihenfolge
      neue.push(...r.neue)
      const nachKey = new Map(roh[s].map((i) => [itemKey(i), i]))
      out[s] = r.reihenfolge.map((k) => nachKey.get(k)).filter((i): i is QueueItem => !!i)
    }
    return { alleSektionen: out, reihenfolge: reihen, neue }
  }, [roh, reihenfolgeAlt, behalten])

  // Store nachziehen: Reihenfolge einfrieren, Neuzugänge 4 s markieren (nur nach dem ersten Laden)
  useEffect(() => {
    if (!items) return
    const s = store.getState()
    const erstesMal = s.reihenfolge === null
    if (!gleicheReihenfolge(s.reihenfolge, berechnet.reihenfolge))
      store.setState({ reihenfolge: berechnet.reihenfolge })
    if (erstesMal || !berechnet.neue.length) return
    const keys = berechnet.neue
    store.setState((st) => ({ neu: new Set([...st.neu, ...keys]) }))
    const t = window.setTimeout(
      () =>
        store.setState((st) => {
          const n = new Set(st.neu)
          for (const k of keys) n.delete(k)
          return { neu: n }
        }),
      NEU_MS,
    )
    return () => window.clearTimeout(t)
  }, [berechnet, items, store])

  // „Schon erledigt von Mike um 10:41“ – verschwundene Zeilen, die nicht von uns stammen
  useEffect(() => {
    const st = store.getState()
    const aktuell = new Map<string, { item: QueueItem; sektion: UiSektion }>()
    for (const s of SEKTIONEN) for (const i of roh[s]) aktuell.set(itemKey(i), { item: i, sektion: s })
    const weg: FremdErledigt[] = []
    for (const [k, v] of st.vorher) {
      if (aktuell.has(k)) continue
      if (st.eigen.delete(k)) continue
      weg.push({
        key: k,
        sektion: v.sektion,
        name: v.item.lead_name ?? '',
        zeit: fmtZeit(jetzt()),
        von: anzeigeName(andere, 'der anderen Person'),
      })
    }
    store.setState({ vorher: aktuell })
    if (!weg.length) return
    store.setState((s) => ({ fremd: [...s.fremd, ...weg] }))
    const t = window.setTimeout(
      () => store.setState((s) => ({ fremd: s.fremd.filter((f) => !weg.some((w) => w.key === f.key)) })),
      NEU_MS,
    )
    return () => window.clearTimeout(t)
  }, [roh, andere, store])

  // ── Batch-Filter ──
  // `?schritt=<step_id>`: Startfilter auf diesen Schritt – samt gleichnamiger Schritte anderer Sequenzen (ein Chip je Name)
  const [batchGewaehlt, setBatch] = useState<BatchFilter | undefined>(undefined)
  const chips = useMemo(
    () =>
      batchChips(berechnet.alleSektionen, (id) => {
        const s = schritt(id)
        return s ? { name: s.name, position: s.position, sequenceKey: s.sequenceKey } : null
      }),
    [berechnet.alleSektionen, schritt],
  )
  const startSchritt = opts.schritt ?? null
  const batch = useMemo<BatchFilter>(() => {
    if (batchGewaehlt !== undefined) return batchGewaehlt
    if (!startSchritt) return null
    const name = stepsById?.get(startSchritt)?.name
    const gleich = name ? [...(stepsById?.values() ?? [])].filter((s) => s.name === name).map((s) => s.id) : []
    return { art: 'schritt', stepIds: gleich.length ? gleich.sort() : [startSchritt] }
  }, [batchGewaehlt, startSchritt, stepsById])
  const sektionen = useMemo(() => filtereSektionen(berechnet.alleSektionen, batch), [berechnet.alleSektionen, batch])
  const zaehler = useMemo(() => zaehleFaellig(berechnet.alleSektionen), [berechnet.alleSektionen])

  const neuSortieren = useCallback(() => store.setState({ reihenfolge: null }), [store])
  const ansEnde = useCallback(
    (key: string) => {
      const r = store.getState().reihenfolge
      if (!r) return
      for (const s of SEKTIONEN) {
        if (!r[s].includes(key)) continue
        store.setState({ reihenfolge: { ...r, [s]: [...r[s].filter((k) => k !== key), key] } })
        return
      }
    },
    [store],
  )
  const markiereEigen = useCallback(
    (key: string) => {
      store.getState().eigen.add(key)
    },
    [store],
  )

  return {
    laden: isPending,
    fehler: error,
    nachladen: () => void refetch(),
    items: items ?? [],
    byKey,
    sektionen,
    alleSektionen: berechnet.alleSektionen,
    reihenfolge: berechnet.reihenfolge,
    chips,
    batch,
    setBatch,
    neu,
    fremdErledigt,
    neuSortieren,
    ansEnde,
    markiereEigen,
    zaehler,
    schritt,
  }
}
