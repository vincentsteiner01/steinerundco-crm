// Einstieg der Seitenlese-Logik: erkennt die Seitenart über die URL und ruft die passenden Leser. Rein, testbar mit jsdom.
import type { Extrakt, LeseOptionen, PersonExtrakt } from '../shared/typen'
import { teileName, sauber } from '../shared/name'
import { leseChatfenster, leseGespraech } from './nachrichten'
import { leseProfil, teileHeadline } from './profil'
import { istUrnSlug, profilAusSlug } from './dom'

export function seitenArt(url: string): { art: Extrakt['art']; hinweis: string | null } {
  let pfad = ''
  try {
    const u = new URL(url)
    if (u.hostname !== 'www.linkedin.com' && !u.hostname.endsWith('.linkedin.com')) return { art: 'andere', hinweis: null }
    pfad = u.pathname
  } catch {
    return { art: 'andere', hinweis: null }
  }
  if (/^\/in\/[^/]+/.test(pfad)) return { art: 'profil', hinweis: null }
  if (/^\/messaging\/thread\//.test(pfad)) return { art: 'nachrichten', hinweis: null }
  if (/^\/sales\//.test(pfad)) return { art: 'andere', hinweis: 'Sales Navigator liest die Erweiterung nicht – öffne das normale Profil.' }
  if (/^\/company\//.test(pfad)) return { art: 'andere', hinweis: 'Das ist eine Firmenseite – öffne das Profil einer Person.' }
  if (/^\/messaging\//.test(pfad)) return { art: 'andere', hinweis: 'Öffne eine Unterhaltung, dann zeigt die Leiste die Person.' }
  return { art: 'andere', hinweis: null }
}

export function leseSeite(doc: Document, url: string, opts: LeseOptionen & { auswahl?: string | null } = {}): Extrakt {
  const auswahl = sauber(opts.auswahl).slice(0, 4000) || null
  const { art, hinweis } = seitenArt(url)
  if (art === 'profil') {
    const person = leseProfil(doc, url)
    const letzte = leseChatfenster(doc, { slug: person.slug, name: person.name }, opts.ichName)
    return { art, url, person, letzteNachricht: letzte, auswahl, hinweis }
  }
  if (art === 'nachrichten') {
    const { partner, letzte } = leseGespraech(doc, opts.ichName)
    const teile = teileName(partner.name)
    const kopf = teileHeadline(partner.headline)
    // URN-artige Links (ACoAA…) taugen nicht als CRM-Schlüssel – dann nur über den Namen suchen
    const vanity = partner.slug && !istUrnSlug(partner.slug) ? partner.slug : null
    const { profilUrl, norm } = profilAusSlug(vanity)
    const person: PersonExtrakt | null =
      partner.name || partner.slug
        ? {
            name: partner.name,
            titel: teile.titel,
            vorname: teile.vorname,
            nachname: teile.nachname,
            headline: partner.headline,
            unternehmen: kopf.unternehmen,
            rolle: kopf.rolle,
            ort: null,
            profilUrl,
            norm,
            slug: vanity,
          }
        : null
    return { art, url, person, letzteNachricht: letzte, auswahl, hinweis }
  }
  return { art, url, person: null, letzteNachricht: null, auswahl, hinweis }
}
