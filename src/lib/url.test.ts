// BAUPLAN § 3.1.12 – 20 URLs vs. crm.normalize_linkedin_url (Fixture aus der Live-DB).
import { describe, expect, it } from 'vitest'
import fixture from '@/test/fixtures/url.fixture.json'
import {
  istFirmenseite,
  istSalesNav,
  linkedinAnzeige,
  linkedinHref,
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
