// M3 – Vorschau der Folgeaktion im Wrap-up (ux § 2.5 Schritt 3, BAUPLAN § 5.3 T1–T9): Kalendertage + Rollen (§ 1.5 Nr. 37),
// Rückruf-Wiederholungen +1/+3 Tage um `due_time + 1 h` (§ 4.4 Nr. 17), Slot-Rotation. Reine Funktionen; die DB rechnet gleich.
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { FEIERTAGE_HH, naechsterFaelligTag, naechsterWerktag, rollToWeekday } from '@/lib/werktage'
import { monatePlus, tagPlus } from '@/lib/zeit'
import type { CallOutcome, Enrollment, Lead, Settings, Task } from '@/types/domain'
import { slotFuerVersuch, wiederholungAusTitel, type SlotKey } from './anrufliste'
import { WRAPUP_LEER, type ErgebnisDef, type WrapUpWerte } from './ergebnisse'

/** Seed-Verzögerungen `telefon_standard` (E14) – Fallback, Primärquelle sind die Sequence-Steps. */
export const TELEFON_DELAYS_STANDARD: readonly number[] = [0, 2, 3, 4, 5, 90]
export const SLOTS_STANDARD: Record<SlotKey, string> = {
  A: '09:30–11:30',
  B: '14:00–16:00',
  C: '16:00–17:30',
  D: '08:00–09:30',
}

export type KadenzKontext = {
  feiertage?: readonly string[]
  /** `settings.queue.due_time` (09:00) */
  dueTime?: string
  delays?: readonly number[]
  slots?: Settings['telefon']['slots']
  maxVersuche?: number
}

function plusEineStunde(zeit: string): string {
  const [h = 9, m = 0] = zeit.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Aus einem Rückruf-Task heraus nicht erreicht: Wiederholung 1 (+1 Tag gerollt), Wiederholung 2 (+3), danach
 * Telefon-Standard ab Versuch 3 (§ 1.5 Nr. 38).
 */
export function rueckrufWiederholungText(task: Pick<Task, 'title'>, startedAt: string, k: KadenzKontext = {}): string {
  const bisher = wiederholungAusTitel(task.title)
  const feiertage = k.feiertage ?? FEIERTAGE_HH
  if (bisher >= 2) {
    const tag = naechsterFaelligTag(startedAt, k.delays?.[2] ?? TELEFON_DELAYS_STANDARD[2] ?? 3, true, feiertage)
    return `Telefon-Standard ab Versuch 3 von ${k.maxVersuche ?? 5} · ${fmtDatumKurz(tag)} · Slot C ${slotText('C', k.slots)}`
  }
  const n = bisher + 1
  const tag = naechsterFaelligTag(startedAt, n === 1 ? 1 : 3, true, feiertage)
  return `Nächster Rückruf ${fmtDatumKurz(tag)} ${plusEineStunde(k.dueTime ?? '09:00')} (Wiederholung ${n})`
}

function slotText(slot: SlotKey, slots?: Settings['telefon']['slots']): string {
  return (slots ?? SLOTS_STANDARD)[slot]
}

/** Nächster Versuch laut Kadenz: Position `versuch + 1`, Delay aus den Steps, gerollt, Slot rotiert (T1: Mi 14.10. → Fr 16.10. Slot B). */
export function naechsterVersuchText(versuch: number, startedAt: string, k: KadenzKontext = {}): string {
  const delays = k.delays ?? TELEFON_DELAYS_STANDARD
  const max = k.maxVersuche ?? 5
  const naechster = versuch + 1
  if (naechster > max) {
    const delay = delays[max] ?? 90
    const tag = naechsterFaelligTag(startedAt, delay, true, k.feiertage ?? FEIERTAGE_HH)
    return `Nach Versuch ${max} nicht erreichbar · Wiedervorlage ${fmtDatumKurz(tag)}`
  }
  const delay = delays[naechster - 1] ?? 2
  const tag = naechsterFaelligTag(startedAt, delay, true, k.feiertage ?? FEIERTAGE_HH)
  const slot = slotFuerVersuch(naechster)
  return `Nächster Versuch ${fmtDatumKurz(tag)} · Versuch ${naechster} von ${max} · Slot ${slot} ${slotText(slot, k.slots)}`
}

export function besetztText(minuten = 45): string {
  return `Erneut in ${minuten} min`
}

/** Vorbelegung des Wrap-ups je Ergebnis (ux § 2.5 Schritt 3): Gesprächspartner aus dem Lead, Rückruf nächster Werktag, Wiedervorlage +3 Monate. */
export function wrapUpVorbelegung(
  def: ErgebnisDef,
  lead: Pick<Lead, 'full_name' | 'role_title'>,
  settings: Pick<Settings, 'feiertage' | 'telefon'> | undefined,
  heute = heuteBerlin(),
): WrapUpWerte {
  const feiertage = settings?.feiertage
  const rueckrufZeit = settings?.telefon.callback_default_time ?? '10:30'
  const w: WrapUpWerte = {
    ...WRAPUP_LEER,
    reachedName: def.gruppe === 'C' ? (lead.full_name ?? '') : '',
    reachedRolle: def.gruppe === 'C' ? (lead.role_title ?? '') : '',
    reachedPerson: def.gruppe === 'C' ? 'entscheider' : def.gruppe === 'B' ? 'zentrale' : null,
  }
  switch (def.outcome) {
    case 'gatekeeper':
    case 'callback_scheduled':
      w.callbackAt = `${naechsterWerktag(heute, feiertage)}T${rueckrufZeit}`
      break
    case 'send_info':
      w.callbackAt = `${rollToWeekday(tagPlus(heute, 3), feiertage)}T${rueckrufZeit}`
      break
    case 'not_now':
      w.callbackAt = rollToWeekday(monatePlus(heute, 3), feiertage)
      break
    default:
      break
  }
  return w
}

/** Ergebnisse, nach denen die DB den nächsten Versuch bzw. die Rückruf-Wiederholung plant (§ 4.4 Nr. 17). */
export const WIEDERHOLUNG_OUTCOMES: ReadonlySet<CallOutcome> = new Set(['no_answer', 'voicemail', 'voicemail_left'])

export type FolgeLead = Pick<Lead, 'stage' | 'next_action_at'> & {
  tasks: readonly Pick<Task, 'id' | 'kind' | 'status' | 'title' | 'due_at'>[]
  enrollments: readonly Pick<Enrollment, 'channel' | 'status' | 'current_position' | 'next_due_at'>[]
}

/**
 * Wrap-up-Text aus dem Zustand NACH `log_call` (BAUPLAN § 3.4 useAnruf.test: „(Wiederholung n)“ aus der RPC-Antwort): der neue
 * Rückruf-Task trägt den Zähler im Titel, das Telefon-Enrollment Position und Fälligkeit. `null` = nichts Eindeutiges gefunden,
 * dann gilt die Vorschau aus `folgeText`.
 */
export function folgeTextAusLead(
  lead: FolgeLead,
  o: { outcome: CallOutcome; alterTaskId: string | null; ausRueckruf: boolean; kadenz?: KadenzKontext },
): string | null {
  if (!WIEDERHOLUNG_OUTCOMES.has(o.outcome)) return null
  const max = o.kadenz?.maxVersuche ?? 5
  if (o.ausRueckruf) {
    const neu = lead.tasks
      .filter((t) => t.kind === 'rueckruf' && t.status === 'offen' && t.id !== o.alterTaskId)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]
    if (neu) {
      const n = wiederholungAusTitel(neu.title)
      return `Nächster Rückruf ${fmtDatumKurz(neu.due_at)} ${fmtZeit(neu.due_at)}${n ? ` (Wiederholung ${n})` : ''}`
    }
  }
  const en = lead.enrollments.find((e) => e.channel === 'telefon' && e.status === 'aktiv' && !!e.next_due_at)
  if (en?.next_due_at && en.current_position) {
    const pos = en.current_position
    const slot = slotFuerVersuch(pos)
    const tag = fmtDatumKurz(en.next_due_at)
    const slotTeil = `Slot ${slot} ${slotText(slot, o.kadenz?.slots)}`
    return o.ausRueckruf
      ? `Telefon-Standard ab Versuch ${pos} von ${max} · ${tag} · ${slotTeil}`
      : `Nächster Versuch ${tag} · Versuch ${pos} von ${max} · ${slotTeil}`
  }
  if (lead.stage === 'langfristig' && lead.next_action_at)
    return `Nach Versuch ${max} nicht erreichbar · Wiedervorlage ${fmtDatumKurz(lead.next_action_at)}`
  return null
}
