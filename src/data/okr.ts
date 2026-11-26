// Reiter „Ziele“ (OKR, 26.11.2026): Ziele, Key Results, von Hand gezählte Einträge und To-dos lesen und schreiben.
// Die Tabellen sind klein (ein paar Dutzend Zeilen je Monat) – geladen wird alles auf einmal unter einem Key; die Seite
// sucht sich den Monat heraus. Bewusst nicht im Barrel data/index.ts – nur der Reiter „Ziele“ lädt diese Datei.
// Schreiben: Zählen und Abhaken sind sofort sichtbar (optimistisch im Cache). Neu geladen wird erst, wenn kein weiterer
// Schreibvorgang mehr läuft – sonst spränge bei schnellen Klicks ein Zähler kurz zurück (dieselbe Regel wie beim Board).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  EBENEN,
  QUELLEN,
  TAKTE,
  type Ebene,
  type OkrDaten,
  type OkrEintrag,
  type OkrErgebnis,
  type OkrTodo,
  type OkrZiel,
  type Quelle,
  type Takt,
} from '@/features/okr/rechnen'
import { istTag, type Tag } from '@/lib/zeit'
import type { Database } from '@/types/database'
import { alleSeiten, heuteBerlin, pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { OKR_KEY, OKR_SCHREIBEN } from './okrKeys'
import { rpc } from './rpc'
import { supabase } from './supabase'

export { OKR_KEY, OKR_SCHREIBEN }

type Tabellen = Database['crm']['Tables']
type ZielRoh = Pick<Tabellen['okr_ziele']['Row'], 'id' | 'titel' | 'ebene' | 'von' | 'bis' | 'position'>
type ErgebnisRoh = Pick<
  Tabellen['okr_ergebnisse']['Row'],
  'id' | 'ziel_id' | 'titel' | 'zielwert' | 'takt' | 'je_person' | 'quelle' | 'faktor' | 'einheit' | 'position'
>
type EintragRoh = Pick<Tabellen['okr_eintraege']['Row'], 'ergebnis_id' | 'member_id' | 'tag' | 'wert'>
type TodoRoh = Pick<
  Tabellen['okr_todos']['Row'],
  'id' | 'ergebnis_id' | 'text' | 'member_id' | 'erledigt_at' | 'position'
>

const eines = <T extends string>(liste: readonly T[], wert: string): wert is T =>
  (liste as readonly string[]).includes(wert)

/** Zeile → Ziel; `null`, wenn die Zeile nicht zu dem passt, was die Oberfläche kennt (unbekannte Ebene, kaputtes Datum). */
export function alsZiel(z: ZielRoh): OkrZiel | null {
  if (!eines<Ebene>(EBENEN, z.ebene) || !istTag(z.von) || !istTag(z.bis)) return null
  return { id: z.id, titel: z.titel, ebene: z.ebene, von: z.von, bis: z.bis, position: z.position }
}

export function alsErgebnis(e: ErgebnisRoh): OkrErgebnis | null {
  if (!eines<Takt>(TAKTE, e.takt) || !eines<Quelle>(QUELLEN, e.quelle)) return null
  const zielwert = Number(e.zielwert)
  const faktor = Number(e.faktor)
  if (!(zielwert > 0) || !(faktor > 0)) return null
  return {
    id: e.id,
    ziel_id: e.ziel_id,
    titel: e.titel,
    zielwert,
    takt: e.takt,
    je_person: e.je_person,
    quelle: e.quelle,
    faktor,
    einheit: e.einheit?.trim() || null,
    position: e.position,
  }
}

function alsEintrag(x: EintragRoh): OkrEintrag | null {
  const wert = Number(x.wert)
  if (!istTag(x.tag) || !(wert > 0)) return null
  return { ergebnis_id: x.ergebnis_id, member_id: x.member_id, tag: x.tag, wert }
}

const vorhanden = <T>(x: T | null): x is T => x !== null

export async function ladeOkr(): Promise<OkrDaten> {
  const [ziele, ergebnisse, eintraege, todos] = await Promise.all([
    alleSeiten<ZielRoh>((v, b) =>
      supabase
        .from('okr_ziele')
        .select('id, titel, ebene, von, bis, position')
        .order('von', { ascending: true })
        .order('position', { ascending: true })
        .order('id', { ascending: true })
        .range(v, b),
    ),
    alleSeiten<ErgebnisRoh>((v, b) =>
      supabase
        .from('okr_ergebnisse')
        .select('id, ziel_id, titel, zielwert, takt, je_person, quelle, faktor, einheit, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(v, b),
    ),
    alleSeiten<EintragRoh>((v, b) =>
      supabase
        .from('okr_eintraege')
        .select('ergebnis_id, member_id, tag, wert')
        .order('tag', { ascending: true })
        .order('ergebnis_id', { ascending: true })
        .order('member_id', { ascending: true })
        .range(v, b),
    ),
    alleSeiten<TodoRoh>((v, b) =>
      supabase
        .from('okr_todos')
        .select('id, ergebnis_id, text, member_id, erledigt_at, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(v, b),
    ),
  ])
  return {
    ziele: ziele.map(alsZiel).filter(vorhanden),
    ergebnisse: ergebnisse.map(alsErgebnis).filter(vorhanden),
    eintraege: eintraege.map(alsEintrag).filter(vorhanden),
    todos: todos satisfies OkrTodo[],
  }
}

/** Alle Ziele, Key Results, Einträge und To-dos. */
export function useOkr() {
  return useQuery({ queryKey: OKR_KEY, queryFn: ladeOkr })
}

// ── Schreiben ─────────────────────────────────────────────────────────────────────────────────────────────────

/** In onSettled zählt der eigene Vorgang noch als laufend – „höchstens einer“ heißt: dieser ist der letzte. */
function ladeNeuWennLetzter(qc: QueryClient): void {
  if (qc.isMutating({ mutationKey: OKR_SCHREIBEN }) <= 1) void qc.invalidateQueries({ queryKey: OKR_KEY })
}

/** Gemeinsames Gerüst: Fehlermeldung, Neuladen durch den letzten Schreibvorgang. */
function useSchreiben<P, R = void>(mutationFn: (p: P) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation<R, Error, P>({
    mutationKey: OKR_SCHREIBEN,
    mutationFn,
    onError: mutationFehler,
    onSettled: () => ladeNeuWennLetzter(qc),
  })
}

export type ZielEingabe = { id?: string; titel: string; ebene: Ebene; von: Tag; bis: Tag }

/** Ziel anlegen (ohne `id`) oder ändern. */
export function useZielSpeichern() {
  return useSchreiben<ZielEingabe>(async ({ id, titel, ebene, von, bis }) => {
    const felder = { titel: titel.trim(), ebene, von, bis }
    if (id) pruefe(await supabase.from('okr_ziele').update(felder).eq('id', id).select('id').single())
    else pruefe(await supabase.from('okr_ziele').insert(felder).select('id').single())
  })
}

/** Ziel löschen – seine Key Results, Einträge und To-dos gehen mit. */
export function useZielLoeschen() {
  return useSchreiben<string>(async (id) => {
    pruefe(await supabase.from('okr_ziele').delete().eq('id', id).select('id'))
  })
}

export type ErgebnisEingabe = {
  id?: string
  ziel_id: string
  titel: string
  zielwert: number
  takt: Takt
  je_person: boolean
  quelle: Quelle
  faktor: number
  einheit: string | null
}

/** Key Result anlegen (ohne `id`) oder ändern. */
export function useErgebnisSpeichern() {
  return useSchreiben<ErgebnisEingabe>(async ({ id, ...e }) => {
    const felder = { ...e, titel: e.titel.trim(), einheit: e.einheit?.trim() || null }
    if (id) pruefe(await supabase.from('okr_ergebnisse').update(felder).eq('id', id).select('id').single())
    else pruefe(await supabase.from('okr_ergebnisse').insert(felder).select('id').single())
  })
}

export function useErgebnisLoeschen() {
  return useSchreiben<string>(async (id) => {
    pruefe(await supabase.from('okr_ergebnisse').delete().eq('id', id).select('id'))
  })
}

/**
 * Einträge nach einem Klick auf +1/−1, ohne auf die Datenbank zu warten – dieselbe Regel wie crm.okr_zaehlen:
 * Plus bucht auf heute, Minus nimmt vom jüngsten Eintrag der Person weg (nie unter 0).
 */
export function gezaehlt(
  eintraege: readonly OkrEintrag[],
  ergebnisId: string,
  memberId: string,
  delta: number,
  heute: Tag,
): OkrEintrag[] {
  const meins = (x: OkrEintrag) => x.ergebnis_id === ergebnisId && x.member_id === memberId
  if (delta > 0) {
    if (eintraege.some((x) => meins(x) && x.tag === heute))
      return eintraege.map((x) => (meins(x) && x.tag === heute ? { ...x, wert: x.wert + delta } : x))
    return [...eintraege, { ergebnis_id: ergebnisId, member_id: memberId, tag: heute, wert: delta }]
  }
  let rest = -delta
  const juengsteZuerst = eintraege.filter(meins).sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0))
  const neu = new Map<Tag, number>()
  for (const x of juengsteZuerst) {
    if (rest <= 0) break
    const weg = Math.min(rest, x.wert)
    neu.set(x.tag, x.wert - weg)
    rest -= weg
  }
  return eintraege
    .map((x) => (meins(x) && neu.has(x.tag) ? { ...x, wert: neu.get(x.tag) ?? 0 } : x))
    .filter((x) => x.wert > 0)
}

export type Zaehlen = { ergebnisId: string; memberId: string; delta: number }

/** +1/−1 an einem von Hand gezählten Key Result – sofort sichtbar, bei Fehler zurück auf den alten Stand. */
export function useZaehlen() {
  const qc = useQueryClient()
  return useMutation<number, Error, Zaehlen, { vorher: OkrDaten | undefined }>({
    mutationKey: OKR_SCHREIBEN,
    mutationFn: (p) => rpc.okrZaehlen(p),
    onMutate: async ({ ergebnisId, memberId, delta }) => {
      await qc.cancelQueries({ queryKey: OKR_KEY })
      const vorher = qc.getQueryData<OkrDaten>(OKR_KEY)
      if (vorher)
        qc.setQueryData<OkrDaten>(OKR_KEY, {
          ...vorher,
          eintraege: gezaehlt(vorher.eintraege, ergebnisId, memberId, delta, heuteBerlin()),
        })
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      // nur zurückrollen, wenn dies der einzige laufende Schreibvorgang ist – sonst nähme er fremde Klicks mit zurück;
      // das Neuladen am Ende bringt dann den echten Stand
      if (ctx?.vorher && qc.isMutating({ mutationKey: OKR_SCHREIBEN }) <= 1) qc.setQueryData(OKR_KEY, ctx.vorher)
      mutationFehler(e)
    },
    onSettled: () => ladeNeuWennLetzter(qc),
  })
}

export type TodoEingabe = { ergebnis_id: string; text: string; member_id: string | null }

export function useTodoAnlegen() {
  return useSchreiben<TodoEingabe>(async ({ ergebnis_id, text, member_id }) => {
    pruefe(await supabase.from('okr_todos').insert({ ergebnis_id, text: text.trim(), member_id }).select('id').single())
  })
}

/** To-do abhaken oder wieder öffnen – sofort sichtbar. */
export function useTodoAbhaken() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; erledigt: boolean }, { vorher: OkrDaten | undefined }>({
    mutationKey: OKR_SCHREIBEN,
    mutationFn: async ({ id, erledigt }) => {
      const erledigt_at = erledigt ? new Date().toISOString() : null
      pruefe(await supabase.from('okr_todos').update({ erledigt_at }).eq('id', id).select('id').single())
    },
    onMutate: async ({ id, erledigt }) => {
      await qc.cancelQueries({ queryKey: OKR_KEY })
      const vorher = qc.getQueryData<OkrDaten>(OKR_KEY)
      if (vorher)
        qc.setQueryData<OkrDaten>(OKR_KEY, {
          ...vorher,
          todos: vorher.todos.map((t) =>
            t.id === id ? { ...t, erledigt_at: erledigt ? new Date().toISOString() : null } : t,
          ),
        })
      return { vorher }
    },
    onError: (e, _p, ctx) => {
      if (ctx?.vorher && qc.isMutating({ mutationKey: OKR_SCHREIBEN }) <= 1) qc.setQueryData(OKR_KEY, ctx.vorher)
      mutationFehler(e)
    },
    onSettled: () => ladeNeuWennLetzter(qc),
  })
}

export function useTodoLoeschen() {
  return useSchreiben<string>(async (id) => {
    pruefe(await supabase.from('okr_todos').delete().eq('id', id).select('id'))
  })
}

/** Monatsziele samt Key Results in einen anderen Monat kopieren (ohne Fortschritt und To-dos); Ergebnis = Zahl der Ziele. */
export function useMonatUebernehmen() {
  return useSchreiben<{ von: Tag; nach: Tag }, number>((p) => rpc.okrMonatUebernehmen(p))
}
