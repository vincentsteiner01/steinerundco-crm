// Kleine DOM-Helfer für das Lese-Skript. Regel: nie allein auf (gehashte) Klassennamen verlassen – zuerst URL, Titel, Meta-Tags,
// h1, aria-label und Link-Ziele (/in/<slug>); Klassen nur als zusätzliches Signal. Jede Funktion liefert im Zweifel `null`.
import { normalizeLinkedinUrl } from '@/lib/url'
import { sauber } from '../shared/name'

export function text(el: Element | null | undefined): string | null {
  if (!el) return null
  const t = sauber(el.textContent)
  return t || null
}

/** Sichtbarer Text ohne Screenreader-Duplikate (`.visually-hidden`, `.a11y-text`) – LinkedIn doppelt Namen dort oft. */
export function sichtbarerText(el: Element | null | undefined): string | null {
  if (!el) return null
  const klon = el.cloneNode(true) as Element
  for (const v of klon.querySelectorAll('.visually-hidden, .a11y-text, [aria-hidden="true"] .visually-hidden')) v.remove()
  const t = sauber(klon.textContent)
  return t || null
}

export function meta(doc: Document, ...namen: string[]): string | null {
  for (const n of namen) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)
    const c = sauber(el?.getAttribute('content'))
    if (c) return c
  }
  return null
}

/** Slug aus `/in/<slug>` (auch `/in/<slug>/details/…`, `/in/<slug>/overlay/…`); `null` sonst. */
export function slugAusPfad(href: string | null | undefined): string | null {
  if (!href) return null
  let pfad: string
  try {
    pfad = new URL(href, 'https://www.linkedin.com').pathname
  } catch {
    return null
  }
  const m = /^\/in\/([^/?#]+)/.exec(pfad)
  if (!m || !m[1]) return null
  return m[1]
}

/** URN-artige Profil-IDs (`ACoAAB…`) statt Vanity-Slug. */
export function istUrnSlug(slug: string | null | undefined): boolean {
  return !!slug && /^AC[a-zA-Z0-9_-]{20,}$/.test(slug)
}

export function profilAusSlug(slug: string | null): { profilUrl: string | null; norm: string | null } {
  if (!slug) return { profilUrl: null, norm: null }
  const profilUrl = `https://www.linkedin.com/in/${slug}/`
  return { profilUrl, norm: normalizeLinkedinUrl(profilUrl) }
}

/** Sichtbare Blätter (Elemente ohne Element-Kinder mit Text) unterhalb von `wurzel`, in Dokumentreihenfolge. */
export function textBlaetter(wurzel: Element): Element[] {
  const out: Element[] = []
  for (const el of wurzel.querySelectorAll('div, span, p, h2, h3, a, li')) {
    if (el.closest('script, style, noscript, template')) continue
    const kinderMitText = [...el.children].some((k) => !!sauber(k.textContent))
    if (!kinderMitText && sauber(el.textContent)) out.push(el)
  }
  return out
}

/** Liegt `b` im Dokument nach `a`? */
export function istNach(a: Node, b: Node): boolean {
  return !!(a.compareDocumentPosition(b) & 4)
}
