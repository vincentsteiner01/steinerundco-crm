// Helfer der Daten-Schicht (BAUPLAN § 3.1.6). Module importieren sie nur über `@/data` (index.ts) – Integration: `pruefe`,
// `useAlleSeiten` und `alleSeiten` sind seit M1–M8 freigegeben (FOUNDATION-WUNSCH M5/M8).
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fmtDatumKurz } from '@/lib/format'
import { berlinTag as zeitBerlinTag, tagPlus as zeitTagPlus, tagZuDate } from '@/lib/zeit'

/** Seitengröße für Listen (E18, architektur § 4.4). */
export const SEITE = 500
/** Keyset-Seite der Timeline (E18). */
export const TIMELINE_SEITE = 50
export const ZEITZONE = 'Europe/Berlin'

type Antwort = { data: unknown; error: unknown }
/** Datentyp des Erfolgszweigs einer PostgREST-Antwort (`error: null`). */
type Erfolg<R> = R extends { data: infer D; error: null } ? D : never

/** Wirft den PostgREST-Fehler als Exception – damit landet er in onError / errors.ts. Rückgabe = `data` des Erfolgszweigs (ohne null). */
export function pruefe<R extends Antwort>(r: R): NonNullable<Erfolg<R>> {
  if (r.error) throw r.error
  return r.data as NonNullable<Erfolg<R>>
}

/** Wie `pruefe`, erlaubt aber `null` (maybeSingle). */
export function pruefeNull<R extends Antwort>(r: R): Erfolg<R> {
  if (r.error) throw r.error
  return r.data as Erfolg<R>
}

/** Entfernt `undefined`-Werte (PostgREST-RPC-Argumente: fehlende Keys = SQL-Default). */
export function ohneUndefined<T extends object>(o: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as T
}

/** PostgREST-`or()`-Werte dürfen keine Trenner enthalten; Wildcards werden entschärft. */
export function orWert(s: string): string {
  return s
    .replace(/[,().\\%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Kalendertag (YYYY-MM-DD) in Europe/Berlin für einen Zeitpunkt – lib/zeit (Integration: vorher eigene Kopie hier). */
export function berlinTag(d: Date = new Date()): string {
  return zeitBerlinTag(d)
}
export const heuteBerlin = (): string => berlinTag()

/** 00:00 Europe/Berlin eines Kalendertags (YYYY-MM-DD) als UTC-ISO-String. */
export function berlinMitternachtIso(tag: string): string {
  return tagZuDate(tag, '00:00').toISOString()
}

/** Folgetag eines YYYY-MM-DD. */
export const tagPlus = (tag: string, tage: number): string => zeitTagPlus(tag, tage)

/** Zeitraum [von 00:00, bis 24:00) Europe/Berlin als UTC-ISO-Grenzen (BAUPLAN § 1.5 Nr. 40). */
export function zeitraumGrenzen(von: string, bis: string): { ab: string; vor: string } {
  return { ab: berlinMitternachtIso(von), vor: berlinMitternachtIso(tagPlus(bis, 1)) }
}

/** „Do 16.10.“ – kurze Datumsangabe für Realtime-Toasts (lib/format.fmtDatumKurz). */
export const kurzDatum = (iso: string): string => fmtDatumKurz(iso)

/**
 * Lädt alle Seiten à 500 hintereinander (useInfiniteQuery), bis `hatMehr = false` (§ 1.5 Nr. 40).
 * `lader(von, bis)` ruft `.range(von, bis)` auf und liefert die Zeilen der Seite.
 */
export type AlleSeiten<T> = { data: T[]; hatMehr: boolean; istLaden: boolean; fehler: unknown; nachladen: () => void }

export function useAlleSeiten<T>(
  queryKey: QueryKey,
  lader: (von: number, bis: number) => Promise<T[]>,
  enabled = true,
): AlleSeiten<T> {
  const q = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => lader(pageParam * SEITE, pageParam * SEITE + SEITE - 1),
    getNextPageParam: (letzte: T[], alle) => (letzte.length < SEITE ? undefined : alle.length),
  })
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = q
  useEffect(() => {
    if (enabled && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [enabled, hasNextPage, isFetchingNextPage, fetchNextPage])
  return {
    data: q.data?.pages.flat() ?? [],
    hatMehr: Boolean(hasNextPage),
    // Eine abgeschaltete Abfrage (enabled = false) lädt nicht – TanStack meldet sie trotzdem als `pending`.
    istLaden: enabled && (q.isPending || Boolean(hasNextPage)),
    fehler: q.error,
    nachladen: () => void refetch(),
  }
}

/**
 * Hookfreie Variante (Ein-Klick-Exporte, Auskunft): alle Zeilen einer Abfrage, Seiten à 500.
 * `seite(von, bis)` baut die typisierte Abfrage mit `.range(von, bis)`.
 */
export async function alleSeiten<T>(seite: (von: number, bis: number) => PromiseLike<Antwort>): Promise<T[]> {
  const alle: T[] = []
  for (let i = 0; ; i++) {
    const r = await seite(i * SEITE, i * SEITE + SEITE - 1)
    if (r.error) throw r.error
    const zeilen = (r.data ?? []) as T[]
    alle.push(...zeilen)
    if (zeilen.length < SEITE) break
  }
  return alle
}
