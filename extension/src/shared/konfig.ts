// Feste Werte der Erweiterung. URL und Publishable Key kommen beim Build aus ../.env.production (öffentlich; RLS schützt).

export const SUPABASE_URL: string = String(import.meta.env.VITE_SUPABASE_URL ?? '')
export const SUPABASE_KEY: string = String(import.meta.env.VITE_SUPABASE_KEY ?? '')

export const CRM_LIVE = 'https://crm.steinerundco.de'
export const CRM_LOKAL = 'http://localhost:8768'

/** Schlüssel in chrome.storage.local (nur Komfort; keine Lead-Daten). */
export const SPEICHER = {
  crmBasis: 'crm.basis',
  bleiben: 'crm.bleiben',
  person: 'crm.person',
  anfrageVorwahl: 'crm.anfrageGesendet',
} as const

/** Akzeptierte CRM-Adresse: https://… oder http://localhost / 127.0.0.1 (Entwicklung). Ohne Pfad, ohne Slash am Ende. */
export function pruefeCrmBasis(roh: string | null | undefined): string | null {
  const s = (roh ?? '').trim()
  if (!s) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  const lokal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && lokal)) return null
  if (u.username || u.password) return null
  return `${u.protocol}//${u.host}`
}

/** Pfad im CRM, z. B. `/leads/<id>` oder `/heute`. */
export function crmLink(basis: string | null | undefined, pfad: string): string {
  const b = pruefeCrmBasis(basis) ?? CRM_LIVE
  return `${b}${pfad.startsWith('/') ? pfad : `/${pfad}`}`
}

export const PFAD = {
  heute: '/heute',
  lead: (id: string) => `/leads/${encodeURIComponent(id)}`,
} as const

/** LinkedIn-Seiten, die die Erweiterung lesen darf (host_permissions). */
export function istLinkedin(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'www.linkedin.com'
  } catch {
    return false
  }
}
