// Profilseite linkedin.com/in/<slug>: Name, Headline, Firma, Ort, Profil-URL. Reine Funktion auf einem Document.
import type { PersonExtrakt } from '../shared/typen'
import { bereinigeName, gleicherName, sauber, teileName } from '../shared/name'
import { istNach, istUrnSlug, meta, profilAusSlug, sichtbarerText, slugAusPfad, text, textBlaetter } from './dom'

const FIRMA_ARIA = /^(?:aktuelles unternehmen|derzeitiges unternehmen|aktuelle firma|current company)\s*:\s*(.+?)\s*(?:\.\s+(?:klick\w*|click\w*|zur|to)\b.*)?\.?$/i
const KEIN_ORT = /kontakt|contact|follower|verbindung|connection|kontakte|\bfolgen\b|nachricht|message/i
const KEINE_HEADLINE = /^(?:·\s*)?(?:1st|2nd|3rd|\d\.|1\.|2\.|3\.)(?:\s|$)|^·|^(?:he|she|they|er|sie)\s*\/|kontaktinfo|contact info|verifiziert|verified/i

/** „(3) Erika Beispiel | LinkedIn“ → „Erika Beispiel“. */
export function nameAusTitel(titel: string | null | undefined): string | null {
  let s = sauber(titel)
  if (!s) return null
  s = s.replace(/^\(\d+\+?\)\s*/, '')
  s = s.split(' | ')[0] ?? ''
  s = s.split(/\s+[-–—]\s+/)[0] ?? ''
  s = sauber(s)
  if (!s || /^(linkedin|feed|nachrichten|messaging|mein netzwerk|my network)$/i.test(s)) return null
  return s
}

/** Headline „Geschäftsführerin bei Muster GmbH | Photovoltaik“ → Position und Firma. */
export function teileHeadline(headline: string | null | undefined): { rolle: string | null; unternehmen: string | null } {
  const h = sauber(headline)
  if (!h) return { rolle: null, unternehmen: null }
  const erster = sauber(h.split(/\s+[|•·]\s+/)[0])
  const m = /^(.*?)\s+(?:bei|at)\s+(.+)$/i.exec(erster) ?? /^(.*?)\s*@\s*(.+)$/.exec(erster)
  if (m) {
    const rolle = sauber(m[1]).slice(0, 120) || null
    const unternehmen = sauber(m[2]).replace(/[,;]\s*$/, '').slice(0, 120) || null
    return { rolle, unternehmen }
  }
  return { rolle: erster.slice(0, 120) || null, unternehmen: null }
}

/** Felder aus der Meta-Beschreibung öffentlicher Profile („Erfahrung: X · Ort: Y“ / „Experience: X · Location: Y“). */
export function ausBeschreibung(beschreibung: string | null | undefined): { unternehmen: string | null; ort: string | null; headline: string | null } {
  const d = sauber(beschreibung)
  if (!d) return { unternehmen: null, ort: null, headline: null }
  const teile = d.split(/\s+·\s+/)
  let unternehmen: string | null = null
  let ort: string | null = null
  let headline: string | null = null
  for (const [i, t] of teile.entries()) {
    const f = /^(?:erfahrung|experience)\s*:\s*(.+)$/i.exec(t)
    if (f) unternehmen ??= sauber(f[1])
    const o = /^(?:ort|standort|location)\s*:\s*(.+)$/i.exec(t)
    if (o) ort ??= sauber(o[1]).replace(/\.$/, '')
    if (i === 0 && !/:/.test(t) && t.length <= 220) headline = t
  }
  return { unternehmen, ort, headline }
}

function hauptbereich(doc: Document): Element {
  return doc.querySelector('main') ?? doc.body ?? doc.documentElement
}

function nameH1(doc: Document): Element | null {
  for (const h of hauptbereich(doc).querySelectorAll('h1')) {
    const t = bereinigeName(sichtbarerText(h))
    if (t && !/^(linkedin|nachrichten|messaging)$/i.test(t)) return h
  }
  return null
}

/** Profilkarte oben: das `section` um den Namen, sonst der nächste Vorfahr mit Kontaktinfo-Link. */
function profilKarte(h1: Element | null): Element | null {
  if (!h1) return null
  const section = h1.closest('section')
  if (section) return section
  let el: Element | null = h1.parentElement
  for (let i = 0; i < 6 && el; i++) {
    if (el.querySelector('a[href*="/overlay/contact-info"]')) return el
    el = el.parentElement
  }
  return h1.parentElement
}

function headlineAusKarte(karte: Element | null, h1: Element | null, name: string | null): string | null {
  if (!karte) return null
  const direkt = text(karte.querySelector('.text-body-medium'))
  if (direkt && !gleicherName(direkt, name)) return direkt
  if (!h1) return null
  for (const el of textBlaetter(karte)) {
    if (!istNach(h1, el) || h1.contains(el) || el.contains(h1)) continue
    if (el.closest('button, a[href*="/overlay/"], .visually-hidden, .a11y-text')) continue
    const t = sauber(el.textContent)
    if (t.length < 3 || t.length > 300) continue
    if (gleicherName(t, name) || KEINE_HEADLINE.test(t)) continue
    return t
  }
  return null
}

function firmaAusAria(wurzel: Element): string | null {
  for (const el of wurzel.querySelectorAll('[aria-label]')) {
    const m = FIRMA_ARIA.exec(sauber(el.getAttribute('aria-label')))
    if (m && m[1]) return sauber(m[1])
  }
  return null
}

function ortAusKarte(karte: Element | null): string | null {
  if (!karte) return null
  const kontakt = karte.querySelector('a[href*="/overlay/contact-info"]')
  if (kontakt) {
    let el: Element | null = kontakt.parentElement
    for (let i = 0; i < 3 && el; i++) {
      for (const s of el.querySelectorAll('span')) {
        if (s.contains(kontakt) || kontakt.contains(s)) continue
        const t = sauber(s.textContent)
        if (t.length >= 2 && t.length <= 100 && !/^[·•]$/.test(t) && !KEIN_ORT.test(t)) return t.replace(/^[·•]\s*/, '')
      }
      el = el.parentElement
    }
  }
  for (const s of karte.querySelectorAll('.text-body-small')) {
    const t = sauber(s.textContent)
    if (t.length >= 2 && t.length <= 100 && !KEIN_ORT.test(t) && !/\d{2,}/.test(t)) return t
  }
  return null
}

/** Vanity-Slug aus Links der Profilkarte (`/in/<slug>/overlay/contact-info/`) – frisch auch nach SPA-Navigation. */
function slugAusKarte(karte: Element | null): string | null {
  if (!karte) return null
  for (const a of karte.querySelectorAll('a[href*="/in/"]')) {
    const s = slugAusPfad(a.getAttribute('href'))
    if (s && !istUrnSlug(s)) return s
  }
  return null
}

/** Eigene Profil-Links der Karte (`/in/<slug>/overlay/…`) – Links zu gemeinsamen Kontakten haben kein `/overlay/`. */
function eigeneKartenSlugs(karte: Element | null): string[] {
  if (!karte) return []
  const out: string[] = []
  for (const a of karte.querySelectorAll('a[href*="/overlay/"]')) {
    const s = slugAusPfad(a.getAttribute('href'))
    if (s && !istUrnSlug(s)) out.push(s.toLowerCase())
  }
  return out
}

const LEER: Omit<PersonExtrakt, 'profilUrl' | 'norm' | 'slug'> = {
  name: null,
  titel: null,
  vorname: null,
  nachname: null,
  headline: null,
  unternehmen: null,
  rolle: null,
  ort: null,
}

export function leseProfil(doc: Document, url: string): PersonExtrakt {
  const h1 = nameH1(doc)
  const karte = profilKarte(h1)
  const nameH = bereinigeName(sichtbarerText(h1))
  const nameT = bereinigeName(nameAusTitel(doc.title))
  // Nach einer LinkedIn-internen Navigation steht kurz noch die alte Profilkarte im DOM: dann nichts lesen (die Leiste liest
  // gleich noch einmal) – sonst landete der alte Name unter der neuen Profil-URL.
  const urlSlug = slugAusPfad(url)
  const eigene = eigeneKartenSlugs(karte)
  const kartePasst = !urlSlug || istUrnSlug(urlSlug) || eigene.length === 0 || eigene.includes(urlSlug.toLowerCase())
  const titelPasst = !nameH || !nameT || gleicherName(nameH, nameT)
  if (!kartePasst || !titelPasst) {
    const fest = urlSlug && !istUrnSlug(urlSlug) ? urlSlug : null
    return { ...LEER, ...profilAusSlug(fest), slug: fest }
  }
  const ogTitel = bereinigeName(nameAusTitel(meta(doc, 'og:title', 'twitter:title', 'title')))
  const name = nameH ?? nameT ?? ogTitel
  // Meta-Tags können nach SPA-Navigation zum vorigen Profil gehören: nur nutzen, wenn ihr Name zum sichtbaren passt.
  const metaPasst = !!ogTitel && (!nameH || gleicherName(ogTitel, nameH))
  const beschreibung = metaPasst ? ausBeschreibung(meta(doc, 'og:description', 'description')) : { unternehmen: null, ort: null, headline: null }

  // Slug: URL zuerst; URN-artige Pfade (ACoAA…) über die Profilkarte oder (passende) canonical/og:url auflösen
  let slug = slugAusPfad(url)
  if (!slug || istUrnSlug(slug)) {
    const ausKarte = slugAusKarte(karte)
    const kanonisch = metaPasst
      ? slugAusPfad(doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? meta(doc, 'og:url'))
      : null
    slug = ausKarte ?? (kanonisch && !istUrnSlug(kanonisch) ? kanonisch : slug)
  }
  // Unaufgelöste URN-IDs taugen nicht als CRM-Schlüssel (die DB-Norm wäre eine andere als die Vanity-URL)
  if (istUrnSlug(slug)) slug = null
  const { profilUrl, norm } = profilAusSlug(slug)

  const headline = headlineAusKarte(karte, h1, name) ?? beschreibung.headline
  const ausHeadline = teileHeadline(headline)
  const unternehmen = firmaAusAria(hauptbereich(doc)) ?? beschreibung.unternehmen ?? ausHeadline.unternehmen
  const ort = ortAusKarte(karte) ?? beschreibung.ort
  const teile = teileName(name)
  return {
    name,
    titel: teile.titel,
    vorname: teile.vorname,
    nachname: teile.nachname,
    headline,
    unternehmen,
    rolle: ausHeadline.rolle,
    ort,
    profilUrl,
    norm,
    slug,
  }
}
