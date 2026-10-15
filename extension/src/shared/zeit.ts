// Fälligkeit als Zeitzustand (DESIGN-SYSTEM § 3.2): heute = Lime, überfällig = Amber mit „−n T“, später = ink-3.
import { fmtDatum, fmtDatumKurz, MINUS } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'

export type ZeitTon = 'heute' | 'ueberfaellig' | 'spaeter'
export type ZeitChip = { ton: ZeitTon; text: string; titel: string }

export function faelligChip(iso: string | null | undefined, jetzt: Date = new Date()): ZeitChip | null {
  if (!iso) return null
  const heute = berlinTag(jetzt)
  const tag = berlinTag(iso)
  const diff = tageDifferenz(heute, tag)
  const titel = `fällig am ${fmtDatum(iso)}`
  if (diff === 0) return { ton: 'heute', text: 'heute', titel }
  if (diff < 0) return { ton: 'ueberfaellig', text: `${MINUS}${Math.abs(diff)} T`, titel }
  if (diff === 1) return { ton: 'spaeter', text: 'morgen', titel }
  if (diff <= 6) return { ton: 'spaeter', text: `in ${diff} T`, titel }
  return { ton: 'spaeter', text: fmtDatumKurz(iso), titel }
}

export { fmtDatum, fmtDatumKurz }

const zeitFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** „15.10. 09:30“ (Berlin) */
export function fmtZeit(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '–' : zeitFormat.format(d).replace(',', '')
}

/** „vor 4 Min.“ / „vor 3 Std.“ / „am 15.10. 09:30“ – z. B. wann das Apps Script zuletzt gemeldet hat. */
export function seit(iso: string | null, jetzt: Date = new Date()): string {
  if (!iso) return 'noch nie'
  const min = Math.round((jetzt.getTime() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  if (min < 48 * 60) return `vor ${Math.round(min / 60)} Std.`
  return `am ${fmtZeit(iso)}`
}
