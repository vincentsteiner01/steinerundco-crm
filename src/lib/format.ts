// BAUPLAN § 3.1.9 `format.ts` – alles über Intl mit timeZone Europe/Berlin (ux § 6.4). Minus ist `−` (U+2212),
// Prozent mit schmalem geschütztem Leerzeichen (U+202F), Einheiten mit geschütztem Leerzeichen (U+00A0).
import { alsDate, berlinTag, berlinTeile, isodow, kalenderwoche, tageDifferenz, type Tag } from './zeit'

export const MINUS = '−'
const SCHMAL = ' '
const NBSP = ' '

const WOCHENTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const
const MONAT_LANG = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Wochentag 0 = So … 6 = Sa am Berliner Kalendertag. */
function berlinWochentag(d: Date): number {
  return isodow(berlinTag(d)) % 7
}

/** `14.10.2026` */
export function fmtDatum(d: Date | string): string {
  const t = berlinTeile(alsDate(d))
  return `${pad(t.tag)}.${pad(t.monat)}.${t.jahr}`
}

/** `Mi 14.10.` */
export function fmtDatumKurz(d: Date | string): string {
  const date = alsDate(d)
  const t = berlinTeile(date)
  return `${WOCHENTAG_KURZ[berlinWochentag(date)]} ${pad(t.tag)}.${pad(t.monat)}.`
}

/** `16.10.2026, 10:00` */
export function fmtDatumZeit(d: Date | string): string {
  return `${fmtDatum(d)}, ${fmtZeit(d)}`
}

/** `09:41` */
export function fmtZeit(d: Date | string): string {
  const t = berlinTeile(alsDate(d))
  return `${pad(t.stunde)}:${pad(t.minute)}`
}

/** `03:52`, ab einer Stunde `1:02:11`. */
export function fmtDauer(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`
}

const zahlFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/** `1.248` (Tausenderpunkt, ganzzahlig). */
export function fmtZahl(n: number): string {
  return zahlFormat.format(n).replace('-', MINUS)
}

/** Anteil 0…1 → `30 %` (ganzzahlig, U+202F). `fmtProzent(0.3)`; Werte > 1 werden als Prozentzahl gelesen. */
export function fmtProzent(x: number): string {
  if (!Number.isFinite(x)) return `–${SCHMAL}%`
  const p = Math.abs(x) <= 1 ? x * 100 : x
  return `${fmtZahl(Math.round(p))}${SCHMAL}%`
}

/**
 * Verhältnis → Prozent, IMMER ×100 (`fmtAnteil(1.25)` → `125 %`). Runde 3 (Wunsch leads-pipeline Nr. 4): `fmtProzent` liest Werte
 * über 1 als fertige Prozentzahl – eine Quote über 100 % (z. B. Annahmen ÷ Anfragen der letzten 7 Tage, die Annahmen stammen von
 * älteren Anfragen) wurde dort zu „1 %“. Für Quoten, die über 1 gehen können, diese Funktion nehmen.
 */
export function fmtAnteil(anteil: number): string {
  if (!Number.isFinite(anteil)) return `–${SCHMAL}%`
  return `${fmtZahl(Math.round(anteil * 100))}${SCHMAL}%`
}

/** `+17` / `−2` / `±0` – Vorzeichen immer, Minus als U+2212. */
export function fmtDelta(n: number): string {
  const r = Math.round(n)
  if (r === 0) return '±0'
  return r > 0 ? `+${fmtZahl(r)}` : `${MINUS}${fmtZahl(Math.abs(r))}`
}

/** `+3 pp` (Prozentpunkte, geschütztes Leerzeichen). */
export function fmtPp(n: number): string {
  return `${fmtDelta(n)}${NBSP}pp`
}

/**
 * `heute` · `morgen` · `gestern` · `−2 T` · `in 3 T`, ab 7 Tagen Abstand `fmtDatumKurz`.
 * Vergleicht Berliner Kalendertage; `heute` ist nur für Tests übergebbar.
 */
export function relativ(d: Date | string, heute: Date | string = new Date()): string {
  const ziel: Tag = berlinTag(d)
  const jetzt: Tag = berlinTag(heute)
  const diff = tageDifferenz(jetzt, ziel)
  if (diff === 0) return 'heute'
  if (diff === 1) return 'morgen'
  if (diff === -1) return 'gestern'
  if (Math.abs(diff) >= 7) return fmtDatumKurz(d)
  return diff < 0 ? `${MINUS}${Math.abs(diff)}${NBSP}T` : `in ${diff}${NBSP}T`
}

/** `Mittwoch, 14. Oktober 2026 · KW 42` (ohne Argument: jetzt) */
export function dateline(d: Date | string = new Date()): string {
  const date = alsDate(d)
  const t = berlinTeile(date)
  const kw = kalenderwoche(berlinTag(date))
  return `${WOCHENTAG_LANG[berlinWochentag(date)]}, ${t.tag}. ${MONAT_LANG[t.monat - 1]} ${t.jahr} · KW ${kw}`
}

/** Kurze Dateline fürs Telefon (< 768 px): `Do 15.10. · KW 42` – die lange passt nicht in 358 px (Runde 2). */
export function datelineKurz(d: Date | string = new Date()): string {
  const date = alsDate(d)
  return `${fmtDatumKurz(date)} · KW ${kalenderwoche(berlinTag(date))}`
}

/** Heutiger Berliner Kalendertag `YYYY-MM-DD`. */
export function heuteBerlin(jetzt: Date = new Date()): Tag {
  return berlinTag(jetzt)
}

/** `'2026-10'` → `Oktober 2026` */
export function monatLabel(monat: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(monat)
  if (!m) return monat
  const name = MONAT_LANG[Number(m[2]) - 1]
  return name ? `${name} ${m[1]}` : monat
}

// `fmtTelefon` liegt in `lib/telefon.ts`: libphonenumber-js (≈ 30 kB gzip) soll nicht über `format.ts` ins initiale Bundle
// (Shell/Dateline) – Konflikt § 3.1.9 (Exportliste) ↔ E22 (Budget), entschieden für E22.

/** `12.10.–18.10.` (Zeitraum, Halbgeviertstrich ohne Leerzeichen). */
export function fmtZeitraum(von: Date | string, bis: Date | string): string {
  const a = berlinTeile(alsDate(von))
  const b = berlinTeile(alsDate(bis))
  return `${pad(a.tag)}.${pad(a.monat)}.–${pad(b.tag)}.${pad(b.monat)}.`
}

/** `12 / 30` (Verhältnis mit Leerzeichen). */
export function fmtVerhaeltnis(n: number, m: number): string {
  return `${fmtZahl(n)} / ${fmtZahl(m)}`
}
