// I-08-Fälle: Varianten derselben URL → derselbe Schlüssel; Klassifikation person | sales_nav | firmenseite | keine | ungueltig.
import { describe, expect, it } from 'vitest'
import { klassifizieren, urlFinden } from './linkedinUrl'

describe('parser/linkedinUrl', () => {
  it('normalisiert Subdomain, Query, Großschreibung, Prozent-Kodierung, Trailing-Slash', () => {
    const varianten = [
      'https://www.linkedin.com/in/J%C3%B6rg-M%C3%BCller-77',
      'https://de.linkedin.com/in/jörg-müller-77/?originalSubdomain=de',
      'HTTPS://WWW.LINKEDIN.COM/IN/J%C3%B6RG-M%C3%BCLLER-77/',
      'linkedin.com/in/jörg-müller-77#about',
    ]
    for (const v of varianten) expect(klassifizieren(v).linkedin_url_norm).toBe('linkedin.com/in/jörg-müller-77')
  })
  it('klassifiziert person / sales_nav / firmenseite / keine / ungueltig', () => {
    expect(klassifizieren('https://www.linkedin.com/in/max-mustermann/').url_art).toBe('person')
    expect(klassifizieren('https://www.linkedin.com/sales/lead/ACwAAAbc123,NAME_SEARCH,xyz')).toMatchObject({
      url_art: 'sales_nav',
      linkedin_url_norm: null,
    })
    expect(klassifizieren('https://www.linkedin.com/company/ott-co').url_art).toBe('firmenseite')
    expect(klassifizieren('unbekannt')).toEqual({ linkedin_url: null, linkedin_url_norm: null, url_art: 'keine' })
    expect(klassifizieren('')).toMatchObject({ url_art: 'keine' })
    expect(klassifizieren('https://example.com/max').url_art).toBe('ungueltig')
  })
  it('findet die URL im Text, auch ohne Protokoll, und entfernt sie aus dem Rest', () => {
    expect(urlFinden('Petra Schmidt – linkedin.com/in/petra-schmidt-pv')).toEqual({
      url: 'linkedin.com/in/petra-schmidt-pv',
      rest: 'Petra Schmidt –',
    })
    expect(urlFinden('Max (https://www.linkedin.com/in/max-mustermann/) GmbH')).toEqual({
      url: 'https://www.linkedin.com/in/max-mustermann/',
      rest: 'Max ( ) GmbH',
    })
    expect(urlFinden('ohne Link').url).toBeNull()
    expect(urlFinden('Eva – https://uk.linkedin.com/in/eva-lang-solar#about.').url).toBe(
      'https://uk.linkedin.com/in/eva-lang-solar#about',
    )
  })
})
