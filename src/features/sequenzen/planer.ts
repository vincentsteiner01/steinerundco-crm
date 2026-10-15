// BAUPLAN § 3.2 / § 5.2 – Client-Vorschau der Sequenz-Engine, rechnet identisch zur DB (`crm.next_due`):
// Delay = Kalendertage ab dem tatsächlich erledigten Schritt, danach auf den nächsten Werktag gerollt (§ 1.5 Nr. 37).
// Reine Funktionen, keine Hooks. Feiertage kommen aus settings.feiertage (Fallback lib/werktage FEIERTAGE_HH).
import { FEIERTAGE_HH, rollToWeekday } from '@/lib/werktage'
import { berlinTag, monatePlus, naechsterWochentag, tagPlus, tagZuDate, type Tag } from '@/lib/zeit'
import type { SequenceStep } from '@/types/domain'

export type SnoozeOption = '1' | '2' | '3' | '4' | '5'

/** `crm.next_due` ohne Uhrzeit: Berliner Tag von `doneAt` + `delayDays`, danach gerollt (wenn `weekdaysOnly`). */
export function naechsteFaelligkeit(
  doneAt: Date | Tag,
  delayDays: number,
  weekdaysOnly = true,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): Tag {
  const ziel = tagPlus(berlinTag(doneAt), delayDays)
  return weekdaysOnly ? rollToWeekday(ziel, feiertage) : ziel
}

/** Wie `naechsteFaelligkeit`, als Zeitpunkt `due_on` (Standard 09:00 Europe/Berlin, settings.queue.due_time). */
export function naechsteFaelligkeitZeit(
  doneAt: Date | Tag,
  delayDays: number,
  weekdaysOnly = true,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
  dueTime = '09:00',
): Date {
  return tagZuDate(naechsteFaelligkeit(doneAt, delayDays, weekdaysOnly, feiertage), dueTime)
}

export type VorschauZeile = { step: SequenceStep; faelligAm: Tag }

/**
 * Termine je Schritt für einen Beispielstart: Schritt 1 = Start + Delay 1 (gerollt), jeder weitere Schritt rechnet vom
 * geplanten Vortermin weiter (so wie die DB vom tatsächlich erledigten Schritt rechnet). Für die Vorschau-Spalte im Editor.
 */
export function vorschau(
  sequenz: { steps: readonly SequenceStep[]; weekdays_only?: boolean | null },
  startAt: Date | Tag,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): VorschauZeile[] {
  const weekdaysOnly = sequenz.weekdays_only ?? true
  const steps = [...sequenz.steps].sort((a, b) => a.position - b.position)
  let von: Tag = berlinTag(startAt)
  const out: VorschauZeile[] = []
  for (const step of steps) {
    const faelligAm = naechsteFaelligkeit(von, step.delay_days, weekdaysOnly, feiertage)
    out.push({ step, faelligAm })
    von = faelligAm
  }
  return out
}

/**
 * Snooze-Ziele (ux § 5.3, BAUPLAN § 5.2): `1` morgen · `2` +3 T · `3` nächster Montag · `4` +1 W · `5` +2 Mo (Wiedervorlage).
 * Alle Ziele werden auf den nächsten Werktag gerollt – so wie `snooze_step` es serverseitig tut.
 */
export function snoozeZiel(option: SnoozeOption, heute: Date | Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): Tag {
  const h = berlinTag(heute)
  const roll = (t: Tag) => rollToWeekday(t, feiertage)
  switch (option) {
    case '1':
      return roll(tagPlus(h, 1))
    case '2':
      return roll(tagPlus(h, 3))
    case '3':
      return roll(naechsterWochentag(h, 1))
    case '4':
      return roll(tagPlus(h, 7))
    case '5':
      return roll(monatePlus(h, 2))
  }
}

/** `D` Datum: freies Ziel, gerollt. */
export function snoozeZielDatum(tag: Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): Tag {
  return rollToWeekday(tag, feiertage)
}

/** Schritt n von m der Sequenz, `null` ohne Schritt. */
export function schrittPosition(
  steps: readonly SequenceStep[],
  stepId: string | null | undefined,
): { position: number; gesamt: number; step: SequenceStep } | null {
  const step = steps.find((s) => s.id === stepId)
  if (!step) return null
  return { position: step.position, gesamt: steps.length, step }
}
