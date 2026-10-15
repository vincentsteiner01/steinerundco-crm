// Lese-Logik gegen synthetische LinkedIn-Seiten (erfundene Personen). Keine echte LinkedIn-Seite, kein Netz.
import { describe, expect, it } from 'vitest'
import { leseSeite, seitenArt } from '../src/lesen/lesen'
import { ausBeschreibung, nameAusTitel, teileHeadline } from '../src/lesen/profil'
import { leseEintraege, letzteVonPartner } from '../src/lesen/nachrichten'
import { dokument } from './hilfe'

describe('Seitenart', () => {
  it('erkennt Profil, Unterhaltung und alles andere über die URL', () => {
    expect(seitenArt('https://www.linkedin.com/in/tilda-testfall-4a2b/').art).toBe('profil')
    expect(seitenArt('https://www.linkedin.com/in/tilda-testfall-4a2b/details/experience/').art).toBe('profil')
    expect(seitenArt('https://www.linkedin.com/messaging/thread/2-abc==/').art).toBe('nachrichten')
    expect(seitenArt('https://www.linkedin.com/feed/').art).toBe('andere')
    expect(seitenArt('https://www.linkedin.com/sales/lead/ACwAAA,NAME_SEARCH').hinweis).toMatch(/Sales Navigator/)
    expect(seitenArt('https://www.linkedin.com/company/sonnenfeld/').hinweis).toMatch(/Firmenseite/)
    expect(seitenArt('https://example.com/in/x').art).toBe('andere')
    expect(seitenArt('kein-url').art).toBe('andere')
  })
})

describe('Profil (deutsche Oberfläche, klassischer Aufbau)', () => {
  const url = 'https://www.linkedin.com/in/tilda-testfall-4a2b/?miniProfileUrn=urn%3Ali%3Ax'
  const e = leseSeite(dokument('profil-de.html', url), url, { ichName: 'Vincent Steiner' })

  it('liest Name, Headline, Firma, Ort und die normierte Profil-URL', () => {
    expect(e.art).toBe('profil')
    expect(e.person).toMatchObject({
      name: 'Tilda Testfall',
      vorname: 'Tilda',
      nachname: 'Testfall',
      titel: null,
      headline: 'Geschäftsführerin bei Sonnenfeld Solartechnik GmbH | Photovoltaik für Gewerbe',
      unternehmen: 'Sonnenfeld Solartechnik GmbH',
      rolle: 'Geschäftsführerin',
      ort: 'Lüneburg, Niedersachsen, Deutschland',
      profilUrl: 'https://www.linkedin.com/in/tilda-testfall-4a2b/',
      norm: 'linkedin.com/in/tilda-testfall-4a2b',
      slug: 'tilda-testfall-4a2b',
    })
  })

  it('liest die letzte Nachricht aus dem offenen Chatfenster dieser Person', () => {
    expect(e.letzteNachricht).toBe('Danke für die Anfrage – gern mehr dazu.')
  })
})

describe('Profil (gehashte Klassen, englisch, URN-URL)', () => {
  const url = 'https://www.linkedin.com/in/ACoAABcdEfGhIjKlMnOpQrStUvWxYz012345/'
  const e = leseSeite(dokument('profil-gehasht.html', url), url)

  it('bereinigt den Namen (Titel, Emoji, Pronomen) und löst die URN über die Profilkarte auf', () => {
    expect(e.person).toMatchObject({
      name: 'Dr. Jonas Beispielmann',
      titel: 'Dr.',
      vorname: 'Jonas',
      nachname: 'Beispielmann',
      headline: 'Inhaber | Nordlicht Energie GmbH & Co. KG',
      unternehmen: 'Nordlicht Energie GmbH & Co. KG',
      rolle: 'Inhaber',
      ort: 'Bremen, Germany',
      norm: 'linkedin.com/in/jonas-beispielmann',
    })
  })
})

describe('Profil nur mit Titel und Meta-Tags', () => {
  const url = 'https://www.linkedin.com/in/lea-platzhalter/'
  const e = leseSeite(dokument('profil-minimal.html', url), url)

  it('fällt auf document.title und og:description zurück', () => {
    expect(e.person).toMatchObject({
      name: 'Lea Platzhalter',
      vorname: 'Lea',
      nachname: 'Platzhalter',
      headline: 'Inhaberin bei Muster Elektro',
      unternehmen: 'Muster Elektro',
      rolle: 'Inhaberin',
      ort: 'Celle',
      norm: 'linkedin.com/in/lea-platzhalter',
    })
  })
})

describe('Profil nach SPA-Navigation (veraltete Meta-Tags)', () => {
  const url = 'https://www.linkedin.com/in/paul-probe/'
  const e = leseSeite(dokument('profil-veraltet.html', url), url)

  it('nimmt Name und Slug von der sichtbaren Seite, nicht aus den Meta-Tags des vorigen Profils', () => {
    expect(e.person?.name).toBe('Paul Probe')
    expect(e.person?.norm).toBe('linkedin.com/in/paul-probe')
    expect(e.person?.unternehmen).toBe('Probe Haustechnik')
    expect(e.person?.ort).toBeNull()
  })
})

describe('Profil direkt nach LinkedIn-interner Navigation (alte Karte noch im DOM)', () => {
  it('liest keinen Namen, solange Karte oder Titel zur alten Person gehören – die Norm kommt aus der URL', () => {
    const url = 'https://www.linkedin.com/in/neue-person-77/'
    const e = leseSeite(dokument('profil-de.html', url), url)
    expect(e.person).toMatchObject({ name: null, vorname: null, unternehmen: null, norm: 'linkedin.com/in/neue-person-77' })
    const doc = dokument('profil-veraltet.html', 'https://www.linkedin.com/in/paul-probe/')
    doc.title = 'Tilda Testfall | LinkedIn'
    expect(leseSeite(doc, 'https://www.linkedin.com/in/paul-probe/').person?.name).toBeNull()
  })
})

describe('Unterhaltung', () => {
  const url = 'https://www.linkedin.com/messaging/thread/2-xyz==/'
  const doc = dokument('nachrichten.html', url)
  const e = leseSeite(doc, url, { ichName: 'Vincent Steiner' })

  it('erkennt den Gesprächspartner über den Profil-Link im Kopf', () => {
    expect(e.art).toBe('nachrichten')
    expect(e.person).toMatchObject({
      name: 'Tilda Testfall',
      vorname: 'Tilda',
      nachname: 'Testfall',
      norm: 'linkedin.com/in/tilda-testfall-4a2b',
      unternehmen: 'Sonnenfeld Solartechnik GmbH',
      rolle: 'Geschäftsführerin',
    })
  })

  it('liefert die letzte Nachricht der anderen Person – auch wenn danach noch eine eigene kam', () => {
    expect(e.letzteNachricht).toBe('Wie läuft das genau ab?\nWir sind zu dritt im Innendienst.')
  })

  it('ordnet gruppierte Nachrichten ohne eigenen Kopf dem vorigen Absender zu', () => {
    const eintraege = leseEintraege(doc.querySelector('.msg-thread') as Element)
    expect(eintraege.map((x) => x.absenderName)).toEqual([
      'Tilda Testfall',
      'Vincent Steiner',
      'Tilda Testfall',
      'Tilda Testfall',
      'Vincent Steiner',
    ])
  })

  it('ohne Partner-Treffer: letzte Nachricht, die nicht von mir ist', () => {
    const eintraege = [
      { absenderName: 'Vincent Steiner', absenderSlug: null, andere: false, text: 'Hallo' },
      { absenderName: 'Erika Fremd', absenderSlug: null, andere: false, text: 'Antwort' },
      { absenderName: 'Vincent Steiner', absenderSlug: null, andere: false, text: 'Danke' },
    ]
    expect(letzteVonPartner(eintraege, { name: null, slug: null, headline: null }, 'Vincent Steiner')).toBe('Antwort')
    expect(letzteVonPartner(eintraege, { name: null, slug: null, headline: null })).toBeNull()
  })

  it('übernimmt markierten Text als Auswahl', () => {
    const mit = leseSeite(doc, url, { auswahl: '  Wir sind zu dritt.  ' })
    expect(mit.auswahl).toBe('Wir sind zu dritt.')
  })
})

describe('Leere und fremde Seiten', () => {
  it('liefert null statt zu werfen', () => {
    const url = 'https://www.linkedin.com/in/niemand/'
    const doc = dokument('profil-minimal.html', 'https://www.linkedin.com/in/niemand/')
    doc.title = ''
    for (const m of doc.querySelectorAll('meta, link')) m.remove()
    const e = leseSeite(doc, url)
    expect(e.person).toMatchObject({ name: null, vorname: null, headline: null, unternehmen: null, ort: null })
    expect(e.person?.norm).toBe('linkedin.com/in/niemand')
    const feed = leseSeite(doc, 'https://www.linkedin.com/feed/')
    expect(feed).toMatchObject({ art: 'andere', person: null })
  })
})

describe('Einzelteile', () => {
  it('nameAusTitel', () => {
    expect(nameAusTitel('(12) Tilda Testfall | LinkedIn')).toBe('Tilda Testfall')
    expect(nameAusTitel('Lea Platzhalter – Inhaberin – Muster Elektro | LinkedIn')).toBe('Lea Platzhalter')
    expect(nameAusTitel('Feed | LinkedIn')).toBeNull()
    expect(nameAusTitel('')).toBeNull()
  })
  it('teileHeadline', () => {
    expect(teileHeadline('Vertrieb bei Muster Solar GmbH, Hamburg')).toEqual({ rolle: 'Vertrieb', unternehmen: 'Muster Solar GmbH, Hamburg' })
    expect(teileHeadline('Head of Sales at Nordlicht Energie | Speaker')).toEqual({ rolle: 'Head of Sales', unternehmen: 'Nordlicht Energie' })
    expect(teileHeadline('Inhaber @ Probe Haustechnik')).toEqual({ rolle: 'Inhaber', unternehmen: 'Probe Haustechnik' })
    expect(teileHeadline('Berater für Photovoltaik')).toEqual({ rolle: 'Berater für Photovoltaik', unternehmen: null })
    expect(teileHeadline(null)).toEqual({ rolle: null, unternehmen: null })
  })
  it('ausBeschreibung (englisch)', () => {
    expect(ausBeschreibung('CEO · Experience: Nordlicht Energie · Location: Bremen · 500+ connections')).toEqual({
      headline: 'CEO',
      unternehmen: 'Nordlicht Energie',
      ort: 'Bremen',
    })
  })
})
