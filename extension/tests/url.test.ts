// Profil-URL: dieselbe Norm wie crm.normalize_linkedin_url (Fixture aus der Live-DB, src/test/fixtures/url.fixture.json).
import { describe, expect, it } from 'vitest'
import { normalizeLinkedinUrl } from '@/lib/url'
import fixtureJson from '../../src/test/fixtures/url.fixture.json'
import { istUrnSlug, profilAusSlug, slugAusPfad } from '../src/lesen/dom'

const faelle = (fixtureJson as { faelle: { eingabe: string; norm: string | null }[] }).faelle

describe('normalizeLinkedinUrl (aus src/lib/url.ts) gegen die DB-Fixture', () => {
  it.each(faelle)('$eingabe → $norm', ({ eingabe, norm }) => {
    expect(normalizeLinkedinUrl(eingabe)).toBe(norm)
  })
})

describe('Profil-URL aus der Tab-Adresse', () => {
  const tabUrls = faelle.filter((f) => /^\s*https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+/i.test(f.eingabe))

  it('liefert für jede Profil-Adresse der Fixture dieselbe Norm wie die DB', () => {
    expect(tabUrls.length).toBeGreaterThan(8)
    for (const f of tabUrls) {
      const { norm } = profilAusSlug(slugAusPfad(f.eingabe.trim()))
      // /details/… ist in der DB ungültig, im Tab aber dieselbe Person → Norm des Profils
      const erwartet = f.norm ?? normalizeLinkedinUrl(f.eingabe.trim().replace(/(\/in\/[^/]+)\/.*$/, '$1'))
      expect(norm, f.eingabe).toBe(erwartet)
    }
  })

  it('erkennt URN-IDs und Nicht-Profile', () => {
    expect(istUrnSlug('ACoAABcdEfGhIjKlMnOpQrStUvWxYz012345')).toBe(true)
    expect(istUrnSlug('max-mustermann')).toBe(false)
    expect(slugAusPfad('https://www.linkedin.com/company/steiner-co/')).toBeNull()
    expect(slugAusPfad('/in/max-mustermann/overlay/contact-info/')).toBe('max-mustermann')
    expect(profilAusSlug(null)).toEqual({ profilUrl: null, norm: null })
  })
})
