// BAUPLAN § 3.1.9 `url.ts` / § 6.3 – exakter Spiegel von crm.normalize_linkedin_url (schema.sql):
//   lower(btrim) · ^https?:// weg · ^([a-z]{2,3}\.)?linkedin\.com → linkedin.com · Query/Fragment weg
//   · Trailing-Slash weg · Prozent-Dekodierung (crm.url_decode) · nur ^linkedin\.com/in/[^/]+$ gültig.

const utf8 = new TextDecoder('utf-8')

/** crm.url_decode: %XX-Paare bytewise dekodieren, alles andere unverändert (kein `+` → Leerzeichen). */
export function urlDecode(s: string): string {
  const bytes: number[] = []
  const enc = new TextEncoder()
  let i = 0
  while (i < s.length) {
    const c = s[i] as string
    if (c === '%' && i + 2 < s.length && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16))
      i += 3
    } else {
      bytes.push(...enc.encode(c))
      i += 1
    }
  }
  return utf8.decode(new Uint8Array(bytes))
}

/** `linkedin.com/in/<slug>` oder `null`. */
export function normalizeLinkedinUrl(u: string | null | undefined): string | null {
  if (u == null) return null
  let s = u.trim().toLowerCase()
  if (s === '') return null
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/^([a-z]{2,3}\.)?linkedin\.com/, 'linkedin.com')
  s = s.split('?')[0] as string
  s = s.split('#')[0] as string
  s = s.replace(/\/+$/, '')
  s = urlDecode(s)
  if (!/^linkedin\.com\/in\/[^/]+$/.test(s)) return null
  return s
}

function roh(u: string | null | undefined): string {
  return (u ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^([a-z]{2,3}\.)?linkedin\.com/, 'linkedin.com')
}

/** `/sales/lead/…` oder `/sales/people/…` (Sales Navigator). */
export function istSalesNav(u: string | null | undefined): boolean {
  return /^linkedin\.com\/sales\/(lead|people)\//.test(roh(u))
}

/** `/company/…` (ux § 4.9: „Das ist eine Firmenseite“). */
export function istFirmenseite(u: string | null | undefined): boolean {
  return /^linkedin\.com\/company\//.test(roh(u))
}

/** Art einer eingegebenen URL (SchnellimportZeile.url_art, § 4.2). */
export function urlArt(u: string | null | undefined): 'person' | 'sales_nav' | 'firmenseite' | 'keine' | 'ungueltig' {
  if (!u || u.trim() === '') return 'keine'
  if (normalizeLinkedinUrl(u)) return 'person'
  if (istSalesNav(u)) return 'sales_nav'
  if (istFirmenseite(u)) return 'firmenseite'
  return 'ungueltig'
}

/** Gekürzte Anzeige: `in/max-mustermann` (max. `maxLaenge` Zeichen, dann `…`). */
export function linkedinAnzeige(u: string | null | undefined, maxLaenge = 32): string {
  const norm = normalizeLinkedinUrl(u)
  const text = norm ? norm.replace(/^linkedin\.com\//, '') : roh(u).replace(/^linkedin\.com\//, '')
  if (text.length <= maxLaenge) return text
  return `${text.slice(0, Math.max(1, maxLaenge - 1))}…`
}

/** Vollständige, klickbare URL aus Norm oder Eingabe. */
export function linkedinHref(u: string | null | undefined): string | null {
  const norm = normalizeLinkedinUrl(u)
  if (norm) return `https://www.${norm}/`
  const r = roh(u)
  return r.startsWith('linkedin.com/') ? `https://www.${r}` : null
}

/**
 * Internes Rücksprungziel (`?von=`, `?zurueck=`): nur Pfade, die mit `/` und nicht mit `//` oder `/\` beginnen – kein Open
 * Redirect (BAUPLAN § 1.5 Nr. 31). Integration M1–M8: eine Prüfung für Anmelden, Anruf-Screen, E-Mail und Schnellimport.
 */
export function internesZiel(wert: string | null | undefined, standard: string): string {
  if (!wert || !wert.startsWith('/') || wert.startsWith('//') || wert.startsWith('/\\')) return standard
  return wert
}
