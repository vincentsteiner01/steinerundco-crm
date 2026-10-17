// BAUPLAN § 3.1.9 `telefon.ts` – libphonenumber-js mit Standard-Land DE (ux § 4.9: Eingabe beliebig, gespeichert E.164).
// 17.10.2026 (Feedback ebfc59a0): Land wählbar – „0…“ wurde immer zu +49, auch bei Nummern aus Österreich oder der Schweiz.
// Feedback 9f9301ea: weitere Nummern je Lead (leads.phone_numbers, Migration 10).
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { Json } from '@/types/database'

export type Land = CountryCode
export const STANDARD_LAND: Land = 'DE'

/** Auswahl im Formular: DACH zuerst, dann Nachbarn und häufige Länder. */
export const LAENDER: readonly { land: Land; name: string }[] = [
  { land: 'DE', name: 'Deutschland' },
  { land: 'AT', name: 'Österreich' },
  { land: 'CH', name: 'Schweiz' },
  { land: 'NL', name: 'Niederlande' },
  { land: 'BE', name: 'Belgien' },
  { land: 'LU', name: 'Luxemburg' },
  { land: 'DK', name: 'Dänemark' },
  { land: 'PL', name: 'Polen' },
  { land: 'CZ', name: 'Tschechien' },
  { land: 'FR', name: 'Frankreich' },
  { land: 'IT', name: 'Italien' },
  { land: 'ES', name: 'Spanien' },
  { land: 'PT', name: 'Portugal' },
  { land: 'GB', name: 'Vereinigtes Königreich' },
  { land: 'IE', name: 'Irland' },
  { land: 'SE', name: 'Schweden' },
  { land: 'NO', name: 'Norwegen' },
  { land: 'FI', name: 'Finnland' },
  { land: 'US', name: 'USA' },
]

/** „DE +49“ – kurz genug für ein Select neben dem Nummernfeld. */
export const landLabel = (land: Land): string => `${land} +${getCountryCallingCode(land)}`

/** Beliebige Eingabe → E.164 (`+4940123456`) oder `null`. `land` gilt für Nummern ohne Ländervorwahl („0…“). */
export function nachE164(eingabe: string | null | undefined, land: Land = STANDARD_LAND): string | null {
  if (!eingabe) return null
  const s = eingabe.trim()
  if (!s) return null
  const p = parsePhoneNumberFromString(s, land)
  if (!p || !p.isValid()) return null
  return p.number
}

/** Land einer gespeicherten Nummer (für die Vorauswahl beim Bearbeiten); unbekannt → null. */
export function landVon(e164: string | null | undefined): Land | null {
  if (!e164) return null
  return parsePhoneNumberFromString(e164)?.country ?? null
}

// ── Weitere Nummern (leads.phone_numbers) ─────────────────────────────────────────────────────────

export type NummerTyp = 'zentrale' | 'durchwahl' | 'mobil' | 'sonstige'
export type WeitereNummer = { e164: string; typ: NummerTyp }

export const NUMMER_TYP_LABEL: Record<NummerTyp, string> = {
  zentrale: 'Zentrale',
  durchwahl: 'Durchwahl',
  mobil: 'Mobil',
  sonstige: 'Sonstige',
}

const istTyp = (t: unknown): t is NummerTyp =>
  t === 'zentrale' || t === 'durchwahl' || t === 'mobil' || t === 'sonstige'

/** Robust lesen: alles, was keine gültige Nummer mit Typ ist, fällt weg. */
export function weitereNummern(roh: Json | null | undefined): WeitereNummer[] {
  if (!Array.isArray(roh)) return []
  const out: WeitereNummer[] = []
  for (const x of roh) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue
    const e164 = typeof x['e164'] === 'string' ? x['e164'] : null
    if (!e164) continue
    out.push({ e164, typ: istTyp(x['typ']) ? x['typ'] : 'sonstige' })
  }
  return out
}

/** Hauptnummer-Typ des Schemas → Typ der Liste (`unbekannt` → sonstige). */
export const alsNummerTyp = (t: string | null | undefined): NummerTyp => (istTyp(t) ? t : 'sonstige')

/** Gültige, vollständige Nummer (für „Anrufen“ und Speichern als `phone_e164`). */
export function istGueltig(e164: string | null | undefined): boolean {
  if (!e164) return false
  const p = parsePhoneNumberFromString(e164, STANDARD_LAND)
  return !!p && p.isValid()
}

/**
 * Nummerntyp → `phone_type` des Schemas (`mobil` / `unbekannt`). Die `min`-Metadaten von libphonenumber kennen keine
 * Typen (bewusst, Bundle-Budget E22); deutsche Mobilfunk-Vorwahlen 015x/016x/017x werden direkt erkannt.
 */
export function telefonTyp(e164: string | null | undefined): 'mobil' | 'unbekannt' {
  if (!e164) return 'unbekannt'
  const p = parsePhoneNumberFromString(e164, 'DE')
  if (!p) return 'unbekannt'
  if (p.getType() === 'MOBILE') return 'mobil'
  if (p.countryCallingCode === '49' && /^1[5-7]/.test(p.nationalNumber)) return 'mobil'
  return 'unbekannt'
}

/** `tel:`-Link (ohne Leerzeichen). */
export function telHref(e164: string): string {
  return `tel:${e164.replace(/[^0-9+]/g, '')}`
}

/** `+4940123456` → `+49 40 123456` (international mit Leerzeichen, ux § 4.9). Unparsbar → Eingabe unverändert. */
export function fmtTelefon(e164: string | null | undefined): string {
  if (!e164) return ''
  const p = parsePhoneNumberFromString(e164, 'DE')
  return p ? p.formatInternational() : e164
}
