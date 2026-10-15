// BAUPLAN § 3.8 parser/linkedinUrl.ts: nutzt lib/url.normalizeLinkedinUrl; Klassifikation person | sales_nav | firmenseite | ungueltig.
// § 6.3 URLREGEX + Regel „Token, das mit linkedin.com/in/ beginnt, wird als URL gewertet“ (Beispiel 2, ohne Protokoll).
import { normalizeLinkedinUrl, urlArt } from '@/lib/url'

export type UrlArt = 'person' | 'sales_nav' | 'firmenseite' | 'keine' | 'ungueltig'
export type UrlTeile = { linkedin_url: string | null; linkedin_url_norm: string | null; url_art: UrlArt }

/** Erster LinkedIn-Link im Text (Protokoll optional, Query/Fragment bleiben im Rohwert, die Norm schneidet sie ab). */
export const URL_REGEX =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|sales\/lead|sales\/people|company)\/[^\s|)\]"'<>]+/i

/** Platzhalter, die „keine URL“ bedeuten (§ 6.3: „unbekannt“ → null). */
const KEINE = /^(unbekannt|unknown|k\.?\s?a\.?|n\/a|na|-|–|—|\?|keine?|none|null)$/i

function randSatzzeichenWeg(u: string): string {
  return u.replace(/[.,;:!]+$/, '')
}

/** Findet die erste URL im Text und liefert den Rest ohne sie. */
export function urlFinden(text: string): { url: string | null; rest: string } {
  const m = URL_REGEX.exec(text)
  if (!m) return { url: null, rest: text }
  const url = randSatzzeichenWeg(m[0])
  const rest = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim()
  return { url, rest }
}

/** Klassifiziert eine (Roh-)URL. */
export function klassifizieren(roh: string | null | undefined): UrlTeile {
  const u = (roh ?? '').trim()
  if (u === '' || KEINE.test(u)) return { linkedin_url: null, linkedin_url_norm: null, url_art: 'keine' }
  const url = randSatzzeichenWeg(u)
  const art = urlArt(url)
  return { linkedin_url: url, linkedin_url_norm: normalizeLinkedinUrl(url), url_art: art }
}
