// BAUPLAN § 5.4 – reine Zuordnung der View-Zeilen (`v_today_queue`, 7 Sektionen) zu den 9 ux-Sektionen, Sortierung,
// Batch-Filter und eingefrorene Reihenfolge (E15). Keine Hooks, damit useHeuteQueue.test.ts alles ohne DOM prüfen kann.
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { isodow, tagPlus, type Tag } from '@/lib/zeit'
import type { QueueItem, UiSektion } from '@/types/domain'

/** Feste Reihenfolge der Sektionen (ux § 1.5, § 5.4). */
export const SEKTIONEN: readonly UiSektion[] = [
  'rueckrufe',
  'antworten',
  'ueberfaellig',
  'heute',
  'annahme_pruefen',
  'opener',
  'neue_anfragen',
  'zurueckziehen',
  'spaeter',
]

/** Sektionen mit Karten (statt Abhakzeilen). */
export const KARTEN_SEKTIONEN: ReadonlySet<UiSektion> = new Set([
  'rueckrufe',
  'antworten',
  'ueberfaellig',
  'heute',
  'opener',
  'spaeter',
])
/** Sektionen mit Abhakzeilen (DESIGN-SYSTEM § 5.9). */
export const ABHAK_SEKTIONEN: ReadonlySet<UiSektion> = new Set(['annahme_pruefen', 'neue_anfragen', 'zurueckziehen'])
/** „Fällig“ im Seitenkopf = Rückrufe + Antworten + Überfällig + Heute + Opener (§ 3.2). */
export const FAELLIG_SEKTIONEN: readonly UiSektion[] = ['rueckrufe', 'antworten', 'ueberfaellig', 'heute', 'opener']

export type SektionsKontext = {
  heute: Tag
  /** `stepsById[step_id].is_opener` */
  istOpener: (stepId: string | null) => boolean
  /** settings.queue.withdraw_weekday (isodow, 5 = Freitag) */
  withdrawWeekday: number
  /** settings.queue.kommend_days */
  kommendDays: number
  /** `?sektion=zurueckziehen` erzwingt die Sektion */
  zeigeZurueckziehen?: boolean
}

export type Sektionen = Record<UiSektion, QueueItem[]>

/** Stabiler Schlüssel einer Queue-Zeile (`item_id` ist in der View nie leer; Fallback für Fixtures). */
export function itemKey(i: QueueItem): string {
  return i.item_id ?? `${i.item_kind ?? 'item'}:${i.lead_id ?? ''}:${i.section ?? ''}`
}

export function leereSektionen(): Sektionen {
  return Object.fromEntries(SEKTIONEN.map((s) => [s, [] as QueueItem[]])) as unknown as Sektionen
}

/** Erste zutreffende Regel aus § 5.4; `null` = nicht anzeigen. */
export function sektionVon(i: QueueItem, ctx: SektionsKontext): UiSektion | null {
  const s = i.section
  const faelligJetzt = s === 'ueberfaellig' || s === 'heute'
  if (i.item_kind === 'rueckruf' && faelligJetzt) return 'rueckrufe'
  if (s === 'antworten') return 'antworten'
  if (i.item_kind === 'sequenz_schritt' && faelligJetzt && ctx.istOpener(i.step_id)) return 'opener'
  if (s === 'ueberfaellig') return 'ueberfaellig'
  if (s === 'heute') return 'heute'
  if (s === 'annahme_pruefen') return 'annahme_pruefen'
  if (s === 'neue_anfragen') return 'neue_anfragen'
  if (s === 'zurueckziehen')
    return ctx.zeigeZurueckziehen || isodow(ctx.heute) === ctx.withdrawWeekday ? 'zurueckziehen' : null
  if (s === 'kommend') {
    const grenze = tagPlus(ctx.heute, ctx.kommendDays)
    return i.due_date && i.due_date <= grenze ? 'spaeter' : null
  }
  return null
}

const str = (v: string | null | undefined) => v ?? ''
const num = (v: number | null | undefined) => v ?? 0

/** `rank_score desc` → `company_name asc nulls last` → `lead_created_at asc` (E15, § 5.4). */
function nachRang(a: QueueItem, b: QueueItem): number {
  const r = num(b.rank_score) - num(a.rank_score)
  if (r !== 0) return r
  if (a.company_name !== b.company_name) {
    if (a.company_name == null) return 1
    if (b.company_name == null) return -1
    return a.company_name.localeCompare(b.company_name, 'de')
  }
  return str(a.lead_created_at).localeCompare(str(b.lead_created_at))
}
const dueAuf = (a: QueueItem, b: QueueItem) => str(a.due_at).localeCompare(str(b.due_at)) || nachRang(a, b)
const dueAb = (a: QueueItem, b: QueueItem) => str(b.due_at).localeCompare(str(a.due_at)) || nachRang(a, b)
const angelegtAuf = (a: QueueItem, b: QueueItem) => str(a.lead_created_at).localeCompare(str(b.lead_created_at))

/** Sortierung je Sektion (§ 5.4). */
export function vergleicher(s: UiSektion): (a: QueueItem, b: QueueItem) => number {
  switch (s) {
    case 'rueckrufe':
    case 'antworten':
    case 'zurueckziehen':
    case 'spaeter':
      return dueAuf
    case 'annahme_pruefen':
      return dueAb
    case 'neue_anfragen':
      return angelegtAuf
    default:
      return nachRang
  }
}

/** View-Zeilen → sortierte ux-Sektionen. */
export function sektionenAbleiten(items: readonly QueueItem[], ctx: SektionsKontext): Sektionen {
  const out = leereSektionen()
  for (const i of items) {
    const s = sektionVon(i, ctx)
    if (s) out[s].push(i)
  }
  for (const s of SEKTIONEN) out[s].sort(vergleicher(s))
  return out
}

// ── Batch-Chips (ux § 3.1.1 Nr. 3, DESIGN-SYSTEM § 5.6) ───────────────────────

/** `schritt`: alle Schritte gleichen Namens (A und B haben je „Kurzfristig 1“ – ein Chip, ux § 3.1.1 Nr. 3). */
export type BatchFilter =
  { art: 'schritt'; stepIds: readonly string[] } | { art: 'antworten' } | { art: 'anrufe' } | { art: 'email' } | null

export type BatchChip = { key: string; label: string; zaehler: number; filter: BatchFilter; kbd: string | null }

export function passtBatch(i: QueueItem, sektion: UiSektion, f: BatchFilter): boolean {
  if (!f) return true
  switch (f.art) {
    case 'schritt':
      return i.item_kind === 'sequenz_schritt' && !!i.step_id && f.stepIds.includes(i.step_id)
    case 'antworten':
      return sektion === 'antworten'
    case 'anrufe':
      return i.channel === 'telefon'
    case 'email':
      return i.channel === 'email'
  }
}

export function filtereSektionen(sektionen: Sektionen, f: BatchFilter): Sektionen {
  if (!f) return sektionen
  const out = leereSektionen()
  for (const s of SEKTIONEN) out[s] = sektionen[s].filter((i) => passtBatch(i, s, f))
  return out
}

export type SchrittInfo = { name: string; position: number; sequenceKey?: string }

/** Reihenfolge der Sequenzen in den Chips: A/B vor C, danach der Rest (ux-Beispiel „Opener · Kurzfristig 1 … · Nachfassen“). */
const SEQ_RANG: readonly string[] = Object.values(SEQUENZ)
const seqRang = (key: string | undefined) => {
  const i = key ? SEQ_RANG.indexOf(key) : -1
  return i < 0 ? 99 : i
}

/**
 * „Alle 23 · Opener 8 · Kurzfristig 1 9 · … · Anrufe 5 · E-Mail 1 · Antworten 2“ – Nullwerte fallen weg; Schritte gleichen
 * Namens (A und B) teilen sich einen Chip. `⌥0` = Alle, `⌥1–9` die ersten neun weiteren Chips (BAUPLAN § 1.5 Nr. 23).
 * Zählt nur die fälligen Sektionen.
 */
export function batchChips(sektionen: Sektionen, schritt: (stepId: string) => SchrittInfo | null): BatchChip[] {
  const faellig = FAELLIG_SEKTIONEN.flatMap((s) => sektionen[s].map((i) => ({ i, s })))
  const gruppen = new Map<
    string,
    { name: string; rang: number; position: number; stepIds: Set<string>; zaehler: number }
  >()
  let anrufe = 0
  let email = 0
  let antworten = 0
  for (const { i, s } of faellig) {
    if (s === 'antworten') antworten++
    if (i.channel === 'telefon') anrufe++
    if (i.channel === 'email') email++
    if (i.item_kind === 'sequenz_schritt' && i.channel === 'linkedin' && i.step_id) {
      const st = schritt(i.step_id) ?? { name: i.title ?? 'Schritt', position: 99 }
      const alt = gruppen.get(st.name)
      const rang = Math.min(alt?.rang ?? 99, seqRang(st.sequenceKey))
      gruppen.set(st.name, {
        name: st.name,
        rang,
        position: Math.min(alt?.position ?? 99, st.position),
        stepIds: new Set([...(alt?.stepIds ?? []), i.step_id]),
        zaehler: (alt?.zaehler ?? 0) + 1,
      })
    }
  }
  const chips: BatchChip[] = [{ key: 'alle', label: 'Alle', zaehler: faellig.length, filter: null, kbd: '⌥0' }]
  const sortiert = [...gruppen.values()].sort(
    (a, b) => a.rang - b.rang || a.position - b.position || a.name.localeCompare(b.name, 'de'),
  )
  for (const g of sortiert)
    chips.push({
      key: `schritt:${g.name}`,
      label: g.name,
      zaehler: g.zaehler,
      filter: { art: 'schritt', stepIds: [...g.stepIds].sort() },
      kbd: null,
    })
  if (anrufe) chips.push({ key: 'anrufe', label: 'Anrufe', zaehler: anrufe, filter: { art: 'anrufe' }, kbd: null })
  if (email) chips.push({ key: 'email', label: 'E-Mail', zaehler: email, filter: { art: 'email' }, kbd: null })
  if (antworten)
    chips.push({ key: 'antworten', label: 'Antworten', zaehler: antworten, filter: { art: 'antworten' }, kbd: null })
  return chips.map((c, i) => (i === 0 ? c : { ...c, kbd: i <= 9 ? `⌥${i}` : null }))
}

export function gleicherFilter(a: BatchFilter, b: BatchFilter): boolean {
  if (a === null || b === null) return a === b
  if (a.art !== b.art) return false
  if (a.art === 'schritt' && b.art === 'schritt')
    return a.stepIds.length === b.stepIds.length && a.stepIds.every((id) => b.stepIds.includes(id))
  return true
}

// ── Zähler ────────────────────────────────────────────────────────────────

export function zaehleFaellig(sektionen: Sektionen): { faellig: number; ueberfaellig: number } {
  const faellig = FAELLIG_SEKTIONEN.reduce((n, s) => n + sektionen[s].length, 0)
  return { faellig, ueberfaellig: sektionen.ueberfaellig.length }
}

// ── Eingefrorene Reihenfolge (E15, H-16) ─────────────────────────────────

/**
 * Bestehende Reihenfolge bleibt; verschwundene Schlüssel fallen weg (außer `behalten`, z. B. Erledigt-Zeilen),
 * neue Schlüssel werden angehängt (Chip „neu“). Ohne `alt` gilt die sortierte Reihenfolge.
 */
export function stabileReihenfolge(
  alt: readonly string[] | undefined,
  sortiert: readonly string[],
  behalten: ReadonlySet<string> = new Set(),
): { reihenfolge: string[]; neue: string[] } {
  if (!alt) return { reihenfolge: [...sortiert], neue: [] }
  const vorhanden = new Set(sortiert)
  const reihenfolge = alt.filter((k) => vorhanden.has(k) || behalten.has(k))
  const bekannt = new Set(reihenfolge)
  const neue = sortiert.filter((k) => !bekannt.has(k))
  return { reihenfolge: [...reihenfolge, ...neue], neue }
}
