// BAUPLAN § 3.1.9 `datumEingabe.ts` / ux § 4.9 – Datumseingabe mit Kurzformen, Vorschau rechts im Feld.
// Akzeptiert: `14.10.` · `14.10.2026` · `14.10.26` · `+3` (Kalendertage) · `+1w` · `+2m` · `mo`…`so` (nächster)
// · `heute` · `morgen` · `übermorgen`. Ergebnis ist der Kalendertag (09:00 Berlin als Date, § 5.2 `due_on`);
// gerollt wird nicht – das macht die DB bzw. `werktage.rollToWeekday`.
import { berlinTag, isodow, istTag, monatePlus, tagPlus, tagZuDate, type Tag } from './zeit'

const WOCHENTAGE: Record<string, number> = {
  mo: 1,
  montag: 1,
  di: 2,
  dienstag: 2,
  mi: 3,
  mittwoch: 3,
  do: 4,
  donnerstag: 4,
  fr: 5,
  freitag: 5,
  sa: 6,
  samstag: 6,
  so: 7,
  sonntag: 7,
}

const pad = (n: number) => String(n).padStart(2, '0')

function gueltigerTag(j: number, m: number, t: number): Tag | null {
  if (m < 1 || m > 12 || t < 1 || t > 31) return null
  const d = new Date(Date.UTC(j, m - 1, t))
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return null
  return `${j}-${pad(m)}-${pad(t)}`
}

/** Wie `parseDatumEingabe`, liefert aber den Kalendertag `YYYY-MM-DD`. */
export function parseDatumEingabeTag(text: string, heute: Date | Tag = new Date()): Tag | null {
  const h = berlinTag(heute)
  const s = text.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  if (s === 'heute' || s === 'h') return h
  if (s === 'morgen' || s === 'm') return tagPlus(h, 1)
  if (s === 'übermorgen' || s === 'uebermorgen' || s === 'üm') return tagPlus(h, 2)
  if (s === 'gestern') return tagPlus(h, -1)

  // +3 · +1w · +2m · +1j (auch ohne Plus: „3“, „1w“)
  const rel = /^\+?(\d{1,3})(d|t|w|m|j|y)?$/.exec(s)
  if (rel) {
    const n = Number(rel[1])
    const einheit = rel[2] ?? 't'
    if (einheit === 'w') return tagPlus(h, n * 7)
    if (einheit === 'm') return monatePlus(h, n)
    if (einheit === 'j' || einheit === 'y') return monatePlus(h, n * 12)
    return tagPlus(h, n)
  }

  // Wochentag → nächster (strikt nach heute)
  const wt = WOCHENTAGE[s]
  if (wt !== undefined) {
    const delta = (wt - isodow(h) + 7) % 7 || 7
    return tagPlus(h, delta)
  }

  // 14.10. · 14.10.2026 · 14.10.26 · 14.10
  const dmy = /^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(s)
  if (dmy) {
    const t = Number(dmy[1])
    const m = Number(dmy[2])
    const jahrHeute = Number(h.slice(0, 4))
    if (dmy[3]) {
      const j = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])
      return gueltigerTag(j, m, t)
    }
    // Ohne Jahr: dieses Jahr; liegt der Tag vor heute → nächstes Jahr
    const dieses = gueltigerTag(jahrHeute, m, t)
    if (dieses && dieses >= h) return dieses
    return gueltigerTag(jahrHeute + 1, m, t) ?? dieses
  }

  // ISO `2026-10-14`
  if (istTag(s)) return s

  return null
}

/** ux § 4.9 – `Date | null` (09:00 Europe/Berlin am Zieltag). */
export function parseDatumEingabe(text: string, heute: Date | Tag = new Date()): Date | null {
  const tag = parseDatumEingabeTag(text, heute)
  return tag ? tagZuDate(tag, '09:00') : null
}
