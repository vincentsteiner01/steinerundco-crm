// BAUPLAN § 3.1.9 `werktage.ts` / § 5.2 – spiegelt crm.roll_to_weekday exakt:
//   while (isodow(d) >= 6 or d ∈ feiertage) and i < 10 → d + 1
// Alle Funktionen rechnen auf Berliner Kalendertagen (`YYYY-MM-DD`); ein Date wird zuerst zum Berliner Tag.
import { berlinTag, isodow, tagPlus, type Tag } from './zeit'

/**
 * Gesetzliche Feiertage Hamburg 2026–2028 als Fallback (§ 5.2). Primärquelle ist `settings.feiertage` (M8 pflegt);
 * der Seed (Migration 2) enthält davon die Einträge ab 2026-10-03 bis 2027-12-26 – diese Liste ist die Obermenge.
 */
export const FEIERTAGE_HH: readonly Tag[] = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-06',
  '2026-05-01',
  '2026-05-14',
  '2026-05-25',
  '2026-10-03',
  '2026-10-31',
  '2026-12-25',
  '2026-12-26',
  '2027-01-01',
  '2027-03-26',
  '2027-03-29',
  '2027-05-01',
  '2027-05-06',
  '2027-05-17',
  '2027-10-03',
  '2027-10-31',
  '2027-12-25',
  '2027-12-26',
  '2028-01-01',
  '2028-04-14',
  '2028-04-17',
  '2028-05-01',
  '2028-05-25',
  '2028-06-05',
  '2028-10-03',
  '2028-10-31',
  '2028-12-25',
  '2028-12-26',
]

const MAX_SCHRITTE = 10

const alsTag = (d: Date | Tag): Tag => berlinTag(d)
const istFeiertag = (tag: Tag, feiertage: readonly Tag[]) => feiertage.includes(tag)

/** Mo–Fr und kein Feiertag. */
export function istWerktag(d: Date | Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): boolean {
  const tag = alsTag(d)
  return isodow(tag) < 6 && !istFeiertag(tag, feiertage)
}

/**
 * Sa/So/Feiertag → nächster Werktag, sonst der Tag selbst. Wie `crm.roll_to_weekday`: höchstens 10 Schritte,
 * danach wird der erreichte Tag zurückgegeben, auch wenn er kein Werktag ist.
 */
export function rollToWeekday(d: Date | Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): Tag {
  let tag = alsTag(d)
  let i = 0
  while ((isodow(tag) >= 6 || istFeiertag(tag, feiertage)) && i < MAX_SCHRITTE) {
    tag = tagPlus(tag, 1)
    i++
  }
  return tag
}

/** Erster Werktag strikt nach `d`. */
export function naechsterWerktag(d: Date | Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): Tag {
  return rollToWeekday(tagPlus(alsTag(d), 1), feiertage)
}

/**
 * `n` Werktage abzählen (für Kennzahlen wie `antwortzeit_werktage`, nicht für Sequenz-Delays – die sind
 * Kalendertage + Rollen, § 1.5 Nr. 37). n = 0 → `rollToWeekday(d)`; negatives n zählt rückwärts.
 */
export function addWerktage(d: Date | Tag, n: number, feiertage: readonly Tag[] = FEIERTAGE_HH): Tag {
  let tag = alsTag(d)
  if (n === 0) return rollToWeekday(tag, feiertage)
  const schritt = n > 0 ? 1 : -1
  let rest = Math.abs(Math.trunc(n))
  while (rest > 0) {
    tag = tagPlus(tag, schritt)
    if (istWerktag(tag, feiertage)) rest--
  }
  return tag
}

/** `crm.next_due` ohne Uhrzeit: Kalendertag `von` + `delay` Tage, danach gerollt (wenn `weekdaysOnly`). */
export function naechsterFaelligTag(
  von: Date | Tag,
  delayTage: number,
  weekdaysOnly = true,
  feiertage: readonly Tag[] = FEIERTAGE_HH,
): Tag {
  const ziel = tagPlus(alsTag(von), delayTage)
  return weekdaysOnly ? rollToWeekday(ziel, feiertage) : ziel
}

/** Werktage zwischen zwei Tagen (exklusiv `von`, inklusiv `bis`); negativ, wenn `bis` vor `von` liegt. */
export function werktageZwischen(von: Date | Tag, bis: Date | Tag, feiertage: readonly Tag[] = FEIERTAGE_HH): number {
  const a = alsTag(von)
  const b = alsTag(bis)
  const richtung = a <= b ? 1 : -1
  let tag = a
  let n = 0
  while (tag !== b) {
    tag = tagPlus(tag, richtung)
    if (istWerktag(tag, feiertage)) n += richtung
  }
  return n
}
