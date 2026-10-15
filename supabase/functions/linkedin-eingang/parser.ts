// Erkennt LinkedIn-Benachrichtigungs-Mails (deutsch Sie/du und englisch) und zieht Art, Name, Profil-Slug und Nachrichtentext heraus.
// Reine Funktionen ohne Netz und ohne Abhängigkeiten – getestet in parser_test.ts (`deno test supabase/functions/linkedin-eingang`).
// Jede Entscheidung landet in roh.parser (Regel, Quelle von Name/Slug, Grund), damit die Regeln später an echten Mails
// nachgeschärft werden können. Nie gespeichert: der volle Mail-Text, Query-Strings von Links (Tracking-/Login-Token).

export const PARSER_VERSION = '2026-10-15.2'

export type Art = 'nachricht' | 'annahme' | 'einladung' | 'sonstiges'

/** Eine Mail, wie das Apps Script sie schickt. */
export interface Mail {
  id: string
  datum: string
  betreff: string
  von: string
  text: string
  links: string[]
  /** Aus „Authentication-Results“: pass · fail · '' (unbekannt) */
  dmarc?: string
}

export interface ParserInfo {
  version: string
  regel: string
  name_quelle: 'absender' | 'betreff' | 'text' | null
  slug_quelle: 'link' | 'redirect' | 'text' | null
  slugs: number
  absender: string
  grund?: string
}

export interface Ergebnis {
  linkedin: boolean
  art: Art
  name: string | null
  slug: string | null
  text: string | null
  /** Bereinigte LinkedIn-Links (Host + Pfad, ohne Query), höchstens 8 */
  links: string[]
  parser: ParserInfo
}

// ---------------------------------------------------------------------------------------------------
// Regeln (Reihenfolge zählt: Sammelmails → Annahme → Nachricht → Einladung)
// ---------------------------------------------------------------------------------------------------
type Regel = { id: string; art: Exclude<Art, 'sonstiges'>; re: RegExp }

const SAMMEL: RegExp[] = [
  /\b(?:\d+|zwei|drei|vier|fünf|mehrere|neue|ungelesene)\s+(?:neue\s+|ungelesene\s+)?Nachrichten\b/i,
  /\b(?:\d+\s+)?(?:new|unread)\s+messages\b/i,
  /\bund\s+\d+\s+(?:weitere|andere)/i,
  /\band\s+\d+\s+(?:others?|more)\b/i,
]

const REGELN: Regel[] = [
  // Einladung angenommen
  { id: 'de-annahme-hat-angenommen', art: 'annahme', re: /^(?<name>.+?) hat (?:Ihre|deine|Deine|Ihr|dein) (?:Einladung|Kontaktanfrage|Vernetzungsanfrage)(?: zum Vernetzen| zur Vernetzung)? angenommen/i },
  { id: 'de-annahme-jetzt-vernetzt', art: 'annahme', re: /^(?:Sie|Du) und (?<name>.+?) (?:sind|seid) (?:jetzt |nun )?(?:vernetzt|Kontakte)/i },
  { id: 'de-annahme-mit-vernetzt', art: 'annahme', re: /^(?:Sie sind|Du bist) (?:jetzt |nun )?mit (?<name>.+?) vernetzt/i },
  { id: 'de-annahme-neuer-kontakt', art: 'annahme', re: /(?:Beginnen Sie|Beginne|Starten Sie|Starte) (?:eine Unterhaltung|ein Gespräch|eine Konversation) mit (?:Ihrem|Ihrer|deinem|deiner|dem|der) neuen Kontakt,?\s+(?<name>.+?)\.?$/i },
  { id: 'en-annahme-accepted', art: 'annahme', re: /^(?<name>.+?) (?:has )?accepted your (?:invitation|connection request)/i },
  { id: 'en-annahme-now-connected', art: 'annahme', re: /^You and (?<name>.+?) are now connected/i },
  { id: 'en-annahme-new-connection', art: 'annahme', re: /start a conversation with your new connection,?\s+(?<name>.+?)\.?$/i },
  // Nachricht
  { id: 'de-nachricht-neue-von', art: 'nachricht', re: /^(?:Sie haben|Du hast) (?:eine )?neue (?:Nachricht|InMail) von (?<name>.+?)\.?$/i },
  { id: 'de-nachricht-hat-gesendet', art: 'nachricht', re: /^(?<name>.+?) hat (?:Ihnen|dir|Dir) (?:eine )?(?:neue )?(?:Nachricht|InMail) (?:gesendet|geschickt)/i },
  { id: 'de-nachricht-neue-nachricht', art: 'nachricht', re: /^Neue (?:Nachricht|InMail) von (?<name>.+?)\.?$/i },
  { id: 'de-nachricht-geantwortet', art: 'nachricht', re: /^(?<name>.+?) hat (?:auf )?(?:Ihre|deine) (?:Nachricht|InMail) (?:beantwortet|geantwortet)/i },
  { id: 'de-nachricht-geschrieben', art: 'nachricht', re: /^(?<name>.+?) hat (?:Ihnen|dir|Dir) geschrieben/i },
  { id: 'de-nachricht-von', art: 'nachricht', re: /^Nachricht von (?<name>.+?)\.?$/i },
  { id: 'en-nachricht-sent-you', art: 'nachricht', re: /^(?<name>.+?) (?:has )?sent you a (?:new )?(?:message|InMail)/i },
  { id: 'en-nachricht-new-from', art: 'nachricht', re: /^(?:You have a )?new (?:message|InMail) from (?<name>.+?)\.?$/i },
  { id: 'en-nachricht-replied', art: 'nachricht', re: /^(?<name>.+?) (?:replied|responded) to your (?:message|InMail)/i },
  { id: 'en-nachricht-messaged', art: 'nachricht', re: /^(?<name>.+?) (?:just )?messaged you/i },
  { id: 'en-nachricht-from', art: 'nachricht', re: /^Message from (?<name>.+?)\.?$/i },
  // Einladung erhalten
  { id: 'de-einladung-moechte', art: 'einladung', re: /^(?<name>.+?) möchte sich mit (?:Ihnen|dir|Dir) vernetzen/i },
  { id: 'de-einladung-von', art: 'einladung', re: /^Einladung (?:zum Vernetzen )?von (?<name>.+?)(?: zum Vernetzen)?\.?$/i },
  { id: 'de-einladung-eingeladen', art: 'einladung', re: /^(?<name>.+?) hat (?:Sie|dich) (?:zum Vernetzen )?eingeladen/i },
  { id: 'de-einladung-ich-moechte', art: 'einladung', re: /^Ich möchte (?:mich mit Ihnen|mich mit dir|Sie|dich) (?:auf LinkedIn )?(?:vernetzen|zu meinem)/i },
  { id: 'en-einladung-wants', art: 'einladung', re: /^(?<name>.+?) (?:wants|would like) to connect/i },
  { id: 'en-einladung-from', art: 'einladung', re: /^Invitation (?:to connect )?from (?<name>.+?)\.?$/i },
  { id: 'en-einladung-invited', art: 'einladung', re: /^(?<name>.+?) (?:has )?invited you to connect/i },
  { id: 'en-einladung-id-like', art: 'einladung', re: /^I'?d like to (?:join your LinkedIn network|connect)/i },
]

/** Seiten-, Gruppen-, Event-Einladungen und Werbung sind keine Personen-Ereignisse. */
const KEIN_PERSONEN_EREIGNIS = /\b(?:Seite|Page|Gruppe|Group|Veranstaltung|Event|Newsletter|folgen|follow|abonnieren|subscribe|Gesponsert|Sponsored|Anzeige|Premium)\b/i

/** Absender-Adressen (lokaler Teil) echter Benachrichtigungen; alles andere (Werbung, Jobs, News) zählt nur über den Betreff. */
const BENACHRICHTIGUNG = new Set(['messages-noreply', 'invitations', 'invitations-noreply', 'notifications-noreply', 'inmail-hit-reply', 'hit-reply', 'member'])
const NACHRICHTEN_ABSENDER = new Set(['messages-noreply', 'inmail-hit-reply', 'hit-reply'])

const FUSS = [
  /^[-_=]{5,}$/,
  /\b(?:Abmelden|Unsubscribe|Abbestellen)\b/i,
  /^Diese E-Mail (?:ist|war|wurde)\b/i,
  /^This (?:e-?mail|message) was (?:intended|sent)\b/i,
  /^(?:You are|You're) receiving\b/i,
  /^(?:Sie erhalten|Du erhältst)\b/i,
  /^(?:Hilfe|Help)\s*:/i,
  /©\s*\d{4}\s*LinkedIn/i,
  /^LinkedIn (?:Corporation|Ireland)\b/i,
  /^(?:Learn why we included this|Erfahren Sie, warum|Erfahre, warum)/i,
  /\b(?:Benachrichtigungseinstellungen|notification settings|E-Mail-Einstellungen|email preferences)\b/i,
]
const AUFRUF = /^(?:Antworten|Antwort senden|Jetzt antworten|Reply|Reply now|Nachricht anzeigen|Nachricht lesen|Nachricht senden|View message|Read message|Send message|Message|Alle Nachrichten anzeigen|See all messages|Unterhaltung anzeigen|View conversation|Profil anzeigen|View profile|Annehmen|Accept|Ignorieren|Ignore|Mehr anzeigen|See more)\s*[:.›»>]*$/i
const KOPFZEILE = /^(?:(?:Sie haben|Du hast) (?:eine )?neue Nachricht|You have a new message|Neue Nachricht|New message)\.?$/i
const HEADLINE = /(?:\s(?:bei|at|@)\s|\s\|\s|Geschäftsführ|Inhaber|Owner|CEO|Founder|Gründer|Manager|Leiter|Head of|Director|Direktor|Vertrieb|Sales|Berater|Consultant|GmbH|\bAG\b|\bKG\b)/i

// ---------------------------------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------------------------------
const utf8 = new TextDecoder('utf-8')

/** Spiegel von crm.url_decode: %XX bytewise dekodieren, alles andere unverändert. */
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

function falten(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/[^a-z0-9]/g, '')
}

export function parseVon(von: string): { anzeige: string; adresse: string; lokal: string; domain: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^<>\s]+)>\s*$/.exec(von ?? '')
  const adresse = (m ? (m[2] as string) : (von ?? '')).trim().toLowerCase()
  const at = adresse.lastIndexOf('@')
  return {
    anzeige: m ? (m[1] as string).trim() : '',
    adresse,
    lokal: at > 0 ? adresse.slice(0, at) : '',
    domain: at > 0 ? adresse.slice(at + 1) : '',
  }
}

export function istLinkedinDomain(domain: string): boolean {
  return domain === 'linkedin.com' || domain.endsWith('.linkedin.com')
}

/** „Anna Beispiel, MBA 🚀“ → „Anna Beispiel“; „Vincent, Anna Beispiel“ → „Anna Beispiel“; null, wenn es kein Personenname ist. */
export function nameBereinigen(roh: string | null | undefined): string | null {
  if (!roh) return null
  let s = roh.normalize('NFC')
    .replace(/[\p{Extended_Pictographic}\p{So}\p{Co}​-‍️⁠]/gu, ' ')
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/["“”„«»]/g, ' ')
  s = (s.split(/\s+[|·]\s+/)[0] as string)
  if (s.includes(',')) {
    const teile = s.split(',').map((t) => t.trim()).filter(Boolean)
    const woerter = (t: string) => t.split(/\s+/).length
    s = teile.reduce((best, t) => (woerter(t) > woerter(best) ? t : best), teile[0] ?? '')
  }
  s = s.replace(/\s+/g, ' ').replace(/^[\s.:–-]+|[\s.:]+$/g, '').trim()
  if (s.length < 2 || s.length > 80) return null
  if (s.split(' ').length > 6) return null
  if (!/\p{L}/u.test(s) || /@|https?:|www\.|linkedin/i.test(s)) return null
  return s
}

/** Personenname aus der Absender-Anzeige („Anna Beispiel via LinkedIn“ / „… über LinkedIn“), sonst null. */
export function nameAusAnzeige(anzeige: string): string | null {
  const m = /^(.+?)\s*\(?\s*(?:via|über|ueber|through)\s+LinkedIn\s*\)?$/i.exec(anzeige.trim())
  return m ? nameBereinigen(m[1]) : null
}

function betreffBereinigen(b: string): string {
  let s = (b ?? '').replace(/\s+/g, ' ').trim()
  while (/^(?:re|aw|fwd?|wg|antw)\s*:\s*/i.test(s)) s = s.replace(/^(?:re|aw|fwd?|wg|antw)\s*:\s*/i, '')
  return s
}

function regelFinden(zeile: string): { regel: Regel; name: string | null } | null {
  for (const regel of REGELN) {
    const m = regel.re.exec(zeile)
    if (!m) continue
    if ((regel.art === 'einladung' || regel.art === 'nachricht') && KEIN_PERSONEN_EREIGNIS.test(zeile)) return null
    return { regel, name: nameBereinigen(m.groups?.name ?? null) }
  }
  return null
}

const REDIRECT_PARAMS = ['url', 'q', 'u', 'redirect', 'redirect_uri', 'redirectUrl', 'dest', 'destination', 'target', 'session_redirect']

/** Profil-Slug aus einem Link (auch /comm/in/, de.linkedin.com, verschachtelte und %-kodierte Weiterleitungen). */
export function slugAusLink(link: string): { slug: string; ueber: 'link' | 'redirect' } | null {
  let u = (link ?? '').trim().replace(/&amp;/g, '&')
  let ueber: 'link' | 'redirect' = 'link'
  for (let tiefe = 0; tiefe < 4 && u; tiefe++) {
    let url: URL | null = null
    try {
      url = new URL(/^[a-z]+:\/\//i.test(u) ? u : `https://${u}`)
    } catch {
      url = null
    }
    if (url) {
      const host = url.hostname.toLowerCase()
      if (istLinkedinDomain(host)) {
        const m = /^\/(?:comm\/)?in\/([^/?#]+)/i.exec(url.pathname)
        if (m) return slugPruefen(m[1] as string, ueber)
      }
      let weiter: string | null = null
      for (const p of REDIRECT_PARAMS) {
        const v = url.searchParams.get(p)
        if (v && /linkedin\.com/i.test(v)) { weiter = v; break }
      }
      if (weiter) { u = weiter; ueber = 'redirect'; continue }
    }
    // Weiterleitung im Pfad oder doppelt kodiert: einmal dekodieren und nach /in/ suchen
    const dekodiert = urlDecode(u)
    if (dekodiert !== u) { u = dekodiert; ueber = 'redirect'; continue }
    break
  }
  const m = /(?:^|[/.])linkedin\.com\/(?:comm\/)?in\/([^/?#&"'\s<>]+)/i.exec(u)
  return m ? slugPruefen(m[1] as string, ueber) : null
}

function slugPruefen(roh: string, ueber: 'link' | 'redirect'): { slug: string; ueber: 'link' | 'redirect' } | null {
  const slug = urlDecode(roh).trim().toLowerCase().replace(/\/+$/, '')
  if (!slug || slug.length > 100 || /[\s/]/.test(slug)) return null
  if (['me', 'unavailable', 'private', 'edit'].includes(slug)) return null
  if (/^acoa[a-z0-9_-]{10,}$/i.test(slug)) return null // Mitglieds-URN statt Profil-Adresse – passt zu keinem Lead
  return { slug, ueber }
}

/** Bereinigter Link für roh.links: Host + Pfad, keine Query (dort stecken Tracking- und Login-Token). */
export function linkKurz(link: string): string | null {
  try {
    let u = (link ?? '').trim().replace(/&amp;/g, '&')
    for (let i = 0; i < 3; i++) {
      const url = new URL(/^[a-z]+:\/\//i.test(u) ? u : `https://${u}`)
      const weiter = REDIRECT_PARAMS.map((p) => url.searchParams.get(p)).find((v) => v && /linkedin\.com/i.test(v))
      if (weiter) { u = weiter; continue }
      if (!istLinkedinDomain(url.hostname.toLowerCase())) return null
      return (url.hostname.toLowerCase() + urlDecode(url.pathname)).replace(/\/+$/, '').slice(0, 200)
    }
  } catch {
    return null
  }
  return null
}

/** Nachrichtentext aus dem Klartext-Body: ohne Kopf-, Namens-, Aufruf- und Fußzeilen, ohne URLs; höchstens 2000 Zeichen. */
export function textAuszug(body: string, name: string | null, betreff: string): string | null {
  const s = (body ?? '').slice(0, 10000)
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿͏­⁠]/g, '')
    .replace(/\[(?:image|Bild|Grafik)[^\]]*\]/gi, '')
    .replace(/<https?:\/\/[^>\s]*>/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
  const zeilen = s.split('\n').map((z) => z.replace(/\s+/g, ' ').trim())
  const nameKlein = name?.toLowerCase() ?? null
  const betreffKlein = betreffBereinigen(betreff).toLowerCase()
  const aus: string[] = []
  let begonnen = false
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i] as string
    if (FUSS.some((re) => re.test(z))) break
    if (/^(?:Am .+ schrieb .+:|On .+ wrote:)$/.test(z)) break
    if (z.startsWith('>')) continue
    if (AUFRUF.test(z)) { if (begonnen) break; continue }
    if (z === '') { if (begonnen) aus.push(''); continue }
    const kl = z.toLowerCase().replace(/[.:]+$/, '')
    if (kl === betreffKlein.replace(/[.:]+$/, '') || KOPFZEILE.test(z) || regelFinden(z) || SAMMEL.some((re) => re.test(z))) continue
    if (nameKlein && kl === nameKlein) {
      // Zeile danach ist oft die Headline („Geschäftsführerin bei …“)
      const naechste = zeilen.slice(i + 1).find((x) => x !== '')
      if (naechste && HEADLINE.test(naechste) && !/[.!?]$/.test(naechste)) {
        i = zeilen.indexOf(naechste, i + 1)
      }
      continue
    }
    aus.push(z)
    begonnen = true
  }
  let t = aus.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!t) return null
  if (t.length > 2000) t = t.slice(0, 1999) + '…'
  return t
}

/** Nachname (gefaltet) passt in den Slug? Nur ab 3 Zeichen, sonst zu unsicher. */
function passtZumNamen(slug: string, name: string | null): boolean {
  const nachname = name ? falten(name.split(' ').slice(-1)[0] ?? '') : ''
  return nachname.length >= 3 && falten(slug).includes(nachname)
}

export interface ParseOptionen {
  /** Profil-Slug des Mitglieds aus member_profiles.linkedin_url */
  eigenerSlug?: string | null
  /** Weitere eigene Slugs (z. B. aus eigeneSlugsSchaetzen über alle Mails eines Aufrufs) */
  eigeneSlugs?: Iterable<string>
  /** Vor- oder Anzeigename des Mitglieds („Vincent“): Slugs mit diesem Namen, die nicht zum Absender passen, zählen nicht */
  eigeneNamen?: Iterable<string>
}

/**
 * Eigene Profil-Slugs schätzen: LinkedIn verlinkt in Kopf und Fuß jeder Mail das Profil des Empfängers. Ein Slug, der in
 * mindestens 3 Mails von mindestens 2 verschiedenen Absendern vorkommt und zu keinem dieser Absender passt, ist der eigene.
 */
export function eigeneSlugsSchaetzen(mails: Mail[]): string[] {
  const treffer = new Map<string, { mails: number; namen: Set<string> }>()
  for (const m of mails) {
    const e = parseMail(m)
    if (!e.linkedin || e.art === 'sonstiges' || !e.name) continue
    const slugs = new Set<string>()
    for (const l of [...(m.links ?? []), ...((m.text ?? '').slice(0, 10000).match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [])]) {
      const s = slugAusLink(l)
      if (s && !passtZumNamen(s.slug, e.name)) slugs.add(s.slug)
    }
    for (const s of slugs) {
      const t = treffer.get(s) ?? { mails: 0, namen: new Set<string>() }
      t.mails++
      t.namen.add(e.name.toLowerCase())
      treffer.set(s, t)
    }
  }
  return [...treffer.entries()].filter(([, t]) => t.mails >= 3 && t.namen.size >= 2).map(([s]) => s)
}

// ---------------------------------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------------------------------
export function parseMail(mail: Mail, optionen: ParseOptionen = {}): Ergebnis {
  const von = parseVon(mail.von)
  const betreff = betreffBereinigen(mail.betreff)
  const info: ParserInfo = { version: PARSER_VERSION, regel: '', name_quelle: null, slug_quelle: null, slugs: 0, absender: von.lokal }
  const leer = (grund: string, linkedin: boolean): Ergebnis => ({
    linkedin, art: 'sonstiges', name: null, slug: null, text: null, links: [], parser: { ...info, regel: 'keine', grund },
  })

  if (!istLinkedinDomain(von.domain)) return leer('Absender ist nicht linkedin.com', false)
  if ((mail.dmarc ?? '').toLowerCase() === 'fail') return leer('DMARC fehlgeschlagen – möglicherweise gefälscht', false)

  // Links: aus der Liste und aus URLs im Klartext
  const alleLinks = [...(mail.links ?? []), ...((mail.text ?? '').slice(0, 10000).match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [])]
  const links = [...new Set(alleLinks.map(linkKurz).filter((x): x is string => !!x))].slice(0, 8)

  if (SAMMEL.some((re) => re.test(betreff)) || von.lokal.includes('digest')) {
    return { ...leer('Sammel-Benachrichtigung (mehrere Personen)', true), links }
  }

  // 1) Art + Name aus dem Betreff; 2) sonst Absender (Nachrichten-Adresse) ; 3) sonst Zeilen am Anfang des Textes
  const anzeigeName = nameAusAnzeige(von.anzeige)
  let art: Art = 'sonstiges'
  let name: string | null = null
  const treffer = regelFinden(betreff)
  if (treffer) {
    art = treffer.regel.art
    info.regel = `betreff:${treffer.regel.id}`
    name = anzeigeName ?? treffer.name
    info.name_quelle = anzeigeName ? 'absender' : treffer.name ? 'betreff' : null
  } else if (BENACHRICHTIGUNG.has(von.lokal) && !KEIN_PERSONEN_EREIGNIS.test(betreff)) {
    const zeilen = (mail.text ?? '').slice(0, 3000).split(/\r?\n/).map((z) => z.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40)
    for (const z of zeilen) {
      const t = regelFinden(z)
      if (t) {
        art = t.regel.art
        info.regel = `text:${t.regel.id}`
        name = anzeigeName ?? t.name
        info.name_quelle = anzeigeName ? 'absender' : t.name ? 'text' : null
        break
      }
    }
    if (art === 'sonstiges' && NACHRICHTEN_ABSENDER.has(von.lokal) && anzeigeName) {
      art = 'nachricht'
      info.regel = `absender:${von.lokal}`
      name = anzeigeName
      info.name_quelle = 'absender'
    }
  }
  if (art === 'sonstiges') return { ...leer('Keine Personen-Benachrichtigung (Werbung, Hinweis, Beitrag …)', true), links }

  // Profil-Slug: häufigster Kandidat, der zum Namen passt; eigene Slugs und Mitglieds-URNs zählen nicht
  const eigene = new Set([optionen.eigenerSlug, ...(optionen.eigeneSlugs ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase()))
  const eigeneNamen = [...(optionen.eigeneNamen ?? [])].map((n) => falten(n)).filter((n) => n.length >= 3)
  const vorname = name ? falten(name.split(' ').slice(-2, -1)[0] ?? '') : ''
  const istEigen = (slug: string) => {
    if (eigene.has(slug)) return true
    if (passtZumNamen(slug, name)) return false
    const f = falten(slug)
    // „vincent-…“ ist der eigene Slug, außer der Absender heißt selbst so
    return eigeneNamen.some((n) => f.includes(n)) && !(vorname.length >= 3 && f.includes(vorname))
  }
  const kandidaten = new Map<string, { n: number; erst: number; ueber: 'link' | 'redirect' }>()
  alleLinks.forEach((l, idx) => {
    const s = slugAusLink(l)
    if (!s || istEigen(s.slug)) return
    const k = kandidaten.get(s.slug)
    if (k) k.n++
    else kandidaten.set(s.slug, { n: 1, erst: idx, ueber: s.ueber })
  })
  info.slugs = kandidaten.size
  const passt = (slug: string) => (passtZumNamen(slug, name) ? 1 : 0)
  const bester = [...kandidaten.entries()].sort((a, b) =>
    passt(b[0]) - passt(a[0]) || b[1].n - a[1].n || a[1].erst - b[1].erst)[0]
  const slug = bester ? bester[0] : null
  if (bester) info.slug_quelle = bester[1].erst >= (mail.links ?? []).length ? 'text' : bester[1].ueber

  const text = art === 'annahme' ? null : textAuszug(mail.text ?? '', name, mail.betreff ?? '')
  return { linkedin: true, art, name, slug, text, links, parser: info }
}

// ---------------------------------------------------------------------------------------------------
// Zeile für crm.eingang
// ---------------------------------------------------------------------------------------------------
export interface EingangZeile {
  member_id: string
  quelle: 'gmail_linkedin'
  external_id: string
  art: Art
  empfangen_at: string
  absender_name: string | null
  linkedin_slug: string | null
  text: string | null
  roh: Record<string, unknown>
  status: 'neu' | 'ignoriert'
  ergebnis: string | null
  verarbeitet_at: string | null
}

const ROH_MAX = 4000

export function zeileBauen(mail: Mail, e: Ergebnis, memberId: string, jetzt = new Date()): EingangZeile {
  const datum = new Date(mail.datum)
  const empfangen = Number.isNaN(datum.getTime()) ? jetzt : datum
  const relevant = e.art !== 'sonstiges'
  // Datensparsamkeit: Werbung, Job-Mails, „hat Ihr Profil angesehen“ und fremde Mails behalten nur die Parser-Entscheidung
  // (Regel, Grund, bei LinkedIn die Systemadresse wie messages-noreply) – keine Betreffzeilen, Absender oder Links Dritter.
  const roh: Record<string, unknown> = relevant
    ? { betreff: (mail.betreff ?? '').slice(0, 300), von: (mail.von ?? '').slice(0, 200), links: [...e.links], parser: e.parser }
    : {
      parser: {
        version: e.parser.version,
        regel: e.parser.regel,
        grund: e.parser.grund ?? null,
        ...(e.linkedin ? { absender: e.parser.absender.slice(0, 60) } : {}),
      },
    }
  const groesse = () => new TextEncoder().encode(JSON.stringify(roh)).length
  while (groesse() > ROH_MAX && Array.isArray(roh.links) && (roh.links as string[]).length > 0) (roh.links as string[]).pop()
  if (groesse() > ROH_MAX && typeof roh.betreff === 'string') roh.betreff = (roh.betreff as string).slice(0, 100)
  return {
    member_id: memberId,
    quelle: 'gmail_linkedin',
    external_id: mail.id,
    art: e.art,
    empfangen_at: empfangen.toISOString(),
    absender_name: relevant ? e.name : null,
    linkedin_slug: relevant ? e.slug : null,
    text: relevant ? e.text : null,
    roh,
    status: relevant ? 'neu' : 'ignoriert',
    ergebnis: relevant ? null : (e.parser.grund ?? 'Keine Aktion nötig'),
    verarbeitet_at: relevant ? null : jetzt.toISOString(),
  }
}
