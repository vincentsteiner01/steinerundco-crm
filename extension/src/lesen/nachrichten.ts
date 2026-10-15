// Unterhaltungen (linkedin.com/messaging/thread/…, auch die kleinen Chatfenster unten rechts): Gesprächspartner und die letzte
// Nachricht der anderen Person. Best effort – das Feld bleibt in der Seitenleiste immer editierbar.
import { bereinigeName, gleicherName, sauber } from '../shared/name'
import { sichtbarerText, slugAusPfad, text } from './dom'

export type Partner = { name: string | null; slug: string | null; headline: string | null }
export type Eintrag = { absenderName: string | null; absenderSlug: string | null; andere: boolean; text: string }

const LISTE = '[class*="msg-s-message-list"], [class*="message-list"]'
const NICHT_KOPF = '[class*="message-list"], [class*="conversation-list"], [class*="conversations-container"], [class*="global-nav"], header#global-nav, nav'
const A11Y_ABSENDER = /^(.+?)\s+(?:sent the following|hat (?:die )?folgende|hat folgende)/i

function istImKopf(a: Element): boolean {
  return !a.closest(NICHT_KOPF)
}

/** Gesprächspartner im Kopf der Unterhaltung: erster Profil-Link außerhalb der Nachrichtenliste und der Unterhaltungsliste. */
export function lesePartner(wurzel: Element): Partner {
  let slug: string | null = null
  let name: string | null = null
  for (const a of wurzel.querySelectorAll('a[href*="/in/"]')) {
    if (!istImKopf(a)) continue
    const s = slugAusPfad(a.getAttribute('href'))
    if (!s) continue
    slug = s
    name =
      bereinigeName(sichtbarerText(a.querySelector('h2, h3, [class*="title"]'))) ??
      bereinigeName(sichtbarerText(a)) ??
      bereinigeName(a.getAttribute('aria-label')?.replace(/^(?:profil von|profile of|view)\s+/i, '') ?? null)
    break
  }
  if (!name) {
    const kopf = wurzel.querySelector(
      '[class*="entity-lockup__entity-title"], [class*="entity-title"], [class*="title-bar"] h2, [class*="bubble-header"] h2, [class*="profile-card-one-to-one__profile-link"]',
    )
    name = bereinigeName(sichtbarerText(kopf))
  }
  const headline = text(wurzel.querySelector('[class*="entity-lockup__entity-info"], [class*="entity-info"], [class*="headline"]'))
  return { name, slug, headline: headline && !gleicherName(headline, name) ? headline : null }
}

function absenderVon(item: Element): { name: string | null; slug: string | null } {
  const nameEl = item.querySelector('[class*="message-group__name"], [class*="group__name"]')
  const link = item.querySelector('a[href*="/in/"]')
  const slug = slugAusPfad(link?.getAttribute('href'))
  let name = bereinigeName(sichtbarerText(nameEl))
  if (!name) {
    for (const v of item.querySelectorAll('.visually-hidden, .a11y-text')) {
      const m = A11Y_ABSENDER.exec(sauber(v.textContent))
      if (m) {
        name = bereinigeName(m[1])
        break
      }
    }
  }
  if (!name && link) name = bereinigeName(link.querySelector('img')?.getAttribute('alt')?.replace(/^(?:profilbild von|profile picture of|foto von)\s+/i, '') ?? null)
  return { name, slug }
}

/** Text mit Zeilenumbrüchen für <br> und Absätze; Leerraum je Zeile zusammengezogen. */
export function absatzText(el: Element): string {
  const klon = el.cloneNode(true) as Element
  // Quelltext-Umbrüche zählen nicht (wie innerText), nur <br> und Absätze
  const gang = el.ownerDocument.createTreeWalker(klon, 4 /* NodeFilter.SHOW_TEXT */)
  for (let n = gang.nextNode(); n; n = gang.nextNode()) n.nodeValue = (n.nodeValue ?? '').replace(/\s+/g, ' ')
  for (const br of klon.querySelectorAll('br')) br.replaceWith('\n')
  for (const p of klon.querySelectorAll('p')) p.append('\n')
  return (klon.textContent ?? '')
    .split('\n')
    .map((z) => sauber(z))
    .filter(Boolean)
    .join('\n')
}

function nachrichtenTexte(item: Element): string[] {
  let bodies = [...item.querySelectorAll('[class*="event-listitem__body"]')]
  if (bodies.length === 0) bodies = [...item.querySelectorAll('[class*="event__content"] p, [class*="message-body"]')]
  return bodies.map((b) => absatzText(b)).filter((t) => t.length > 0)
}

/** Alle Nachrichten einer Unterhaltung in Reihenfolge; Absender gilt weiter, bis eine neue Gruppe beginnt. */
export function leseEintraege(gespraech: Element): Eintrag[] {
  const liste = gespraech.matches(LISTE) ? gespraech : (gespraech.querySelector(LISTE) ?? gespraech)
  let items: Element[] = [...liste.querySelectorAll('li')].filter((li) => !li.parentElement?.closest('li'))
  if (items.length === 0) items = [...liste.querySelectorAll('[class*="event-listitem"]')]
  const out: Eintrag[] = []
  let aktuell: { name: string | null; slug: string | null } = { name: null, slug: null }
  for (const item of items) {
    const a = absenderVon(item)
    if (a.name || a.slug) aktuell = a
    const andere = item.matches('[class*="--other"]') || !!item.querySelector('[class*="listitem--other"], [class*="--other"]')
    for (const t of nachrichtenTexte(item))
      out.push({ absenderName: aktuell.name, absenderSlug: aktuell.slug, andere, text: t.slice(0, 4000) })
  }
  return out
}

/** Letzte Nachricht der anderen Person: Absender = Partner (Slug oder Name), sonst als „andere“ markiert, sonst ≠ ich. */
export function letzteVonPartner(eintraege: readonly Eintrag[], partner: Partner, ichName?: string | null): string | null {
  const vonPartner = (e: Eintrag) =>
    (!!partner.slug && !!e.absenderSlug && e.absenderSlug.toLowerCase() === partner.slug.toLowerCase()) ||
    (!!partner.name && gleicherName(e.absenderName, partner.name))
  for (let i = eintraege.length - 1; i >= 0; i--) {
    const e = eintraege[i]
    if (e && vonPartner(e)) return e.text
  }
  for (let i = eintraege.length - 1; i >= 0; i--) {
    const e = eintraege[i]
    if (e?.andere) return e.text
  }
  if (ichName) {
    for (let i = eintraege.length - 1; i >= 0; i--) {
      const e = eintraege[i]
      if (e?.absenderName && !gleicherName(e.absenderName, ichName)) return e.text
    }
  }
  return null
}

/** Offene Unterhaltung auf /messaging/thread/…: Kopf + Nachrichtenliste im Hauptbereich. */
export function leseGespraech(doc: Document, ichName?: string | null): { partner: Partner; letzte: string | null } {
  const haupt = doc.querySelector('main') ?? doc.body ?? doc.documentElement
  const thread =
    haupt.querySelector('[class*="msg-thread"], [class*="msg-convo-wrapper"], [class*="conversation-detail"]') ?? haupt
  const partner = lesePartner(thread)
  const letzte = letzteVonPartner(leseEintraege(thread), partner, ichName)
  return { partner, letzte }
}

/** Kleines Chatfenster unten rechts (auf Profilseiten), das zu dieser Person gehört. */
export function leseChatfenster(doc: Document, person: { slug: string | null; name: string | null }, ichName?: string | null): string | null {
  for (const fenster of doc.querySelectorAll('[class*="msg-overlay-conversation-bubble"], [class*="conversation-bubble"]')) {
    const kopf = fenster.querySelector('[class*="bubble-header"], header') ?? fenster
    const p = lesePartner(kopf)
    const passt =
      (!!person.slug && !!p.slug && p.slug.toLowerCase() === person.slug.toLowerCase()) ||
      (!!person.name && gleicherName(p.name ?? text(kopf), person.name))
    if (!passt) continue
    return letzteVonPartner(leseEintraege(fenster), { ...p, name: p.name ?? person.name, slug: p.slug ?? person.slug }, ichName)
  }
  return null
}
