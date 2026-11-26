// Reiter „Ziele“: was die Formulare und die Adresse lesen und schreiben – Zahlen in deutscher Schreibweise, der Monat in
// der URL, die Monatsliste für „Beginnt im“ und die Auswahl „Wie wird gezählt?“. Reine Funktionen.
import { monatLabel } from '@/lib/format'
import { monatePlus, type Tag } from '@/lib/zeit'
import { monatsErster, QUELLE_LABEL, type OkrErgebnis, type Quelle } from './rechnen'

/**
 * Zahl aus einem Eingabefeld: „3000“, „3.000“, „2,5“, „1.234,5“ (auch mit Leerzeichen oder „€“ dahinter).
 * Ein Punkt ohne Komma ist ein Tausenderpunkt, wenn danach genau drei Ziffern stehen – sonst ein Dezimalpunkt („2.5“).
 * `null`, wenn es keine Zahl ist.
 */
export function parseZahl(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(/€$/, '')
  if (!t) return null
  const norm = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, '')
      : t
  if (!/^\d+(\.\d+)?$/.test(norm)) return null
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

const feldZahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** Zahl fürs Eingabefeld: „3.000“, „2,5“. */
export const zahlFuerFeld = (n: number): string => feldZahl.format(n)

/** `?monat=2026-12` → `2026-12-01`; alles andere `null`. */
export function monatAusParam(p: string | null): Tag | null {
  return p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? `${p}-01` : null
}

/** `2026-12-01` → `2026-12` */
export const monatParam = (monat: Tag): string => monat.slice(0, 7)

export type MonatsOption = { value: Tag; label: string }

/** Monate für „Beginnt im“: 12 zurück bis 18 voraus; `dazu` (gezeigter Monat, Beginn des bearbeiteten Ziels) ist immer dabei. */
export function monatsOptionen(heute: Tag, dazu: readonly Tag[] = []): MonatsOption[] {
  const jetzt = monatsErster(heute)
  const monate = new Set<Tag>(dazu.map(monatsErster))
  for (let i = -12; i <= 18; i++) monate.add(monatePlus(jetzt, i))
  return [...monate].sort().map((m) => ({ value: m, label: monatLabel(m) }))
}

/** Sonderfall in „Wie wird gezählt?“: Neukunden × Wert je Kunde (speichert `im_geschaeft` mit Faktor und „€“). */
export const UMSATZ = 'umsatz'
export type Zaehlart = Quelle | typeof UMSATZ

/** Reihenfolge der Auswahl: erst alles, was von selbst zählt – „von Hand“ zuletzt. */
export const ZAEHLARTEN: readonly { value: Zaehlart; label: string }[] = [
  { value: 'angeschrieben', label: QUELLE_LABEL.angeschrieben },
  { value: 'vernetzungen_versendet', label: QUELLE_LABEL.vernetzungen_versendet },
  { value: 'vernetzungen_angenommen', label: QUELLE_LABEL.vernetzungen_angenommen },
  { value: 'gespraech', label: QUELLE_LABEL.gespraech },
  { value: 'im_geschaeft', label: QUELLE_LABEL.im_geschaeft },
  { value: UMSATZ, label: 'Umsatz aus Neukunden' },
  { value: 'emails_gesendet', label: QUELLE_LABEL.emails_gesendet },
  { value: 'email_antworten', label: QUELLE_LABEL.email_antworten },
  { value: 'manuell', label: QUELLE_LABEL.manuell },
]

export const istZaehlart = (s: string): s is Zaehlart => ZAEHLARTEN.some((z) => z.value === s)

/** „Umsatz aus Neukunden“ erkennt man an Neukunden mit einem Faktor ungleich 1. */
export function zaehlartVon(e: Pick<OkrErgebnis, 'quelle' | 'faktor'>): Zaehlart {
  return e.quelle === 'im_geschaeft' && e.faktor !== 1 ? UMSATZ : e.quelle
}

/** Was eine Zählart speichert: Quelle, Faktor und Einheit. */
export function zaehlartFelder(art: Zaehlart, wertJeKunde: number): Pick<OkrErgebnis, 'quelle' | 'faktor' | 'einheit'> {
  if (art === UMSATZ) return { quelle: 'im_geschaeft', faktor: wertJeKunde, einheit: '€' }
  return { quelle: art, faktor: 1, einheit: null }
}
