// BAUPLAN § 3.1.9 `telefon.ts` – libphonenumber-js mit Standard-Land DE (ux § 4.9: Eingabe beliebig, gespeichert E.164).
import { parsePhoneNumberFromString } from 'libphonenumber-js'

/** Beliebige Eingabe → E.164 (`+4940123456`) oder `null`, wenn keine gültige Nummer erkennbar ist. */
export function nachE164(eingabe: string | null | undefined): string | null {
  if (!eingabe) return null
  const s = eingabe.trim()
  if (!s) return null
  const p = parsePhoneNumberFromString(s, 'DE')
  if (!p || !p.isValid()) return null
  return p.number
}

/** Gültige, vollständige Nummer (für „Anrufen“ und Speichern als `phone_e164`). */
export function istGueltig(e164: string | null | undefined): boolean {
  if (!e164) return false
  const p = parsePhoneNumberFromString(e164, 'DE')
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
