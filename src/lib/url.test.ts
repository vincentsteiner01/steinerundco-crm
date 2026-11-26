// BAUPLAN § 3.1.12 – 20 URLs vs. crm.normalize_linkedin_url (Fixture aus der Live-DB).
import { describe, expect, it } from 'vitest'
import fixture from '@/test/fixtures/url.fixture.json'
import {
  istFirmenseite,
  istSalesNav,
  linkedinAnzeige,
  linkedinHref,
  linkedinProfilLink,
  normalizeLinkedinUrl,
  urlArt,
  urlDecode,
} from './url'

type Fixture = { faelle: { eingabe: string; norm: string | null }[] }
const fx = fixture as Fixture

describe('normalizeLinkedinUrl', () => {
  it('stimmt mit der DB-Fixture überein', () => {
    expect(fx.faelle.length).toBeGreaterThanOrEqual(20)
    for (const f of fx.faelle) expect(normalizeLinkedinUrl(f.eingabe), f.eingabe).toBe(f.norm)
  })
  it('null/undefined → null; Prozent-Dekodierung bytewise', () => {
    expect(normalizeLinkedinUrl(null)).toBeNull()
    expect(normalizeLinkedinUrl(undefined)).toBeNull()
    expect(urlDecode('max-m%C3%BCller')).toBe('max-müller')
    expect(urlDecode('a%2')).toBe('a%2')
    expect(urlDecode('a+b')).toBe('a+b')
  })
})

// 26.11.2026: Ein Profil-Link mit Anhang („Kontaktinfo“ offen) wurde als „kein LinkedIn-Profil-Link“ abgelehnt. Nur erfundene Namen.
describe('linkedinProfilLink', () => {
  const SAUBER = 'https://www.linkedin.com/in/max-muster-demo'
  const PROFILE = [
    'https://www.linkedin.com/in/max-muster-demo',
    'https://www.linkedin.com/in/max-muster-demo/',
    '  https://www.linkedin.com/in/max-muster-demo/  ',
    // ohne https, ohne www, mit http
    'linkedin.com/in/max-muster-demo',
    'www.linkedin.com/in/max-muster-demo/',
    'http://linkedin.com/in/max-muster-demo',
    // Länder-Subdomain
    'https://de.linkedin.com/in/max-muster-demo',
    'de.linkedin.com/in/max-muster-demo/',
    // Anhang hinter dem Namen
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/detail/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/recent-activity/all/',
    'https://www.linkedin.com/in/max-muster-demo/details/experience',
    // mobile Ansicht
    'https://www.linkedin.com/mwlite/in/max-muster-demo',
    'linkedin.com/mwlite/in/max-muster-demo/',
    // Query und Fragment
    'https://www.linkedin.com/in/max-muster-demo?originalSubdomain=de',
    'https://www.linkedin.com/in/max-muster-demo/?utm_source=share&trk=public_profile',
    'https://www.linkedin.com/in/max-muster-demo#experience',
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/?trk=x#top',
    // Großschreibung im festen Teil
    'HTTPS://WWW.LinkedIn.COM/IN/max-muster-demo/',
  ]
  const KEINE = [
    '',
    '   ',
    'max-muster-demo',
    // andere Seiten auf LinkedIn
    'https://www.linkedin.com/company/muster-solar-demo/',
    'https://www.linkedin.com/sales/lead/ACwAAABCDEF,NAME_SEARCH,abc',
    'https://www.linkedin.com/sales/people/ACwAAA',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/',
    'https://www.linkedin.com/mwlite/company/muster-solar-demo',
    'https://www.linkedin.com/company/in/max-muster-demo',
    // leerer Name
    'https://www.linkedin.com/in/',
    'https://www.linkedin.com/in',
    'https://www.linkedin.com/in//overlay/contact-info/',
    'linkedin.com/in/?trk=x',
    'linkedin.com/in/#top',
    // Leerraum im Namen (Name mitkopiert, Tippfehler): der Link führte ins Leere
    'linkedin.com/in/max muster',
    'https://www.linkedin.com/in/max-muster-demo Max Muster',
    'https://www.linkedin.com/in/max /overlay/contact-info/',
    // kodierter Schrägstrich im Namen: Die Datenbank lehnte das Ergebnis ab
    'https://www.linkedin.com/in/max%2Fmuster',
    // fremde Domains
    'https://notlinkedin.com/in/x',
    'https://linkedin.com.evil.de/in/x',
    'https://evil.de/linkedin.com/in/x',
    'https://linkedin.com@evil.de/in/x',
    'https://evil.de/?weiter=linkedin.com/in/x',
    'https://example.com/in/max',
  ]

  it.each(PROFILE)('%j → sauberer Profil-Link', (eingabe) => {
    expect(linkedinProfilLink(eingabe)).toBe(SAUBER)
  })
  it.each(KEINE)('%j → null', (eingabe) => {
    expect(linkedinProfilLink(eingabe)).toBeNull()
  })
  it('null/undefined → null', () => {
    expect(linkedinProfilLink(null)).toBeNull()
    expect(linkedinProfilLink(undefined)).toBeNull()
  })
  it('der Name bleibt, wie er eingegeben wurde (Großschreibung, Umlaute, Prozent-Kodierung)', () => {
    expect(linkedinProfilLink('https://de.linkedin.com/in/Max-Muster-Demo/overlay/contact-info/')).toBe(
      'https://www.linkedin.com/in/Max-Muster-Demo',
    )
    expect(linkedinProfilLink('linkedin.com/in/petra-prüfstein-demo/')).toBe(
      'https://www.linkedin.com/in/petra-prüfstein-demo',
    )
    expect(linkedinProfilLink('linkedin.com/in/petra-pr%C3%BCfstein-demo/detail/contact-info/')).toBe(
      'https://www.linkedin.com/in/petra-pr%C3%BCfstein-demo',
    )
  })
  it('das Ergebnis nimmt normalizeLinkedinUrl (Spiegel der Datenbank) immer an', () => {
    for (const eingabe of PROFILE)
      expect(normalizeLinkedinUrl(linkedinProfilLink(eingabe)), eingabe).toBe('linkedin.com/in/max-muster-demo')
    expect(normalizeLinkedinUrl(linkedinProfilLink('linkedin.com/in/petra-pr%C3%BCfstein-demo/overlay/x'))).toBe(
      'linkedin.com/in/petra-prüfstein-demo',
    )
  })
  it('was die Datenbank schon annahm, bleibt dieselbe Person (DB-Fixture)', () => {
    const angenommen = fx.faelle.filter((f) => f.norm !== null)
    expect(angenommen.length).toBeGreaterThanOrEqual(10)
    for (const f of angenommen) expect(normalizeLinkedinUrl(linkedinProfilLink(f.eingabe)), f.eingabe).toBe(f.norm)
  })
  it('die vorhandenen Funktionen bleiben, wie sie sind: Die Datenbank lehnt den Link mit Anhang weiter ab', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/')).toBeNull()
    expect(normalizeLinkedinUrl('https://www.linkedin.com/mwlite/in/max-muster-demo')).toBeNull()
    expect(urlArt('https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/')).toBe('ungueltig')
  })
})

describe('Art der URL', () => {
  it('Sales Navigator und Firmenseite', () => {
    expect(istSalesNav('https://www.linkedin.com/sales/lead/ACwAAABCDEF,NAME_SEARCH,abc')).toBe(true)
    expect(istSalesNav('https://www.linkedin.com/sales/people/ACwAAA')).toBe(true)
    expect(istSalesNav('https://www.linkedin.com/in/max')).toBe(false)
    expect(istFirmenseite('https://www.linkedin.com/company/steiner-co/')).toBe(true)
    expect(istFirmenseite('https://de.linkedin.com/in/max')).toBe(false)
  })
  it('urlArt', () => {
    expect(urlArt('https://www.linkedin.com/in/max-mustermann/')).toBe('person')
    expect(urlArt('https://www.linkedin.com/sales/lead/x')).toBe('sales_nav')
    expect(urlArt('https://www.linkedin.com/company/x')).toBe('firmenseite')
    expect(urlArt('')).toBe('keine')
    expect(urlArt(null)).toBe('keine')
    expect(urlArt('https://example.com/in/max')).toBe('ungueltig')
  })
  it('Anzeige und Href', () => {
    expect(linkedinAnzeige('https://www.linkedin.com/in/Max-Mustermann/')).toBe('in/max-mustermann')
    expect(linkedinAnzeige('https://www.linkedin.com/in/ein-sehr-langer-slug-mit-vielen-zeichen-123456', 20)).toBe(
      'in/ein-sehr-langer-…',
    )
    expect(linkedinAnzeige('https://www.linkedin.com/company/steiner-co/')).toBe('company/steiner-co/')
    expect(linkedinHref('linkedin.com/in/max')).toBe('https://www.linkedin.com/in/max/')
    expect(linkedinHref('https://www.linkedin.com/company/steiner-co/')).toBe(
      'https://www.linkedin.com/company/steiner-co/',
    )
    expect(linkedinHref('https://example.com/x')).toBeNull()
  })
})
