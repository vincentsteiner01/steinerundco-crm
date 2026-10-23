// Umsatz-Rechnung wie in Mikes Sales Hub (23.10.2026): wiederkehrende Beträge werden auf Monate umgelegt (vierteljährlich /3 …),
// der einmalige Betrag fällt im Startmonat an, nach der Laufzeit endet der Plan. Ohne Laufzeit (unbefristet) ist das feste
// Auftragsvolumen nur der einmalige Betrag („+ laufend“). Erhalten = erfasste Zahlungen.
import type { Contract, ContractFrequency, Payment } from '@/types/domain'

export type Auftrag = Pick<
  Contract,
  'id' | 'customer' | 'start_date' | 'setup_amount' | 'recurring_amount' | 'frequency' | 'term_months'
>
export type Zahlung = Pick<Payment, 'id' | 'contract_id' | 'paid_on' | 'amount'>

export const RHYTHMUS: readonly { key: ContractFrequency; label: string; monate: number }[] = [
  { key: 'monatlich', label: 'Monatlich', monate: 1 },
  { key: 'vierteljaehrlich', label: 'Vierteljährlich', monate: 3 },
  { key: 'halbjaehrlich', label: 'Halbjährlich', monate: 6 },
  { key: 'jaehrlich', label: 'Jährlich', monate: 12 },
]

export const rhythmusLabel = (f: string): string => RHYTHMUS.find((r) => r.key === f)?.label ?? 'Monatlich'
const rhythmusMonate = (f: string): number => RHYTHMUS.find((r) => r.key === f)?.monate ?? 1

/** Postgres `numeric` kommt als Zahl oder Text – immer als Zahl rechnen. */
export const betrag = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Wiederkehrender Betrag je Monat. */
export function proMonat(a: Pick<Auftrag, 'recurring_amount' | 'frequency'>): number {
  return betrag(a.recurring_amount) / rhythmusMonate(a.frequency)
}

/** Auftragsvolumen: einmalig + monatlich × Laufzeit; ohne Laufzeit nur einmalig. */
export function volumen(a: Pick<Auftrag, 'setup_amount' | 'recurring_amount' | 'frequency' | 'term_months'>): number {
  return betrag(a.setup_amount) + (a.term_months ? proMonat(a) * a.term_months : 0)
}

export const unbefristetLaufend = (a: Pick<Auftrag, 'term_months' | 'recurring_amount'>): boolean =>
  !a.term_months && betrag(a.recurring_amount) > 0

/** Monate zwischen Startmonat und Monat `ym` (YYYY-MM). */
function monatsIndex(start: string, ym: string): number {
  const [sj, sm] = start.split('-').map(Number) as [number, number]
  const [j, m] = ym.split('-').map(Number) as [number, number]
  return (j - sj) * 12 + (m - sm)
}

/** Geplanter Umsatz eines Auftrags im Monat `ym`. */
export function geplantImMonat(a: Auftrag, ym: string): number {
  const i = monatsIndex(a.start_date, ym)
  if (i < 0) return 0
  const laufend = a.term_months && i >= a.term_months ? 0 : proMonat(a)
  return laufend + (i === 0 ? betrag(a.setup_amount) : 0)
}

export const monatVon = (tag: string): string => tag.slice(0, 7)

/** Die letzten 12 Monate bis `heute` (YYYY-MM), ältester zuerst. */
export function letzte12Monate(heute: string): string[] {
  const [j, m] = heute.split('-').map(Number) as [number, number]
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(j, m - 1 - 11 + i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

export type MonatsWert = { monat: string; erhalten: number; geplant: number }

export function monatsreihe(auftraege: readonly Auftrag[], zahlungen: readonly Zahlung[], heute: string): MonatsWert[] {
  return letzte12Monate(heute).map((monat) => ({
    monat,
    erhalten: zahlungen.filter((z) => monatVon(z.paid_on) === monat).reduce((s, z) => s + betrag(z.amount), 0),
    geplant: auftraege.reduce((s, a) => s + geplantImMonat(a, monat), 0),
  }))
}

export type UmsatzKennzahlen = { monat: number; jahr: number; gesamt: number; volumen: number }

export function kennzahlen(
  auftraege: readonly Auftrag[],
  zahlungen: readonly Zahlung[],
  heute: string,
): UmsatzKennzahlen {
  const summe = (f: (z: Zahlung) => boolean) => zahlungen.filter(f).reduce((s, z) => s + betrag(z.amount), 0)
  return {
    monat: summe((z) => monatVon(z.paid_on) === monatVon(heute)),
    jahr: summe((z) => z.paid_on.slice(0, 4) === heute.slice(0, 4)),
    gesamt: summe(() => true),
    volumen: auftraege.reduce((s, a) => s + volumen(a), 0),
  }
}

export function erhaltenJeAuftrag(zahlungen: readonly Zahlung[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const z of zahlungen) m.set(z.contract_id, (m.get(z.contract_id) ?? 0) + betrag(z.amount))
  return m
}

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const EUR_GENAU = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

/** „17.500 €“ – Cent nur, wenn vorhanden („1.234,50 €“). */
export function fmtEuro(n: number): string {
  return Number.isInteger(Math.round(n * 100) / 100) ? EUR.format(n) : EUR_GENAU.format(n)
}

/** Eingabe „1.500“, „1500,50“, „1 500 €“ → Zahl; leer → 0; ungültig → null. */
export function parseEuro(eingabe: string): number | null {
  const t = eingabe.replace(/[€\s]/g, '').trim()
  if (!t) return 0
  // deutsches Format: Punkte = Tausender, Komma = Dezimal
  const norm = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, '')
      : t
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
